import { $ } from "bun";

await $`rm -rf dist`;

const entrypoints = ["./src/run.ts", "./src/run-v2.ts"];

await Bun.build({
  format: "esm",
  outdir: "dist",
  root: "src",
  entrypoints,
  sourcemap: "inline",
  target: "node",
});
