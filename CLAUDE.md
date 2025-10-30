# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a custom React SSR (Server-Side Rendering) implementation built as an alternative to Next.js. The project aims to provide better control, performance, stability, and extensibility compared to Next.js for large-scale applications.

**Key motivations for custom SSR:**

- Performance: Faster cold start times compared to Next.js 12+ (targeting <100ms vs 4s+)
- Stability: Built-in service degradation (SSR → CSR fallback) when Node.js crashes
- Security: Control over CVE patches without waiting for framework updates
- Extensibility: Full control over middleware, rendering pipeline, and deployment targets
- Maintainability: Avoiding Next.js breaking changes and closed-source features

## Development Commands

### Running the Application

```bash
# Development mode with hot reload
pnpm dev

# Mock API server (runs on port 8007)
pnpm mock
```

### Building

```bash
# Local build
pnpm build

# Environment-specific builds
pnpm build:online   # Production
pnpm build:beta     # Beta environment
pnpm build:test1    # Test environment
```

### Deployment

```bash
# Start with PM2 (uses ecosystem.config.js)
pnpm start
```

The PM2 configuration runs the server on port 3009 in cluster mode.

## Architecture

### Dual Build System

The project uses Webpack to create **two separate bundles**:

1. **Client Bundle** (`app/client/index.tsx`)

   - Entry: `app/client/index.tsx`
   - Target: Browser (browserslist)
   - Output: `build/client/`
   - Handles hydration using `hydrateRoot` for SSR or `createRoot` for CSR fallback
   - Public path: `/static/client/`

2. **Server Bundle** (`app/server/`)
   - Entry points: `app/server/server.ts` (Node.js) or `app/server/serverless.ts` (Lambda/Cloudflare)
   - Target: Node.js
   - Output: `build/server.js` or `build/serverless.js`
   - Externals: Node modules are externalized via `webpack-node-externals`

### SSR Flow

The SSR pipeline follows these steps:

1. **Route Matching** (`app/server/index.tsx:15-48`)

   - Koa router captures all requests with `router.get("(.*)")`
   - Routes are matched using `react-router-dom`'s `matchRoutes()`

2. **Data Prefetching** (`app/server/app.tsx:16-35`)

   - Routes define `queryKey` and `loadData` properties
   - `@tanstack/react-query` prefetches data server-side via `queryClient.prefetchQuery()`
   - Dehydrated state is serialized for client rehydration

3. **Server Rendering** (`app/server/stream/response.ts`)

   - Uses React 18's `renderToPipeableStream` for streaming SSR
   - HTML template is split into start/end chunks for progressive rendering
   - Helmet manages `<head>` tags (meta, title, etc.)
   - `@loadable/server`'s ChunkExtractor collects code-split chunks

4. **Client Hydration** (`app/client/index.tsx:70-78`)
   - Checks `#__APP_FLAG__` to determine SSR vs CSR mode
   - If SSR: Uses `loadableReady()` then `hydrateRoot()`
   - If CSR fallback: Uses `createRoot().render()`
   - Reads `#__REACT_QUERY_STATE__` to rehydrate query cache

### Code Splitting & Lazy Loading

- **Route-based splitting**: Routes use `@loadable/component` for lazy loading
  ```tsx
  const Home = loadable(() => import("pages/Home"), null);
  ```
- **Chunk extraction**: `@loadable/server` tracks which chunks are needed per request
- **Stats file**: `build/loadable-stats.json` maps chunks to files for SSR

### Route Configuration

Routes are defined in `src/routes/index.tsx` with a custom `PreFetchRouteObject` type that extends React Router's route config:

```tsx
interface PreFetchRouteObject {
  path: string;
  element: JSX.Element;
  queryKey?: string[]; // React Query key for prefetching
  loadData?: (params) => Promise<any>; // Data fetching function
}
```

**Adding a new route:**

1. Create the page component in `src/pages/`
2. Add the route to `src/routes/index.tsx`
3. If the route needs data, define `queryKey` and `loadData`
4. The loadData function receives route params and should return a promise

### Module Resolution

- **Base path**: `./src` (set in `tsconfig.json` and webpack config)
- **Alias**: `@app/*` maps to `../app/*`
- Uses `tsconfig-paths-webpack-plugin` for webpack resolution

### Styling

- **CSS/Less**: Module CSS (`.module.less`) and global styles supported
- **Tailwind**: Configured via `tailwind.config.js` and PostCSS
- **MiniCssExtractPlugin**: Extracts CSS into separate files for production
- **Server bundle**: All styles are ignored (uses `ignore-loader`)

### Deployment Targets

The build system supports multiple deployment targets:

1. **Traditional Node.js server** (local/online/beta)

   - Entry: `app/server/server.ts`
   - Uses Koa + koa-static for serving assets
   - Deployed with PM2

2. **Serverless** (AWS Lambda, Cloudflare Workers)
   - Entry: `app/server/serverless.ts`
   - Compatible with `@vendia/serverless-express` and `serverless-http`
   - Configured via environment variables in `config/env/`

### Service Degradation

The client checks `#__APP_FLAG__` to detect if SSR succeeded:

- If `isSSR: true` → Hydrate the server-rendered HTML
- If `isSSR: false` → Fall back to CSR with `createRoot()`

This enables graceful degradation when the server fails to render.

## React Compiler

The project uses React 19.2 with the experimental React Compiler (`babel-plugin-react-compiler`) enabled in the Babel configuration. This automatically optimizes React components by memoizing expensive computations.

## Important Technical Details

### Webpack Configuration

- **Cache**: Filesystem cache enabled for faster rebuilds
- **Thread-loader**: Uses 3 workers for parallel transpilation
- **ESLint**: Runs in threads, lints only dirty modules in dev mode
- **Environment variables**: Injected via `EnvironmentPlugin` from `config/env/{goal}.js`

### Path Structure

```
app/
  ├── client/         # Client entry & hydration logic
  ├── server/         # SSR server (Koa + React rendering)
  └── utils/          # Shared utilities (loadable, context, etc.)
src/
  ├── pages/          # React page components
  ├── routes/         # Route definitions with data prefetching
  └── apis/           # API services & models
config/
  ├── webpack.*.js    # Webpack configurations
  └── env/            # Environment-specific variables
build/                # Output directory (client + server bundles)
```

### React Query Integration

- Query keys are defined in `src/apis/queryKeys.ts`
- Services in `src/apis/services/` implement data fetching
- The server prefetches queries matching the current route
- Dehydrated state is stringified and injected into `#__REACT_QUERY_STATE__`

### Helmet for SEO

- `react-helmet-async` manages dynamic `<head>` tags
- Server extracts helmet context and injects tags into HTML template
- Supports TDK (Title, Description, Keywords), Open Graph, structured data

## Known Constraints

- Styles and assets are ignored in the server bundle (use CSS-in-JS cautiously)
- The build distinguishes between `online`/`beta` (traditional server) and other environments (serverless) when choosing entry points
- PM2 watches the `./build` directory for changes in production
