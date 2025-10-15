#!/usr/bin/env bun
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const packagesDir = join(import.meta.dir, "../packages");
const packages = readdirSync(packagesDir);

console.log("📦 Publishing packages...\n");

for (const pkgName of packages) {
  const pkgPath = join(packagesDir, pkgName);
  const pkgJsonPath = join(pkgPath, "package.json");

  try {
    const pkgJson = await Bun.file(pkgJsonPath).json();

    if (pkgJson.private) {
      console.log(`⏭️  Skipped ${pkgName} (private)`);
      continue;
    }

    console.log(`📤 Publishing ${pkgJson.name}@${pkgJson.version}...`);
    await $`cd ${pkgPath} && bun publish`;
    console.log(`✅ Published ${pkgJson.name}\n`);
  } catch (_error) {
    console.log(`⚠️  Skipped ${pkgName} (already published or error)\n`);
  }
}

console.log("🏷️  Creating git tags...");
await $`changeset tag`;
console.log("✨ Done!");
