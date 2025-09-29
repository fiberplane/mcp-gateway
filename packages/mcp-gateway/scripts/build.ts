import { $ } from "bun";

await $`rm -rf dist`;

const entrypoints = ["./src/run.ts"];

await Bun.build({
  format: "esm",
  outdir: "dist",
  root: "src",
  entrypoints,
  sourcemap: "inline",
  target: "node",
});
