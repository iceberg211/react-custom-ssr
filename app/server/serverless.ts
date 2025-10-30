// import serverless from "serverless-http";
// import app, { router } from "./index";

// app.use(router.routes()).use(router.allowedMethods());

// export const handler = serverless(app);
import { createServer } from "node:http";
import { httpServerHandler } from "cloudflare:node";
import app, { router } from "./index";

app.use(router.routes()).use(router.allowedMethods());

const server = createServer(app.callback());
server.listen(8080);

// 导出为 Workers handler
export default httpServerHandler({ port: 8080 });
