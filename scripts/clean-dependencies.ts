/**
 * Clean Dependencies Script
 *
 * Removes unused dependencies from mcp-gateway package.json
 * (keeps devDependencies intact)
 *
 * This resets the dependencies to the minimal set needed for the wrapper package,
 * before running merge-dependencies.ts to add back the required ones.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

async function readPackageJson(path: string): Promise<PackageJson> {
  const content = await readFile(path, "utf-8");
  return JSON.parse(content);
}

async function writePackageJson(path: string, pkg: PackageJson): Promise<void> {
  const content = JSON.stringify(pkg, null, 2);
  await writeFile(path, `${content}\n`, "utf-8");
}

async function cleanDependencies(): Promise<void> {
  console.log("🧹 Cleaning unused dependencies from mcp-gateway...");

  const cliPkgPath = join(
    import.meta.dir,
    "..",
    "packages",
    "mcp-gateway",
    "package.json",
  );
  const cliPkg = await readPackageJson(cliPkgPath);

  // Minimal required dependencies for the wrapper package
  // These are the direct dependencies needed by the CLI wrapper itself
  const requiredDeps: Record<string, string> = {
    "@hono/node-server":
      cliPkg.dependencies?.["@hono/node-server"] || "^1.19.4",
    hono: cliPkg.dependencies?.hono || "^4.9.8",
  };

  const beforeCount = Object.keys(cliPkg.dependencies || {}).length;

  // Replace dependencies with minimal set
  cliPkg.dependencies = requiredDeps;

  // Remove optionalDependencies (will be re-added by merge-dependencies)
  delete cliPkg.optionalDependencies;

  // Write updated package.json
  await writePackageJson(cliPkgPath, cliPkg);

  const afterCount = Object.keys(requiredDeps).length;
  const removed = beforeCount - afterCount;

  console.log(`✓ Removed ${removed} unused dependencies`);
  console.log(`✓ Kept ${afterCount} required dependencies`);

  // Update lockfile
  console.log("📦 Updating lockfile...");
  const proc = Bun.spawn(["bun", "install"], {
    cwd: cliPkgPath.replace("/package.json", ""),
    stdout: "inherit",
    stderr: "inherit",
  });
  await proc.exited;

  console.log("✅ Dependencies cleaned successfully!");
  console.log(
    "\nℹ️  Run 'bun run ../../scripts/merge-dependencies.ts' to add back internal package dependencies",
  );
}

// Run
try {
  await cleanDependencies();
} catch (error) {
  console.error("❌ Failed to clean dependencies:");
  console.error(error);
  process.exit(1);
}
