/**
 * from: https://github.com/w3cj/stoker/blob/f623a4e13f579111d938fbc1dbd526f564abda5d/src/middlewares/serve-emoji-favicon.ts#L3
 */

import type { MiddlewareHandler } from "hono";

export const serveEmojiFavicon = (emoji: string): MiddlewareHandler => {
  return async (c, next) => {
    if (c.req.path === "/favicon.ico") {
      c.res.headers.set("content-type", "image/svg+xml");
      return c.body(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" x="-0.1em" font-size="90">${emoji}</text></svg>`,
      );
    }
    return next();
  };
};
