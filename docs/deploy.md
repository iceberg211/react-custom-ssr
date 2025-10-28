## 🚀 基于最新 Node.js 兼容性的部署方案

### 方案概述

Cloudflare Workers 现在支持：

- ✅ `node:http` 和 `node:https` 服务器
- ✅ `httpServerHandler` - 将 Node.js 服务器集成到 Workers
- ✅ 大部分 Node.js APIs（fs、path、crypto、process 等）
- ✅ 可以直接运行 Koa 应用！

### 1️⃣ **适配 Koa 应用到 Workers**

#### **Option A: 使用 httpServerHandler（推荐）**

```javascript
// worker.js
import Koa from "koa";
import { createServer } from "node:http";
import { httpServerHandler } from "cloudflare:node";

// 你现有的 Koa 应用
const app = new Koa();

// 你的所有中间件和路由
app.use(async (ctx) => {
  // 你的 SSR 渲染逻辑
  ctx.body = await renderReactApp(ctx);
});

// 创建 HTTP 服务器
const server = createServer(app.callback());

// 监听端口（在 Workers 中，端口只是路由标识符）
server.listen(8080);

// 导出为 Workers handler
export default httpServerHandler({ port: 8080 });
```

#### **Option B: 手动适配（更灵活）**

```javascript
// worker.js
import Koa from "koa";
import { createServer } from "node:http";
import { handleAsNodeRequest } from "cloudflare:node";

const app = new Koa();

// 你的中间件
app.use(async (ctx) => {
  const html = await renderReactApp(ctx.path);
  ctx.body = html;
  ctx.type = "text/html";
});

const server = createServer(app.callback());
server.listen(8080);

// 自定义 fetch handler
export default {
  async fetch(request, env, ctx) {
    // 可以在这里添加自定义逻辑
    // 比如：认证、日志、A/B 测试等

    // 然后转发给 Node.js server
    return handleAsNodeRequest(8080, request);
  },
};
```

### 2️⃣ **配置 wrangler.toml**

```toml
name = "my-react-ssr-app"
main = "dist/worker.js"
compatibility_date = "2025-10-29"

# 启用 Node.js 兼容性
compatibility_flags = [
  "nodejs_compat",
  "enable_nodejs_http_server_modules"
]

# 如果使用了客户端 HTTP 请求（如 axios）
# compatibility_flags = [
#   "nodejs_compat",
#   "enable_nodejs_http_modules",
#   "enable_nodejs_http_server_modules"
# ]

# Workers Sites - 托管静态资源
[site]
bucket = "./dist/public"

# 或者使用 R2 存储静态资源
# [[r2_buckets]]
# binding = "ASSETS"
# bucket_name = "my-static-assets"

# 环境变量
[vars]
NODE_ENV = "production"

# 如果需要数据库
# [[d1_databases]]
# binding = "DB"
# database_name = "my-database"
# database_id = "your-database-id"
```

### 3️⃣ **调整 Webpack 配置**

```javascript
// webpack.worker.config.js
const path = require("path");

module.exports = {
  target: "webworker", // Workers 环境
  entry: "./src/worker.js",
  output: {
    filename: "worker.js",
    path: path.resolve(__dirname, "dist"),
    library: {
      type: "module", // ESM 格式
    },
  },
  experiments: {
    outputModule: true, // 启用 ESM 输出
  },
  resolve: {
    extensions: [".js", ".jsx", ".json"],
    // 不再需要 fallback，Node.js APIs 原生支持
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              [
                "@babel/preset-env",
                {
                  targets: { chrome: "120" }, // Workers 使用最新 V8
                },
              ],
              "@babel/preset-react",
            ],
          },
        },
      },
      {
        test: /\.css$/,
        type: "asset/source", // CSS 作为字符串导入
      },
    ],
  },
  externals: {
    // 某些大型包可能需要排除
  },
};
```

### 4️⃣ **处理静态资源**

有几种方案：

#### **方案 A: Workers Sites（最简单）**

```toml
# wrangler.toml
[site]
bucket = "./dist/public"
```

```javascript
// worker.js
import { getAssetFromKV } from "@cloudflare/kv-asset-handler";

export default {
  async fetch(request, env, ctx) {
    // 先尝试静态资源
    if (request.url.includes("/static/")) {
      try {
        return await getAssetFromKV(
          {
            request,
            waitUntil: ctx.waitUntil.bind(ctx),
          },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: env.__STATIC_CONTENT_MANIFEST,
          }
        );
      } catch (e) {
        // 如果找不到静态文件，继续 SSR
      }
    }

    // SSR 处理
    return handleAsNodeRequest(8080, request);
  },
};
```

