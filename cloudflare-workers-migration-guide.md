# React + Koa SSR 应用迁移到 Cloudflare Workers 完整指南



### 改动 1: 创建 Worker 入口文件

**原来的 `src/server.js`（Koa + Node.js）：**
```javascript
const Koa = require('koa');
const Router = require('@koa/router');
const { renderToString } = require('react-dom/server');
const App = require('./App');

const app = new Koa();
const router = new Router();

router.get('/(.*)', async (ctx) => {
  const html = renderToString(<App />);
  ctx.body = `<!DOCTYPE html>...${html}...`;
});

app.use(router.routes());

// Node.js 启动方式
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

**新的 `src/worker.js`（Workers 兼容）：**
```javascript
import Koa from 'koa';
import Router from '@koa/router';
import { createServer } from 'node:http';  // 🆕 使用 Node.js HTTP
import { httpServerHandler } from 'cloudflare:node';  // 🆕 Workers 集成
import { renderToString } from 'react-dom/server';
import App from './App';

const app = new Koa();
const router = new Router();

// ✅ 路由逻辑基本不变
router.get('/(.*)', async (ctx) => {
  const appHtml = renderToString(<App url={ctx.url} />);
  
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
  ctx.type = 'text/html';
});

app.use(router.routes());
app.use(router.allowedMethods());

// 🆕 使用 HTTP Server 代替直接监听端口
const server = createServer(app.callback());
server.listen(8080);  // 端口号只是标识符，不是真实端口

// 🆕 必须：导出为 Workers handler（ESM 格式）
export default httpServerHandler({ port: 8080 });
```

**关键改动点：**
1. ✅ 使用 ESM `import/export`（不是 CommonJS `require/module.exports`）
2. ✅ 使用 `createServer` + `httpServerHandler` 包装 Koa
3. ✅ 必须 `export default` 导出
4. ✅ 静态资源路径改为 `/static/`（由 Workers Sites 托管）

---


**创建 `webpack.worker.config.js`：**
```javascript
const path = require('path');

module.exports = {
  // ========== 关键：Workers 环境 ==========
  target: 'webworker',  // 必须！
  
  entry: './src/worker.js',
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'worker.js',
    
    // ========== 关键：ESM 格式 ==========
    library: {
      type: 'module',  // 必须！
    },
  },
  
  experiments: {
    outputModule: true,  // 启用 ESM 输出
  },
  
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    // 不需要 fallback，Workers 支持 Node.js APIs
  },
  
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: { chrome: '120' },
                modules: false,  // 保持 ESM
              }],
              '@babel/preset-react'
            ]
          }
        }
      },
      
      // CSS 处理：转为字符串
      {
        test: /\.css$/,
        type: 'asset/source',
      },
      
      // 图片：转为 base64
      {
        test: /\.(png|jpg|gif|svg)$/,
        type: 'asset/inline',
      }
    ]
  },
  
  optimization: {
    minimize: true,  // 压缩（控制体积 < 1MB）
    usedExports: true,
  },
  
  mode: 'production',
  devtool: false,
};
```

#

## 5️⃣ Cloudflare 配置

### 创建 `wrangler.toml`

```toml
name = "my-react-ssr-app"           # 项目名称（全局唯一）
main = "dist/worker.js"             # Worker 入口文件
compatibility_date = "2025-10-29"   # 兼容性日期

# ========== 关键：启用 Node.js 兼容性 ==========
compatibility_flags = [
  "nodejs_compat",                   # 启用 Node.js APIs
  "enable_nodejs_http_server_modules"  # 启用 HTTP Server
]

# ========== 静态资源配置 ==========
[site]
bucket = "./dist/public"  # 客户端产物目录

# ========== 环境变量（可选）==========
[vars]
NODE_ENV = "production"

# ========== 数据库（可选）==========
# [[d1_databases]]
# binding = "DB"
# database_name = "my-database"
# database_id = "xxxxx"

# ========== R2 存储（可选）==========
# [[r2_buckets]]
# binding = "ASSETS"
# bucket_name = "my-assets"
```

---

## 6️⃣ package.json 更新

### 更新构建脚本

```json
{
  "name": "my-react-ssr-app",
  "version": "1.0.0",
  "type": "module",  // 🆕 声明为 ESM 项目
  "scripts": {
    "build:client": "webpack --config webpack.client.config.js",
    "build:worker": "webpack --config webpack.worker.config.js",
    "build": "npm run build:client && npm run build:worker",
    
    "dev": "wrangler dev",
    "deploy": "npm run build && wrangler deploy",
    "deploy:dry": "npm run build && wrangler deploy --dry-run",
    
    "preview": "npm run build && wrangler deploy --dry-run --outdir preview"
  },
  "dependencies": {
    "koa": "^2.15.0",
    "@koa/router": "^12.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@babel/core": "^7.23.0",
    "@babel/preset-env": "^7.23.0",
    "@babel/preset-react": "^7.22.0",
    "babel-loader": "^9.1.3",
    "css-loader": "^6.8.0",
    "style-loader": "^3.3.0",
    "webpack": "^5.89.0",
    "webpack-cli": "^5.1.0",
    "wrangler": "^3.78.0"
  }
}
```

---

## 7️⃣ 部署流程

### Step 1: 初始化 Wrangler

```bash
# 如果还没登录
wrangler login

# 查看账户信息
wrangler whoami
```

### Step 2: 构建项目

```bash
npm run build
```

**检查产物：**
```bash
ls -lh dist/
# 应该看到：
# - worker.js (< 1MB)
# - public/bundle.js
# - public/styles.css
```

### Step 3: 本地测试

```bash
npm run dev
# 访问 http://localhost:8787
```

### Step 4: 部署到生产

```bash
npm run deploy
```

**预览部署（不实际上线）：**
```bash
npm run deploy:dry
```

### Step 5: 验证部署

```bash
# 部署后会得到一个 URL，例如：
# https://my-react-ssr-app.your-subdomain.workers.dev

curl https://your-worker.workers.dev
```

---

## 8️⃣ 注意事项和限制

### ✅ 支持的特性

| 特性 | 原生 Node.js | Cloudflare Workers |
|------|--------------|-------------------|
| Koa/Express | ✅ | ✅（需适配） |
| React SSR | ✅ | ✅ |
| `fs`, `path`, `crypto` | ✅ | ✅（虚拟 fs） |
| HTTP Server | ✅ | ✅（需 flag） |
| 环境变量 | ✅ | ✅（通过 env） |
| 数据库 | ✅ | ✅（D1/Hyperdrive） |

### ⚠️ 限制和差异
