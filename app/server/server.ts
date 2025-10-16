import path from "node:path";
import serve from "koa-static";
import moment from "koa-mount";
import app, { router } from "./index";

app.use(moment("/static", serve(path.resolve(__dirname, "./"))));
app.use(router.routes()).use(router.allowedMethods());

app.listen(process.env.PORT, () => {
  console.log(`Server is running on http://localhost:${process.env.PORT}`);
});
