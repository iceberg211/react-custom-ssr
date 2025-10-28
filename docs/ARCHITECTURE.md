# React Custom SSR 架构流程图

## 整体架构概览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            React Custom SSR 架构                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────── 开发阶段 ────────────────────┐  ┌──────────── 生产阶段 ────────────┐
│                                                  │  │                                 │
│  npm run dev                                     │  │  npm run build:online/beta      │
│       │                                          │  │         │                       │
│       ├──▶ scripts/dev.js                       │  │         └──▶ webpack.prod.js    │
│       │         │                                │  │                                 │
│       │         ├──▶ Webpack Server Compiler    │  │                                 │
│       │         │    (watch mode)                │  │                                 │
│       │         │                                │  │                                 │
│       │         └──▶ Express HMR Server         │  │                                 │
│       │              (port: 8099)                │  │                                 │
│       │              - webpack-dev-middleware   │  │                                 │
│       │              - webpack-hot-middleware   │  │                                 │
│       │                                          │  │                                 │
│       └──▶ nodemon build/server.js              │  │  npm start → pm2               │
│            (port: 3001)                          │  │                                 │
│                                                  │  │                                 │
└──────────────────────────────────────────────────┘  └─────────────────────────────────┘
```

## 详细构建流程

### 1. Webpack 构建配置 (config/webpack.config.js)

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                          Webpack 构建配置架构                                        │
└────────────────────────────────────────────────────────────────────────────────────┘

webpack.config.js (基础配置)
│
├─▶ Client 构建配置
│   ├── Entry: app/client/index.tsx
│   ├── Output: build/client/
│   │   ├── js/[name].[contenthash].main.js
│   │   ├── js/[name].[contenthash].chunk.js
│   │   └── css/[contenthash].css
│   │
│   ├── Loaders
│   │   ├── babel-loader (tsx/ts/jsx/js)
│   │   ├── thread-loader (多线程编译)
│   │   ├── css-loader + postcss-loader
│   │   ├── less-loader (支持 CSS Modules)
│   │   ├── @svgr/webpack (SVG 转 React 组件)
│   │   └── asset/resource (图片/字体)
│   │
│   └── Plugins
│       ├── @loadable/webpack-plugin
│       │   └── 生成 loadable-stats.json
│       ├── WebpackManifestPlugin
│       ├── MiniCssExtractPlugin
│       ├── HtmlWebpackPlugin (生产环境)
│       ├── TerserPlugin (代码压缩)
│       ├── CssMinimizerPlugin (CSS 压缩)
│       └── Code Splitting 配置
│
└─▶ Server 构建配置
    ├── Entry:
    │   ├── server: app/server/server.ts (Koa服务器)
    │   └── serverless: app/server/serverless.ts (Lambda)
    │
    ├── Output: build/
    │   ├── server.js (Koa 版本)
    │   └── serverless.js (Serverless 版本)
    │
    ├── Target: node
    ├── ExternalsPresets: { node: true }
    │
    └── Loaders
        └── ignore-loader (忽略 CSS/图片等静态资源)
```

### 2. 构建产物结构

```
build/
├── client/                          # 客户端构建产物
│   ├── js/
│   │   ├── client.[hash].main.js   # 客户端入口
│   │   ├── runtime.[hash].js        # Webpack runtime
│   │   └── [name].[hash].chunk.js  # 代码分割块
│   ├── css/
│   │   └── [hash].css               # 样式文件
│   ├── media/                       # 静态资源
│   └── manifest.json                # 资源清单
│
├── server.js                        # Koa 服务器入口
├── serverless.js                    # Serverless 入口
└── loadable-stats.json              # Loadable 统计信息
```

## 服务端渲染流程

### 3. 请求处理流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        服务端渲染 (SSR) 流程详解                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

