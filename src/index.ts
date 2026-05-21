/**
 * CookieCloud Worker — Cloudflare Workers 版 Cookie 同步服务端
 *
 * 完全兼容原版 CookieCloud API：
 *   POST /update  — 接收并存储加密的 Cookie 数据（gzip 解压）
 *   GET  /get/:uuid — 获取加密的 Cookie 数据
 *   GET  /health  — 健康检查
 *
 * 原版项目: https://github.com/easychen/CookieCloud
 *
 * 设计要点：
 * - 端到端加密：加密在浏览器扩展完成，服务端不接触明文 Cookie
 * - 使用 Workers KV 替代文件系统存储
 * - 支持 gzip 压缩请求体（浏览器扩展默认发送 gzip）
 * - 完整的 CORS 支持（浏览器扩展跨域请求需要）
 */

export interface Env {
  COOKIE_DATA: KVNamespace;
  ENVIRONMENT?: string;
}

// ── CORS ──
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Content-Encoding',
  'Access-Control-Max-Age': '86400',
};

const KV_PREFIX = 'cookie:';
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // CORS 预检
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      // 路由
      switch (url.pathname) {
        case '/':
          return jsonResponse({ message: `CookieCloud Worker (${env.ENVIRONMENT ?? 'production'})` });

        case '/health':
          return jsonResponse({
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: Math.round(performance.now() / 1000),
          });

        case '/update':
          if (method !== 'POST') return methodNotAllowed();
          return handleUpdate(request, env);

        default:
          if (url.pathname.startsWith('/get/')) {
            if (method !== 'GET' && method !== 'POST') return methodNotAllowed();
            const uuid = url.pathname.slice('/get/'.length);
            if (!uuid) return textResponse('Bad Request: Missing UUID', 400);
            return handleGet(env, uuid);
          }

          return jsonResponse(
            {
              error: 'Not Found',
              message: `The requested URL ${url.pathname} was not found on this server.`,
              path: url.pathname,
              method,
              timestamp: new Date().toISOString(),
            },
            404,
          );
      }
    } catch (err) {
      console.error('Unhandled error:', err);
      return textResponse('Internal Serverless Error', 500);
    }
  },
};

// ── POST /update ──────────────────────────────────────────────

async function handleUpdate(request: Request, env: Env): Promise<Response> {
  // 解压 gzip 请求体（浏览器扩展默认 gzip 压缩）
  let bodyBytes: ArrayBuffer;
  if (request.headers.get('Content-Encoding') === 'gzip') {
    bodyBytes = await decompressGzip(request.body!);
  } else {
    bodyBytes = await request.arrayBuffer();
  }

  if (bodyBytes.byteLength > MAX_BODY_BYTES) {
    return jsonResponse({ action: 'error', message: 'Request body too large' }, 413);
  }

  // 解析 JSON
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(new TextDecoder().decode(bodyBytes));
  } catch {
    return textResponse('Bad Request: Invalid JSON', 400);
  }

  const { encrypted, uuid, crypto_type } = body as {
    encrypted?: string;
    uuid?: string;
    crypto_type?: string;
  };

  if (!encrypted || !uuid) {
    return textResponse('Bad Request: Missing required fields', 400);
  }

  // 写入 KV
  const value = JSON.stringify({
    encrypted,
    crypto_type: crypto_type ?? 'legacy',
  });

  await env.COOKIE_DATA.put(`${KV_PREFIX}${uuid}`, value);

  return jsonResponse({ action: 'done' });
}

// ── GET /get/:uuid ────────────────────────────────────────────

async function handleGet(env: Env, uuid: string): Promise<Response> {
  const stored = await env.COOKIE_DATA.get(`${KV_PREFIX}${uuid}`);

  if (stored === null) {
    return textResponse('Not Found', 404);
  }

  let data: { encrypted: string; crypto_type?: string };
  try {
    data = JSON.parse(stored);
  } catch {
    return textResponse('Internal Serverless Error', 500);
  }

  return jsonResponse({
    encrypted: data.encrypted,
    crypto_type: data.crypto_type ?? 'legacy',
  });
}

// ── 工具函数 ──────────────────────────────────────────────────

async function decompressGzip(body: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
  const ds = new DecompressionStream('gzip');
  const decompressed = body.pipeThrough(ds);
  return new Response(decompressed).arrayBuffer();
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function textResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' },
  });
}

function methodNotAllowed(): Response {
  return textResponse('Method Not Allowed', 405);
}