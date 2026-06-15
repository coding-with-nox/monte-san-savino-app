import { Elysia } from "elysia";
import { logger } from "./logger";

export const loggerMiddleware = new Elysia({ name: "logger" })
  .decorate("rootLogger", logger)

  .derive(({ request, rootLogger }) => {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);

    const log = rootLogger.child({
      requestId,
      method: request.method,
      path: url.pathname,
    });

    (request as any).__startTime = performance.now();

    return { log, requestId };
  })

  .onAfterResponse(({ request, set, log }) => {
    const duration = Math.round(
      performance.now() - ((request as any).__startTime ?? 0)
    );
    const status = (set.status as number) ?? 200;
    const url = new URL(request.url);
    const path = url.pathname;
    const activeLog = log ?? logger;

    // Health check at debug level to avoid spam
    if (path === "/health") {
      activeLog.debug({ status, durationMs: duration }, `${request.method} ${path} ${status} ${duration}ms`);
      return;
    }

    const msg = `${request.method} ${path} ${status} ${duration}ms`;

    if (status >= 500) {
      activeLog.error({ status, durationMs: duration }, msg);
    } else if (status >= 400) {
      activeLog.warn({ status, durationMs: duration }, msg);
    } else {
      activeLog.info({ status, durationMs: duration }, msg);
    }
  })

  .onError(({ request, error, code, log }) => {
    const url = new URL(request.url);
    const msg = "message" in error ? error.message : String(error);
    const activeLog = log ?? logger;
    activeLog.error(
      {
        err: error,
        errorCode: code,
      },
      `Error handling ${request.method} ${url.pathname}: ${msg}`
    );
  })

  .as("scoped");