HTTP Request
    │
    ├─▶ app/server/server.ts
    │   └─▶ Koa Server (port: 3001)
    │       └─▶ Static Files: /static → build/
    │
    ├─▶ Router.get('(.*)') → app/server/index.tsx
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│  1. 初始化阶段                                                │
│  ─────────────────────────────────────────────────────────  │
│  ① 创建 ChunkExtractor                                       │
│     - 读取 loadable-stats.json                              │
│     - 用于收集需要加载的代码块                                │
│                                                              │
│  ② 创建 QueryClient                                          │
│     - React Query 客户端实例                                 │
│     - 用于数据预取和状态管理                                  │
│                                                              │
│  ③ 写入 HTML 起始标签                                        │
│     ctx.res.write(start)  // "<!DOCTYPE html><html "        │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│  2. 数据预取阶段 (app/server/app.tsx - prefetch)            │
│  ─────────────────────────────────────────────────────────  │
│  ① 路由匹配                                                  │
│     matchRoutes(routes, ctx.req.url)                        │
│                                                              │
│  ② 并行数据预取                                              │
│     routes.forEach(route => {                               │
│       if (route.queryKey && route.loadData) {               │
│         queryClient.prefetchQuery({                         │
│           queryKey: route.queryKey,                         │
│           queryFn: () => route.loadData(params)             │
│         })                                                  │
│       }                                                      │
│     })                                                       │
│                                                              │
│  ③ 等待所有预取完成                                          │
│     await Promise.allSettled(promises)                      │
│                                                              │
│  ④ 序列化状态                                                │
│     dehydratedState = dehydrate(queryClient)                │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│  3. React 组件渲染阶段 (app/server/app.tsx - renderApp)     │
│  ─────────────────────────────────────────────────────────  │
│  ① 构建 React 组件树                                         │
│     <StaticRouter location={ctx.req.url}>                   │
│       <HelmetProvider context={helmetContext}>              │
│         <QueryClientProvider client={queryClient}>          │
│           <HydrationBoundary state={dehydratedState}>       │
│             <App context={ctx} />                           │
│           </HydrationBoundary>                              │
│         </QueryClientProvider>                              │
│       </HelmetProvider>                                     │
│     </StaticRouter>                                         │
│                                                              │
│  ② ChunkExtractor 收集代码块                                 │
│     jsx = extractor.collectChunks(reactTree)                │
│     - 识别需要的 JavaScript 文件                             │
│     - 识别需要的 CSS 文件                                    │
│                                                              │
│  ③ 返回渲染结果                                              │
│     { jsx, helmetContext }                                  │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│  4. 流式响应阶段 (app/server/stream/response.ts)            │
│  ─────────────────────────────────────────────────────────  │
│  renderToPipeableStream(jsx, {                              │
│                                                              │
│    ① onShellReady() {                                       │
│      // HTML Shell 准备就绪                                 │
│      ctx.res.write(getStartTemplate({                       │
│        helmetContext,  // SEO 元数据                        │
│        extractor       // CSS/JS 链接                       │
│      }))                                                     │
│                                                              │
│      输出:                                                   │
│      ┌────────────────────────────────────────────┐         │
│      │ <html lang="...">                          │         │
│      │ <head>                                     │         │
│      │   <meta charset="utf-8">                   │         │
│      │   <meta name="viewport"...>                │         │
│      │   <title>...</title>                       │         │
│      │   <link rel="stylesheet" href="...">       │         │
│      │   <link rel="preload" href="...">          │         │
│      │ </head>                                    │         │
│      │ <body>                                     │         │
│      │   <div id="root">                          │         │
│      └────────────────────────────────────────────┘         │
│    }                                                         │
│                                                              │
│    ② onAllReady() {                                         │
│      // 所有内容渲染完成                                     │
│      pipe(ctx.res)  // 流式输出 React 内容                   │
│                                                              │
│      ctx.res.end(getEndTemplate({                           │
│        dehydratedState,  // 序列化的查询状态                 │
│        extractor         // JS 脚本标签                     │
│      }))                                                     │
│                                                              │
│      输出:                                                   │
│      ┌────────────────────────────────────────────┐         │
│      │   </div>                                   │         │
│      │   <script id="__APP_FLAG__">              │         │
│      │     {"isSSR": true}                        │         │
│      │   </script>                                │         │
│      │   <script id="__REACT_QUERY_STATE__">     │         │
│      │     { ...dehydratedState }                 │         │
│      │   </script>                                │         │
│      │   <script src="/static/client/js/...">    │         │
│      │   <noscript>...</noscript>                 │         │
│      │ </body>                                    │         │
│      │ </html>                                    │         │
│      └────────────────────────────────────────────┘         │
│    }                                                         │
│                                                              │
│    ③ onShellError / onError                                 │
│      // 错误处理                                             │
│  })                                                          │
│                                                              │
│  ④ 清理                                                      │
│     queryClient.clear()                                     │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
Response to Client (完整 HTML)
```

## 客户端激活流程

### 4. 客户端 Hydration

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        客户端激活 (Hydration) 流程                                │
└─────────────────────────────────────────────────────────────────────────────────┘

浏览器接收 HTML
    │
    ├─▶ 解析 HTML
    │   ├── 渲染服务端生成的内容 (可见)
    │   └── 下载资源
    │       ├── CSS 文件 (立即应用样式)
    │       ├── JS 文件 (按 preload 顺序)
    │       └── 静态资源
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│  app/client/index.tsx 执行                                   │
│  ─────────────────────────────────────────────────────────  │
│  ① 提取服务端状态                                            │
│     - 从 #__REACT_QUERY_STATE__ 获取数据状态                │
│     - 从 #__APP_FLAG__ 获取 SSR 标识                        │
│                                                              │
│  ② 创建 QueryClient                                         │
│     const queryClient = new QueryClient({...})              │
│                                                              │
│  ③ 构建客户端组件树                                          │
│     <BrowserRouter>                                         │
│       <HelmetProvider>                                      │
│         <QueryClientProvider client={queryClient}>         │
│           <HydrationBoundary state={dehydratedState}>      │
│             <App />                                         │
│           </HydrationBoundary>                             │
│         </QueryClientProvider>                             │
│       </HelmetProvider>                                    │
│     </BrowserRouter>                                       │
│                                                              │
│  ④ Hydrate/Mount                                            │
│     if (isSSR) {                                            │
│       loadableReady(() => {                                 │
│         hydrateRoot(root, <ClientApp />)                    │
│       })                                                    │
│     } else {                                                │
│       createRoot(root).render(<ClientApp />)                │
│     }                                                        │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│  React 接管页面                                              │
│  ─────────────────────────────────────────────────────────  │
│  ① Hydrate 过程                                             │
│     - 对比服务端 HTML 和客户端 React 树                      │
│     - 复用已有 DOM 节点                                      │
│     - 绑定事件监听器                                         │
│                                                              │
│  ② 恢复状态                                                  │
│     - React Query 恢复预取的数据                            │
│     - 不需要重新请求 API                                     │
│                                                              │
│  ③ 代码分割加载                                              │
│     - @loadable/component 按需加载路由组件                   │
│     - 用户导航时动态加载其他页面                              │
│                                                              │
│  ④ 交互就绪                                                  │
│     - 页面完全可交互                                         │
│     - 后续导航由客户端路由接管                                │
└──────────────────────────────────────────────────────────────┘
```

