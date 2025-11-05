/**
 * Merge Dependencies Script
 *
 * Collects dependencies from internal packages and merges them into CLI package.json
 * This runs before publishing to ensure all transitive dependencies are listed
 *
 * Internal packages (source of truth):
 * - @fiberplane/mcp-gateway-types
 * - @fiberplane/mcp-gateway-core
 * - @fiberplane/mcp-gateway-api
 * - @fiberplane/mcp-gateway-server
 *
 * Process:
 * 1. Read CLI's current dependencies (direct deps only)
 * 2. Collect dependencies from all internal packages
 * 3. Detect version conflicts (error if found)
 * 4. Merge into CLI's dependencies
 * 5. Write updated package.json
 * 6. Run `bun install` to update lockfile
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const INTERNAL_PACKAGES = ["types", "core", "api", "server"];
const WORKSPACE_PREFIX = "@fiberplane/mcp-gateway-";

async function readPackageJson(path: string): Promise<PackageJson> {
  const content = await readFile(path, "utf-8");
  return JSON.parse(content);
}

async function writePackageJson(path: string, pkg: PackageJson): Promise<void> {
  const content = JSON.stringify(pkg, null, 2);
  await writeFile(path, `${content}\n`, "utf-8");
}

/**
 * Collect all dependencies from internal packages
 * Returns { dependencies, optionalDependencies }
 */
async function collectInternalDependencies(): Promise<{
  dependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
}> {
  const dependencies: Record<string, string> = {};
  const optionalDependencies: Record<string, string> = {};

  for (const pkg of INTERNAL_PACKAGES) {
    const pkgPath = join(
      import.meta.dir,
      "..",
      "packages",
      pkg,
      "package.json",
    );
    const pkgJson = await readPackageJson(pkgPath);

    // Collect regular dependencies
    for (const [name, version] of Object.entries(pkgJson.dependencies || {})) {
      // Skip workspace packages (they're bundled)
      if (name.startsWith(WORKSPACE_PREFIX)) {
        continue;
      }

      // Check for version conflicts
      if (dependencies[name] && dependencies[name] !== version) {
        throw new Error(
          `Version conflict for ${name}:\n` +
            `  ${dependencies[name]} (from previous package)\n` +
            `  ${version} (from @fiberplane/mcp-gateway-${pkg})\n` +
            `Please align versions in internal packages.`,
        );
      }

      dependencies[name] = version;
    }

    // Collect optional dependencies
    for (const [name, version] of Object.entries(
      pkgJson.optionalDependencies || {},
    )) {
      // Skip workspace packages
      if (name.startsWith(WORKSPACE_PREFIX)) {
        continue;
      }

      // Check for conflicts
      if (
        optionalDependencies[name] &&
        optionalDependencies[name] !== version
      ) {
        throw new Error(
          `Version conflict for optional dependency ${name}:\n` +
            `  ${optionalDependencies[name]} (from previous package)\n` +
            `  ${version} (from @fiberplane/mcp-gateway-${pkg})\n` +
            `Please align versions in internal packages.`,
        );
      }

      optionalDependencies[name] = version;
    }
  }

  return { dependencies, optionalDependencies };
}

/**
 * Merge dependencies into CLI package.json
 */
async function mergeDependencies(): Promise<void> {
  console.log("🔍 Collecting dependencies from internal packages...");

  // Collect from internal packages
  const { dependencies: internalDeps, optionalDependencies: internalOptional } =
    await collectInternalDependencies();

  console.log(
    `✓ Found ${Object.keys(internalDeps).length} dependencies from internal packages`,
  );
  if (Object.keys(internalOptional).length > 0) {
    console.log(
      `✓ Found ${Object.keys(internalOptional).length} optional dependencies`,
    );
  }

  // Read CLI package.json
  const cliPkgPath = join(
    import.meta.dir,
    "..",
    "packages",
    "mcp-gateway",
    "package.json",
  );
  const cliPkg = await readPackageJson(cliPkgPath);

  // Preserve CLI's direct dependencies
  const directDeps = { ...cliPkg.dependencies };

  console.log(
    `✓ CLI has ${Object.keys(directDeps).length} direct dependencies`,
  );

  // Merge: direct deps + internal deps
  const mergedDeps = { ...directDeps, ...internalDeps };

  // Sort alphabetically for consistency
  const sortedDeps = Object.keys(mergedDeps)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = mergedDeps[key];
        return acc;
      },
      {} as Record<string, string>,
    );

  // Update package.json
  cliPkg.dependencies = sortedDeps;

  if (Object.keys(internalOptional).length > 0) {
    const sortedOptional = Object.keys(internalOptional)
      .sort()
      .reduce(
        (acc, key) => {
          acc[key] = internalOptional[key];
          return acc;
        },
        {} as Record<string, string>,
      );
    cliPkg.optionalDependencies = sortedOptional;
  }

  // Write updated package.json
  await writePackageJson(cliPkgPath, cliPkg);

  console.log(
    `✓ Merged ${Object.keys(mergedDeps).length} total dependencies into CLI`,
  );

  // Update lockfile
  console.log("📦 Updating bun.lock...");
  const proc = Bun.spawn(["bun", "install"], {
    cwd: cliPkgPath.replace("/package.json", ""),
    stdout: "inherit",
    stderr: "inherit",
  });
  await proc.exited;

  console.log("✅ Dependencies merged successfully!");
}

// Run
try {
  await mergeDependencies();
} catch (error) {
  console.error("❌ Failed to merge dependencies:");
  console.error(error);
  process.exit(1);
}
