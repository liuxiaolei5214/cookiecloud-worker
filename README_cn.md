# CookieCloud Worker

> 🙏 **本项目是基于 [CookieCloud](https://github.com/easychen/CookieCloud) by [@easychen](https://github.com/easychen) 的 Cloudflare Workers 移植版。**  
> 感谢 easychen 创造了这个优秀的端到端加密 Cookie 同步工具。

[CookieCloud](https://github.com/easychen/CookieCloud) 的 Cloudflare Workers 版服务端 — 端到端加密跨设备 Cookie 同步。

[English Docs](./README.md)

---

> **无需维护服务器** — 完全运行在 Cloudflare 免费计划上（每天 10 万次请求）。

[![部署到 Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/yaaaaaaakkkkkke/cookiecloud-worker)

点击上方按钮一键部署到你的 Cloudflare 账户，无需本地环境。

## 为什么选择这个版本？

| 对比项 | 原版 (Node.js/Docker) | 本版 (Cloudflare Workers) |
|--------|----------------------|--------------------------|
| 托管 | 自建 VPS / Docker | **无服务器，零运维** |
| 存储 | 文件系统 | **Workers KV** |
| 费用 | VPS 月租 | **免费**（10万请求/天） |
| 部署 | Docker / Node 搭建 | `npx wrangler deploy` |
| 加密 | 端到端 AES（相同） | 端到端 AES（相同） |
| API 兼容 | — | **100% 兼容**浏览器扩展 |

## 快速开始

### 前置条件

- [Node.js](https://nodejs.org/)（v18+）
- 一个 [Cloudflare](https://cloudflare.com) 账号

### 1. 克隆项目并安装依赖

```bash
git clone git@github.com:yaaaaaaakkkkkke/cookiecloud-worker.git
cd cookiecloud-worker
npm install
```

### 2. 创建 KV 命名空间

```bash
npx wrangler login                     # 登录 Cloudflare
npx wrangler kv namespace create COOKIE_DATA
```

把返回的 `id` 填入 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "COOKIE_DATA"
id = "你的-kv-命名空间-id"    # ← 粘贴到这里
preview_id = "你的-kv-命名空间-id"
```

### 3. 部署

```bash
npx wrangler deploy
```

部署成功后你会看到类似这样的输出：

```
Uploaded cookiecloud-worker (1.88 sec)
Deployed cookiecloud-worker triggers (1.29 sec)
  https://cookiecloud-worker.你的域名.workers.dev
```

### 4. 配置 CookieCloud 浏览器扩展

| 字段 | 值 |
|------|-----|
| **服务器地址** | `https://cookiecloud-worker.你的域名.workers.dev` |
| **UUID** | 自动生成即可 |
| **密码** | 自己设定 |
| 其他保持默认 | — |

保存即生效 🎉

### 详细配置方式

1. 点击浏览器工具栏的 CookieCloud 图标
2. 工作模式选择「上传到服务器」或「覆盖到浏览器」
3. 在 **服务器地址** 填入上面部署好的 URL
4. **UUID** 自动生成（也可以手动重新生成）
5. **密码** 自行设定（务必记住，丢失后数据无法解密）
6. 点击 **保存** → **手动同步** 测试一下

---

## API 接口文档

### `POST /update` — 上传加密的 Cookie

- **方法:** `POST`
- **Content-Type:** `application/json`
- **Content-Encoding:** `gzip`（扩展默认发送 gzip 压缩）
- **请求体:**
  ```json
  {
    "uuid": "string",
    "encrypted": "string",
    "crypto_type": "legacy|aes-128-cbc-fixed"
  }
  ```
- **响应:** `{ "action": "done" }`

### `GET /get/:uuid` — 下载加密的 Cookie

- **方法:** `GET`
- **响应:**
  ```json
  {
    "encrypted": "string",
    "crypto_type": "string"
  }
  ```

### `GET /health` — 健康检查

- **响应:** `{ "status": "OK", "timestamp": "...", "uptime": ... }`

---

## 本地开发

```bash
npx wrangler dev --ip 127.0.0.1 --port 8787
```

用 curl 测试：

```bash
# 健康检查
curl http://127.0.0.1:8787/health

# 上传（gzip 压缩）
echo '{"uuid":"test","encrypted":"U2FsdGVkX18+test=="}' | \
  gzip | curl -X POST http://127.0.0.1:8787/update \
  -H 'Content-Encoding: gzip' \
  --data-binary @-

# 下载
curl http://127.0.0.1:8787/get/test
```

---

## 常见问题

### ❓ 部署时提示未登录

使用 `npx wrangler login` 会打开浏览器登录。在纯命令行环境，可以使用 API Token：

1. 打开 https://dash.cloudflare.com/profile/api-tokens
2. 创建 Token，权限选择「编辑 Cloudflare Workers」
3. 部署时带上环境变量：
   ```bash
   CLOUDFLARE_API_TOKEN="你的token" npx wrangler deploy
   ```

### ❓ Cookie 同步失败

1. 检查 Worker URL 是否能正常访问：浏览器打开 `https://你的域名.workers.dev/health`
2. 检查扩展配置的服务器地址末尾没有 `/`
3. 确认 UUID 和密码在上下行两端保持一致

### ❓ 免费计划够用吗？

足够。CookieCloud 默认 10 分钟同步一次，一天 144 次请求。Cloudflare Workers 免费计划包含 **10 万次请求/天**，至少够 **600 个用户** 同时使用。

---

## 安全说明

- **端到端加密：** Cookie 数据在浏览器内加密后才发送到服务器
- **服务器不接触明文：** 服务端只存储密文，无法解密
- **加密算法：** AES-256-CBC（legacy 模式）或 AES-128-CBC（固定 IV 模式）
- **密钥派生：** `MD5(uuid + '-' + password)[:16]`

---

## 致谢

- [CookieCloud](https://github.com/easychen/CookieCloud) by @easychen — 原版项目
- 基于 [Cloudflare Workers](https://workers.cloudflare.com/) 构建