## 关键技术点

### 5. 代码分割与懒加载

```
┌─────────────────────────────────────────────────────────────┐
│  @loadable/component 工作流程                                │
│  ──────────────────────────────────────────────────────────│
│                                                              │
│  构建时:                                                     │
│  ├─▶ @loadable/babel-plugin                                 │
│  │   └─▶ 转换动态 import 为 loadable 调用                    │
│  │                                                           │
│  ├─▶ @loadable/webpack-plugin                               │
│  │   └─▶ 生成 loadable-stats.json                           │
│  │       ├── 每个 chunk 的文件名                             │
│  │       ├── 依赖关系                                        │
│  │       └── 路径映射                                        │
│  │                                                           │
│  服务端:                                                     │
│  ├─▶ ChunkExtractor                                         │
│  │   └─▶ 读取 loadable-stats.json                           │
│  │       ├── collectChunks(jsx)                             │
│  │       ├── 识别需要的代码块                                │
│  │       └─▶ getScriptTags() / getLinkTags()                │
│  │                                                           │
│  客户端:                                                     │
│  └─▶ loadableReady()                                        │
│      └─▶ 等待所有 preload 的 chunk 加载完成                  │
│          └─▶ hydrateRoot()                                  │
└─────────────────────────────────────────────────────────────┘
```

### 6. 数据预取机制

