import { $ } from "bun";

await $`rm -rf dist`;

await Bun.build({
  format: "esm",
  outdir: "dist",
  root: "src",
  entrypoints: ["./src/index.ts"],
  sourcemap: "linked",
});

await Bun.build({
  format: "esm",
  outdir: "dist",
  root: "bin",
  entrypoints: ["./bin/cli.ts"],
  sourcemap: "linked",
  target: "node",
});

await $`bun run build:types`;
