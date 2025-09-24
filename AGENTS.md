
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";

// import .css files directly and it works
import './index.css';

import { createRoot } from "react-dom/client";

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.

# Repository Guidelines

## Project Structure & Module Organization
- `src/` hosts the TypeScript sources: `server.ts` exposes the Hono gateway, `run.ts` wires the CLI, and `index.ts` is reserved for library exports.
- `bin/cli.ts` is the Bun entrypoint that mirrors the published binary; keep heavy logic in `src/`.
- `dist/` contains build artifacts created by `bun run build`; never edit generated files manually.
- `scripts/build.ts` centralizes bundling specifics; extend it when adding targets or tweaking output formats.
- Repo-wide configuration lives in `biome.jsonc` and `tsconfig*.json`; update both when introducing new language features.

## Build, Test, and Development Commands
- `bun install` – install dependencies; rerun after modifying `package.json` or lockfiles.
- `bun run dev` – start the auto-reloading gateway on port 3333.
- `bun run cli` – execute the CLI exactly as the shipped `mcp-gateway` binary.
- `bun run build` – bundle sources into `dist/` using `scripts/build.ts`.
- `bun run build:types` and `bun run typecheck` – emit and verify declaration files.
- `bun run lint` and `bun run format` – apply Biome lint rules and formatting fixes (Biome is the source of truth).

## Coding Style & Naming Conventions
- Use TypeScript with ES modules; prefer named exports and clear side-effect boundaries.
- Biome enforces 2-space indentation and double-quoted strings—run the formatter before committing.
- Keep filenames lowercase with short words (`server.ts`, `bin/cli.ts`); use `camelCase` for values and `PascalCase` for types/classes.
- Co-locate protocol or handler utilities next to their consumers inside `src/` to keep the module graph shallow.

## Testing Guidelines
- Automated tests are not yet wired; create Bun test suites under `src/__tests__/` or `tests/` mirroring module names.
- Add a `bun test` script once tests exist and ensure both success and failure paths are covered.
- Favor integration-style tests that exercise `app.fetch` to validate routing and responses.
- Document manual verification steps in PRs until the automated runner is introduced.

## Commit & Pull Request Guidelines
- Follow the existing short, imperative commit style (`add formatter and cli code`); keep commits scoped to one change.
- Open PRs with a concise summary, linked issues, and the outputs of `bun run build` or `bun run lint`.
- Include screenshots or logs when altering HTTP responses or CLI output.
- Call out configuration changes (e.g., ports, environment variables) and note follow-up work when relevant.

## Security & Configuration Tips
- The server defaults to `port 3333`; introduce configuration hooks rather than hard-coding new ports.
- Never commit secrets—use environment variables surfaced via Bun's `process.env` when secure configuration is needed.


- Use the current tmux session, spinning up a new window to test the interactive CLI

# Writing UI

- See instructions for writing UI in src/ui/README.ui.md`