```
┌─────────────────────────────────────────────────────────────┐
│  数据预取 (Data Prefetching) 流程                            │
│  ──────────────────────────────────────────────────────────│
│                                                              │
│  路由配置 (src/routes/index.tsx):                           │
│  {                                                           │
│    path: ":locales/home",                                   │
│    element: <Home />,                                       │
│    queryKey: [PrefetchKeys.HOME],     ← 查询键              │
│    loadData: HomeService.getList      ← 数据加载函数         │
│  }                                                           │
│                                                              │
│  ├─▶ 服务端:                                                │
│  │   ① matchRoutes(routes, url) 匹配路由                    │
│  │   ② 并行预取所有匹配路由的数据                            │
│  │   ③ queryClient.prefetchQuery()                         │
│  │   ④ dehydrate(queryClient) 序列化                       │
│  │   ⑤ 注入到 HTML: <script id="__REACT_QUERY_STATE__">    │
│  │                                                           │
│  └─▶ 客户端:                                                │
│      ① 从 HTML 提取 dehydratedState                         │
│      ② <HydrationBoundary state={dehydratedState}>         │
│      ③ React Query 自动恢复缓存                             │
│      ④ 组件直接使用缓存数据,无需重新请求                      │
└─────────────────────────────────────────────────────────────┘
```

### 7. 热更新 (HMR) 机制

```
┌─────────────────────────────────────────────────────────────┐
│  开发环境热更新 (Hot Module Replacement)                     │
│  ──────────────────────────────────────────────────────────│
│                                                              │
│  scripts/dev.js                                             │
│  ├─▶ Express Server (port: 8099)                           │
│  │   ├── webpack-dev-middleware                            │
│  │   │   ├── 内存编译 (不写磁盘)                             │
│  │   │   └── 拦截静态资源请求                                │
│  │   │                                                      │
│  │   └── webpack-hot-middleware                            │
│  │       ├── 建立 WebSocket 连接                            │
│  │       └── 推送更新通知                                    │
│  │                                                          │
│  ├─▶ Server Compiler (watch mode)                          │
│  │   └─▶ 监听服务端代码变化                                 │
│  │       └─▶ 重新编译 build/server.js                       │
│  │                                                          │
│  └─▶ nodemon                                               │
│      └─▶ 监听 build/server.js                              │
│          └─▶ 文件变化时重启 Koa 服务器                       │
│                                                              │
│  浏览器端:                                                   │
│  ├─▶ HotModuleReplacementPlugin                            │
│  ├─▶ ReactRefreshWebpackPlugin                            │
│  │   └─▶ React Fast Refresh                                │
│  │       ├── 保持组件状态                                   │
│  │       └── 即时更新界面                                   │
│  │                                                          │
│  └─▶ webpack-hot-middleware/client                         │
│      ├── 连接到 ws://localhost:8099/ws                      │
│      ├── 接收更新通知                                        │
│      └── 动态加载新模块                                      │
└─────────────────────────────────────────────────────────────┘
```

## 环境差异对比

### 8. 开发环境 vs 生产环境

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        环境配置差异                                        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  开发环境 (webpack.dev.js)                                                │
│  ├── Mode: development                                                   │
│  ├── Devtool: eval-source-map (完整调试信息)                              │
│  ├── Output:                                                             │
│  │   ├── filename: js/[name].js                                          │
│  │   └── chunkFilename: js/[name].chunk.js                               │
│  ├── 热更新                                                               │
│  │   ├── HotModuleReplacementPlugin                                      │
│  │   └── ReactRefreshWebpackPlugin                                       │
│  ├── 循环依赖检测: CircularDependencyPlugin                               │
│  └── 不压缩代码                                                           │
│                                                                           │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  生产环境 (webpack.prod.js)                                               │
│  ├── Mode: production                                                    │
│  ├── Devtool: false (无 sourcemap)                                       │
│  ├── Output:                                                             │
│  │   ├── filename: js/[name].[contenthash:8].main.js                     │
│  │   ├── chunkFilename: js/[name].[contenthash:8].chunk.js               │
│  │   └── assetModuleFilename: media/[contenthash:8][ext]                 │
│  ├── 代码压缩                                                             │
│  │   ├── TerserPlugin (JS 压缩)                                          │
│  │   └── CssMinimizerPlugin (CSS 压缩)                                   │
│  ├── Code Splitting                                                      │
│  │   ├── runtime chunk                                                   │
│  │   ├── vendor chunks                                                   │
│  │   └── common chunks                                                   │
│  ├── HtmlWebpackPlugin                                                   │
│  │   └── HTML 压缩                                                        │
│  └── 资源哈希化 (长期缓存)                                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

## 部署架构

