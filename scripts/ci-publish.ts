#!/usr/bin/env bun
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const packagesDir = join(import.meta.dir, "../packages");
const packages = readdirSync(packagesDir);
const isSnapshot = process.env.SNAPSHOT === "true";

console.log(
  isSnapshot
    ? "📦 Publishing snapshot packages...\n"
    : "📦 Publishing packages...\n",
);

let publishedCount = 0;
let skippedCount = 0;
let failedCount = 0;

for (const pkgName of packages) {
  const pkgPath = join(packagesDir, pkgName);
  const pkgJsonPath = join(pkgPath, "package.json");

  try {
    const pkgJson = await Bun.file(pkgJsonPath).json();

    if (pkgJson.private) {
      console.log(`⏭️  Skipped ${pkgName} (private)`);
      skippedCount++;
      continue;
    }

    console.log(`📤 Publishing ${pkgJson.name}@${pkgJson.version}...`);

    // Use bun publish - it respects NPM_CONFIG_TOKEN env variable
    // Add --tag next for snapshot releases
    if (isSnapshot) {
      await $`cd ${pkgPath} && bun publish --tag next`;
    } else {
      await $`cd ${pkgPath} && bun publish`;
    }

    console.log(`✅ Published ${pkgJson.name}\n`);
    publishedCount++;
  } catch (error: unknown) {
    // Check if it's a 403/already published error vs authentication error
    const err = error as { stderr?: { toString(): string }; message?: string };
    const errorOutput = err?.stderr?.toString() || err?.message || "";

    if (
      errorOutput.includes("cannot publish over") ||
      errorOutput.includes(
        "You cannot publish over the previously published versions",
      )
    ) {
      console.log(`⏭️  Skipped ${pkgName} (already published)\n`);
      skippedCount++;
    } else {
      console.error(`❌ Failed to publish ${pkgName}:`);
      console.error(errorOutput);
      console.error("");
      failedCount++;
    }
  }
}

console.log(`\n📊 ${isSnapshot ? "Snapshot " : ""}Summary:`);
console.log(`   Published: ${publishedCount}`);
console.log(`   Skipped: ${skippedCount}`);
console.log(`   Failed: ${failedCount}\n`);

if (failedCount > 0) {
  console.error("❌ Some packages failed to publish");
  process.exit(1);
}

// Only create git tags for normal releases, not snapshots
if (!isSnapshot) {
  console.log("🏷️  Creating git tags...");
  await $`changeset tag`;
}

console.log("✨ Done!");
