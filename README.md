# CookieCloud Worker

> 🙏 **This project is a Cloudflare Workers port of [CookieCloud](https://github.com/easychen/CookieCloud) by [@easychen](https://github.com/easychen).**  
> Huge thanks to easychen for creating the original end-to-end encrypted cookie sync tool that made this possible.

Cloudflare Workers version of CookieCloud — a server for syncing browser cookies across devices via end-to-end encryption.

[中文文档](./README_cn.md)

---

> **No server maintenance required** — runs entirely on Cloudflare's free plan (100k requests/day).

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/yaaaaaaakkkkkke/cookiecloud-worker)

Click the button above to deploy instantly to your Cloudflare account — no local setup needed.

## Why this version?

| Feature | Original (Node.js/Docker) | This one (Cloudflare Workers) |
|---------|--------------------------|-------------------------------|
| Hosting | Self-managed VPS / Docker | **Serverless, zero ops** |
| Storage | File system | **Workers KV** |
| Cost | VPS monthly fee | **Free tier** (100k req/day) |
| Deployment | Docker / Node setup | `npx wrangler deploy` |
| Encryption | End-to-end AES (same) | End-to-end AES (same) |
| API Compat. | — | **100% compatible** with the browser extension |

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A [Cloudflare](https://cloudflare.com) account

### 1. Clone & Install

```bash
git clone git@github.com:yaaaaaaakkkkkke/cookiecloud-worker.git
cd cookiecloud-worker
npm install
```

### 2. Create KV Namespace

```bash
npx wrangler kv namespace create COOKIE_DATA
```

Copy the returned `id` and paste it into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "COOKIE_DATA"
id = "your-kv-namespace-id"    # ← paste here
preview_id = "your-kv-namespace-id"
```

### 3. Deploy

```bash
npx wrangler deploy
```

### 4. Configure CookieCloud Extension

| Field | Value |
|-------|-------|
| **Server** | `https://cookiecloud-worker.your-name.workers.dev` |
| **UUID** | Auto-generated |
| **Password** | Set your own |

## API Reference

### `POST /update` — Upload encrypted cookies

- **Method:** `POST`
- **Content-Type:** `application/json`
- **Content-Encoding:** `gzip` (the extension sends gzip by default)
- **Body:** `{ "uuid": "string", "encrypted": "string", "crypto_type": "legacy|aes-128-cbc-fixed" }`
- **Response:** `{ "action": "done" }`

### `GET /get/:uuid` — Download encrypted cookies

- **Method:** `GET`
- **Response:** `{ "encrypted": "string", "crypto_type": "string" }`

### `GET /health` — Health check

- **Response:** `{ "status": "OK", "timestamp": "...", "uptime": ... }`

## Local Development

```bash
npx wrangler dev --ip 127.0.0.1 --port 8787
```

Test with curl:

```bash
# Health check
curl http://127.0.0.1:8787/health

# Upload (gzip compressed)
echo '{"uuid":"test","encrypted":"U2FsdGVkX18+test=="}' | \
  gzip | curl -X POST http://127.0.0.1:8787/update \
  -H 'Content-Encoding: gzip' \
  --data-binary @-

# Download
curl http://127.0.0.1:8787/get/test
```

## Security

- Cookie data is **encrypted end-to-end** in the browser before transmission
- The server **never sees plaintext cookies**
- Encryption: AES-256-CBC (legacy mode) or AES-128-CBC (fixed IV mode)
- Key derivation: `MD5(uuid + '-' + password)[:16]`

## Credits

- [CookieCloud](https://github.com/easychen/CookieCloud) by @easychen — the original project
- Built with [Cloudflare Workers](https://workers.cloudflare.com/)