### 9. 部署选项

```
┌─────────────────────────────────────────────────────────────┐
│  部署模式                                                     │
│  ──────────────────────────────────────────────────────────│
│                                                              │
│  选项 1: 传统服务器部署 (Koa)                                │
│  ├── 构建: npm run build:online                             │
│  ├── 产物: build/server.js                                  │
│  ├── 启动: pm2 start ecosystem.config.js                    │
│  └── 架构:                                                   │
│      Nginx (Reverse Proxy)                                  │
│         │                                                    │
│         ├─▶ /static/* → Nginx 静态文件服务                   │
│         │               (build/client/)                      │
│         │                                                    │
│         └─▶ /* → Koa Server (port: 3001)                    │
│                  └─▶ SSR 渲染                                │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  选项 2: Serverless 部署 (Lambda + CloudFront)               │
│  ├── 构建: npm run build:online                             │
│  ├── 产物: build/serverless.js                              │
│  ├── 架构:                                                   │
│  │   CloudFront (CDN)                                       │
│  │      │                                                    │
│  │      ├─▶ /static/* → S3 (静态资源)                       │
│  │      │                                                    │
│  │      └─▶ /* → API Gateway → Lambda                      │
│  │                              └─▶ serverless.js           │
│  │                                   (serverless-http)      │
│  │                                                          │
│  └── 优势:                                                   │
│      ├── 自动扩缩容                                          │
│      ├── 按需付费                                            │
│      └── 全球分发 (CloudFront)                               │
└─────────────────────────────────────────────────────────────┘
```

## 性能优化策略

### 10. 优化技术栈

```
┌─────────────────────────────────────────────────────────────┐
│  性能优化清单                                                 │
│  ──────────────────────────────────────────────────────────│
│                                                              │
│  ✓ 服务端渲染 (SSR)                                          │
│    └─▶ 首屏快速渲染,SEO 友好                                 │
│                                                              │
│  ✓ 流式渲染 (Streaming SSR)                                 │
│    └─▶ renderToPipeableStream                               │
│        ├── 渐进式内容传输                                     │
│        └── 减少 TTFB (Time To First Byte)                   │
│                                                              │
│  ✓ 代码分割 (Code Splitting)                                │
│    ├─▶ @loadable/component 路由级懒加载                      │
│    ├─▶ Webpack splitChunks                                 │
│    │   ├── runtime chunk                                    │
│    │   ├── vendor chunks                                    │
│    │   └── common chunks                                    │
│    └─▶ 按需加载,减少初始包体积                                │
│                                                              │
│  ✓ 数据预取 (Data Prefetching)                              │
│    ├─▶ 服务端并行预取 API 数据                               │
│    ├─▶ React Query 缓存恢复                                 │
│    └─▶ 避免客户端瀑布请求                                    │
│                                                              │
│  ✓ 资源优化                                                  │
│    ├─▶ CSS 提取和压缩 (MiniCssExtractPlugin)                │
│    ├─▶ JS 压缩 (TerserPlugin)                               │
│    ├─▶ 图片优化 (asset/resource)                            │
│    ├─▶ SVG 转组件 (@svgr/webpack)                           │
│    └─▶ 资源哈希化 (长期缓存)                                 │
│                                                              │
│  ✓ 构建优化                                                  │
│    ├─▶ thread-loader (多线程编译)                           │
│    ├─▶ babel-loader cache                                  │
│    ├─▶ webpack cache (filesystem)                          │
│    └─▶ tree shaking                                        │
│                                                              │
│  ✓ 运行时优化                                                │
│    ├─▶ React 19 (最新性能优化)                              │
│    ├─▶ Suspense (异步组件)                                  │
│    └─▶ Helmet Async (异步 SEO)                              │
└─────────────────────────────────────────────────────────────┘
```

## 技术栈总览

