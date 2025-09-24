import { html, raw } from "hono/html";
import css from "./monospace-web.css" with { type: "text" };
// this css *should* be bundled in as a string
//
// we can fall back to reading the file, but not sure how the bundler handles that.
// adding `?inline` did not work
import resetCSS from "./reset.css" with { type: "text" };

// biome-ignore lint/suspicious/noExplicitAny: this is how children type works in hono/jsx
type SiteData = { children?: any };

export const Layout = (props: SiteData) =>
  html`<!doctype html>
      <html>
        <head>
          <title>Fibeprlane MCP Gateway</title>
          <style>${raw(resetCSS)}</style>
          <style>${raw(css)}</style>
        </head>
        <body>
          ${props.children}
        </body>
      </html>`;
