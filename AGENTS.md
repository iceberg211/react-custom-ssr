# Repository Guidelines

本仓库为自定义 React SSR（Koa + React 19.2 + @loadable + React Query）方案，支持传统 Node 与 Cloudflare Workers 部署。请按下述规范协作。

## 项目结构与模块组织
- `app/client/`：客户端入口与水合逻辑。
- `app/server/`：SSR 服务端（`index.tsx` 路由、`server.ts` 传统服务、`serverless.ts` 无服务器）。
- `src/pages/`、`src/routes/`、`src/apis/`：页面、路由与数据层。
- `public/`：静态模板与资源；产物位于 `build/client/`，服务端产物为 `build/server.js` 或 `build/serverless.js`。
- `config/`：Webpack 与环境变量（`env/{goal}.js`）。

## 构建、测试与本地开发命令
- `pnpm dev`：本地开发。客户端 HMR（端口 8099），`nodemon` 监听 `build/server.js`（端口 3001）。
- `pnpm build`：本地打包（`--env goal=local`）。
- `pnpm build:online|beta|test1|cloudflare`：环境构建；online/beta 产出 `server.js`，其余为 `serverless.js`。
- `pnpm dev:wrangler`：Cloudflare 本地预览；`pnpm deploy:production`：构建并用 Wrangler 部署。
- `pnpm start`：PM2 启动；`pnpm mock`：启动 JSON Server（8007）。

## 代码风格与命名规范
- 语言：TypeScript + React 19；缩进 2 空格，单文件聚焦单职责。
- Lint：启用 ESLint（构建中 `failOnError=true`），提交前确保零 error。
- 命名：组件 `PascalCase.tsx`，hooks `useXxx.ts`，工具 `camelCase.ts`；样式模块使用 `*.module.less`，全局样式放 `src/index.css`。

## 测试规范
- 当前未内置测试命令；建议接入 Vitest + React Testing Library。
- 测试命名 `*.test.ts(x)` 与被测文件同目录；优先覆盖路由匹配、数据预取与模板注入。

## 提交与 Pull Request
- 提交遵循 Conventional Commits：`feat|fix|refactor|docs|chore|ci(scope): message`。
  例如：`feat(router): 支持通配路由预取`。
- PR 需包含：变更背景与目的、主要改动点、关联 Issue、验证步骤（含命令与端口）、UI 变更请附截图。

## 安全与配置提示（可选）
- 环境变量经 `config/env/{goal}.js` 注入；静态资源挂载于 `/static`（见 `app/server/server.ts`）。
- 勿提交密钥与私有配置；勿直接修改 `build/` 产物。
- 新增路由请同步更新 `src/routes/index.tsx`，必要时补充 `docs/` 与示例数据。