```
┌─────────────────────────────────────────────────────────────┐
│  核心技术栈                                                   │
│  ──────────────────────────────────────────────────────────│
│                                                              │
│  前端框架:                                                   │
│  ├── React 19.1.0                                           │
│  ├── React Router 7.6.3                                     │
│  └── React Helmet Async 1.3.0                               │
│                                                              │
│  状态管理:                                                   │
│  └── @tanstack/react-query 5.83.0                          │
│                                                              │
│  服务端:                                                     │
│  ├── Koa 2.14.1                                             │
│  ├── @koa/router 12.0.0                                     │
│  └── serverless-http 3.2.0                                  │
│                                                              │
│  构建工具:                                                   │
│  ├── Webpack 5.78.0                                         │
│  ├── Babel 7.21.4                                           │
│  └── TypeScript 5.0.3                                       │
│                                                              │
│  SSR 相关:                                                   │
│  ├── @loadable/component 5.16.7 (代码分割)                  │
│  └── @loadable/server 5.16.7                                │
│                                                              │
│  样式:                                                       │
│  ├── Less 4.1.3                                             │
│  ├── PostCSS 7.2.4                                          │
│  └── Tailwind CSS 3.3.1                                     │
│                                                              │
│  开发工具:                                                   │
│  ├── webpack-dev-middleware (HMR)                           │
│  ├── webpack-hot-middleware                                 │
│  ├── React Refresh (Fast Refresh)                           │
│  └── nodemon 3.1.0                                          │
│                                                              │
│  部署:                                                       │
│  └── PM2 5.3.0                                              │
└─────────────────────────────────────────────────────────────┘
```

## 完整请求生命周期

```
┌───────────────────────────────────────────────────────────────────────────┐
│                      请求生命周期 (Request Lifecycle)                       │
└───────────────────────────────────────────────────────────────────────────┘

   用户访问 http://example.com/en/home
            │
            ▼
   ┌──────────────────────────────────┐
   │  1. DNS 解析 → 服务器 IP          │
   └──────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────┐
   │  2. Koa Server 接收请求           │
   │     router.get('(.*)')           │
   └──────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────┐
   │  3. 初始化                        │
   │     - ChunkExtractor             │
   │     - QueryClient                │
   │     - 写入 HTML 起始标签          │
   └──────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────┐
   │  4. 路由匹配                      │
   │     matchRoutes('/en/home')      │
   │     → { path: ':locales/home' }  │
   └──────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────┐
   │  5. 数据预取                      │
   │     queryClient.prefetchQuery({  │
   │       queryKey: [HOME],          │
   │       queryFn: getList           │
   │     })                           │
   │     → API 请求 (并行)             │
   └──────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────┐
   │  6. React 组件渲染                │
   │     renderApp() →                │
   │     <StaticRouter>               │
   │       <App>                      │
   │         <Home data={...} />      │
   │       </App>                     │
   │     </StaticRouter>              │
   └──────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────┐
   │  7. 流式响应                      │
   │     renderToPipeableStream()     │
   │     ├─▶ onShellReady             │
   │     │   └─▶ <head> + <body 起始>  │
   │     ├─▶ pipe()                   │
   │     │   └─▶ <div id="root">内容   │
   │     └─▶ onAllReady               │
   │         └─▶ </div> + scripts     │
   └──────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────┐
   │  8. 浏览器接收并解析 HTML         │
   │     - 渲染页面 (服务端内容可见)    │
   │     - 下载 CSS/JS                │
   └──────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────┐
   │  9. JavaScript 执行               │
   │     app/client/index.tsx         │
   │     ├─▶ 提取 dehydratedState     │
   │     └─▶ loadableReady()          │
   │         └─▶ hydrateRoot()        │
   └──────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────┐
   │  10. Hydration 完成               │
   │      - 事件绑定                   │
   │      - 状态恢复                   │
   │      - 页面可交互                 │
   └──────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────┐
   │  11. 用户交互                     │
   │      - 客户端路由导航              │
   │      - 动态加载组件                │
   │      - API 请求 (React Query)     │
   └──────────────────────────────────┘
```

---

## 总结

这个架构实现了一个**现代化的 React SSR 解决方案**,主要特点:

1. **首屏性能优化**: 通过 SSR + 流式渲染 + 数据预取,实现极快的首屏加载
2. **SEO 友好**: 服务端渲染完整 HTML,搜索引擎可直接抓取
3. **代码分割**: 按路由懒加载,减少初始包体积
4. **开发体验**: HMR + React Fast Refresh,即时反馈
5. **灵活部署**: 支持传统服务器和 Serverless 两种部署模式
6. **类型安全**: 全栈 TypeScript
7. **状态管理**: React Query 统一服务端/客户端数据流

这是一个生产级别的 SSR 架构,适合构建高性能的 React 应用。