#### **方案 B: R2 存储**

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/static/")) {
      const object = await env.ASSETS.get(url.pathname);
      if (object) {
        return new Response(object.body, {
          headers: {
            "Content-Type": object.httpMetadata.contentType,
            "Cache-Control": "public, max-age=31536000",
          },
        });
      }
    }

    return handleAsNodeRequest(8080, request);
  },
};
```

### 5️⃣ **package.json 脚本**

```json
{
  "scripts": {
    "build:client": "webpack --config webpack.client.config.js",
    "build:worker": "webpack --config webpack.worker.config.js",
    "build": "npm run build:client && npm run build:worker",
    "dev": "wrangler dev",
    "deploy": "npm run build && wrangler deploy",
    "preview": "wrangler deploy --dry-run"
  },
  "dependencies": {
    "koa": "^2.15.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@cloudflare/kv-asset-handler": "^0.3.0",
    "wrangler": "^3.78.0",
    "webpack": "^5.89.0",
    "babel-loader": "^9.1.3"
  }
}
```

### 6️⃣ **完整示例：SSR Worker**

```javascript
// worker.js
import Koa from "koa";
import Router from "@koa/router";
import { createServer } from "node:http";
import { httpServerHandler } from "cloudflare:node";
import { renderToString } from "react-dom/server";
import App from "./App";

const app = new Koa();
const router = new Router();

// SSR 路由
router.get("/(.*)", async (ctx) => {
  // 渲染 React 应用
  const appHtml = renderToString(<App url={ctx.url} />);

  // 生成完整 HTML
  ctx.body = `
    <!DOCTYPE html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>My SSR App</title>
        <link rel="stylesheet" href="/static/styles.css">
      </head>
      <body>
        <div id="root">${appHtml}</div>
        <script src="/static/bundle.js"></script>
      </body>
    </html>
  `;
  ctx.type = "text/html";
});

app.use(router.routes());
app.use(router.allowedMethods());

// 创建服务器
const server = createServer(app.callback());
server.listen(8080);

// 导出为 Workers
export default httpServerHandler({ port: 8080 });
```

### 7️⃣ **部署流程**

```bash
# 1. 安装依赖
npm install

# 2. 构建项目
npm run build

# 3. 本地测试
npm run dev
# 访问 http://localhost:8787

# 4. 部署到生产
npm run deploy
# 或者
wrangler deploy
```

### 8️⃣ **注意事项和最佳实践**

#### **限制和注意点：**

1. **Worker 大小限制**：压缩后不能超过 1MB（企业版 5MB）
   - 如果超过，考虑使用 Service Bindings 拆分代码
2. **CPU 时间限制**：

   - 免费版：10ms
   - 付费版：50ms
   - 企业版：可配置

3. **不支持的 Node.js 特性**：
   - 某些底层网络操作
   - 文件系统是虚拟的（内存或只读）
   - `net.Server`（只能用 HTTP server）

#### **优化建议：**

```javascript
// 1. 启用 Edge Caching
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 缓存静态页面
    const cacheKey = new Request(url.toString(), request);
    const cache = caches.default;

    let response = await cache.match(cacheKey);
    if (response) {
      return response;
    }

    // SSR 渲染
    response = await handleAsNodeRequest(8080, request);

    // 缓存 HTML（根据需要调整）
    if (response.ok) {
      response = new Response(response.body, response);
      response.headers.set('Cache-Control', 's-maxage=300');
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  }
};

// 2. 访问 Cloudflare 特性
app.use(async (ctx, next) => {
  // 通过 req.cloudflare 访问 CF 属性
  const country = ctx.req.cloudflare?.cf?.country;
  const ip = ctx.req.socket?.remoteAddress;

  console.log(`Request from ${country}, IP: ${ip}`);
  await next();
});

// 3. 使用 D1 数据库
export default {
  async fetch(request, env, ctx) {
    // 将 env 传递给 Koa
    request.cloudflare.env = env;
    return handleAsNodeRequest(8080, request);
  }
};

app.use(async (ctx) => {
  const db = ctx.req.cloudflare.env.DB;
  const results = await db.prepare('SELECT * FROM users').all();
  ctx.body = results;
});
```

### 9️⃣ **与传统 Node.js 的主要区别**

| 特性     | 传统 Node.js | Cloudflare Workers   |
| -------- | ------------ | -------------------- |
| 端口监听 | 真实网络端口 | 逻辑路由标识符       |
| 文件系统 | 完整 fs 访问 | 虚拟 fs（内存/只读） |
| 进程模型 | 长期运行     | 按请求启动           |
| 连接管理 | 手动管理     | 自动处理             |
| 环境变量 | process.env  | env 对象             |

---

## 总结

现在部署 Koa + React SSR 到 Cloudflare Workers 非常简单：

1. **启用 Node.js 兼容性标志**
2. **使用 `httpServerHandler` 包装 Koa 应用**
3. **调整 Webpack 配置为 `webworker` target**
4. **使用 Workers Sites 或 R2 托管静态资源**
5. **部署！**

大部分现有代码都可以**直接运行**，几乎不需要改动！需要我帮你处理具体的迁移细节吗？
