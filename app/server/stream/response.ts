import { renderToPipeableStream } from "react-dom/server";
import {
  getStartTemplate,
  getEndTemplate,
  StartTemplateProps,
  EndTemplateProps,
} from "../htmlTemplate";
import type { Context } from "koa";

const ABORT_DELAY = 10000;

export const response = (
  ctx: Context,
  jsx: React.ReactElement,
  startTemplate: StartTemplateProps,
  endTemplate: EndTemplateProps
) => {
  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(jsx, {
      onShellReady() {
        ctx.status = 200;
        ctx.res.write(getStartTemplate(startTemplate));
      },
      onAllReady() {
        clearTimeout(abortTimer);
        pipe(ctx.res);
        ctx.res.end(getEndTemplate(endTemplate));
        resolve(true);
      },
      onShellError(error) {
        console.error("Shell rendering error:", error);
        ctx.status = 500;
        clearTimeout(abortTimer);
        reject(false);
      },
      onError(error) {
        console.error("Stream rendering error:", error);
        ctx.status = 500;
        clearTimeout(abortTimer);
        reject(false);
      },
    });

    const abortTimer = setTimeout(() => {
      console.warn("SSR 流渲染超时，主动中断。", ctx.url);
      abort();
    }, ABORT_DELAY);

    ctx.res.on("close", () => {
      clearTimeout(abortTimer);
      abort();
    });
  });
};
