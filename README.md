## 自定义 SSR

server side rendering（nextjs）

### SSR 解决了什么问题

1. 性能
2. SEO（tdk）q&a 面包屑，sitemap

### SSR 的核心

1. 路由定义
   https://nextjs.org/docs/app/getting-started/layouts-and-pages

2. 数据预取
   lru-cache：url+ body hash + query，axios 的拦截器
   swr
   App router
   fetch
   Pages router
   getServerSideProps

### 自定义 SSR

7 年前 CSR(CRA) 迁移 SSR

1. 性能：
   nextjs12+ 100ms+
   大型项目冷启动时间：4S+
2. 稳定性：nextjs 不支持服务降级，nodejs 挂掉 降级到 CSR
   nginx，lambda@edge
3. 安全
   https://nvd.nist.gov/vuln/detail/CVE-2025-29927
   https://nvd.nist.gov/vuln/detail/CVE-2024-34351
   https://nvd.nist.gov/vuln/detail/CVE-2024-34350

4. 扩展性
   nextjs 每次都是 breaking change，用新功能 用不了，SRI
   middleware 上下文不全

不支持 分布式渲染

5. 可控性

- nextjs 13 后逐渐闭源，新版本删除了很多我们在用的
- 安全问题 只在 vercel 修复
- 高级功能只能在 vercel 使用
- nextjs14 非常臃肿，server action、react server components

#### 自定义 SSR 需要考虑什么

1. 成本：
   学习成本：只关心 2 点（培训）
   迁移成本：人

2. 自己
   是否能 cover 住：
   1. 技术水平
   2. 推进落地能力
   3. feature 支持
   4. 更新迭代，react 19

### 自定义 SSR 原理

1. 应用的构建
   webpack：nodejs、browser
2. http 服务：（Koa）
   1. 应用启动：
      本地 dev: nodemon
      prod: serverless：aws lambda、cloudflare worker
   2. 渲染：
      1. 路由 koa-router、react-router-dom
         路由懒加载：@loadable/components
      2. jsx react 渲染：renderToPipeableStream、renderToReadableStream
      3. 水合 hydration：hydrateRoot
      4. TDK(head)：react-helmet-asyc
      5. 数据预取：react-query
   3. middleware

## serverless

aws ： lambda + Function URL
cloudflare worker

作业：

1. 自定义 SSR 升级到 react19.2
2. react compolier 用上
3. Profiler: https://react.dev/reference/dev-tools/react-performance-tracks
4. https://react.dev/reference/react/ViewTransition
