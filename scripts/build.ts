import { $ } from "bun";

await $`rm -rf dist`;

const entrypoints = ["./src/index.ts", "./bin/cli.ts"];

await Bun.build({
  format: "esm",
  outdir: "dist",
  root: "src",
  entrypoints,
  sourcemap: "inline",
});

await $`bun run build:types`;
