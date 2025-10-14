#!/usr/bin/env bun

/**
 * Test script to verify published packages work with both npx and bunx
 * Reads current version from package.json
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";

async function getVersion(): Promise<string> {
  const pkgPath = join(
    import.meta.dir,
    "..",
    "packages",
    "cli",
    "package.json",
  );
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  return pkg.version;
}

async function testCommand(
  runner: "npx" | "bunx",
  version: string,
): Promise<boolean> {
  const packageName = `@fiberplane/mcp-gateway@${version}`;
  console.log(`\n🧪 Testing ${runner} ${packageName}...`);

  try {
    const result = await $`${runner} --yes ${packageName} --version`.quiet();
    const output = result.stdout.toString().trim();
    console.log(`✅ ${runner}: ${output}`);
    return true;
  } catch (error) {
    console.log(`❌ ${runner}: Failed`);
    if (error instanceof Error) {
      console.log(`   Error: ${error.message}`);
    }
    return false;
  }
}

async function main() {
  const version = await getVersion();
  console.log(`📦 Testing published version: ${version}`);

  const bunxWorks = await testCommand("bunx", version);
  const npxWorks = await testCommand("npx", version);

  console.log("\n" + "=".repeat(50));
  console.log("Summary:");
  console.log(`  bunx: ${bunxWorks ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  npx:  ${npxWorks ? "✅ PASS" : "❌ FAIL"}`);
  console.log("=".repeat(50));

  if (!bunxWorks || !npxWorks) {
    process.exit(1);
  }
}

main();
