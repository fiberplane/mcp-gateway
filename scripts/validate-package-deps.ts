/**
 * Validate Package Dependencies
 *
 * Generic script to validate any package's dependencies
 * Uses depcheck to detect unused and missing dependencies
 *
 * Usage: bun run scripts/validate-package-deps.ts <package-dir>
 * Example: bun run scripts/validate-package-deps.ts packages/api
 */

import { join } from "node:path";

interface DepcheckResult {
  dependencies: string[]; // Unused deps
  devDependencies: string[]; // Unused devDeps
  missing: Record<string, string[]>; // Missing deps
}

async function validateDependencies(packageDir: string): Promise<void> {
  const packageName = packageDir.split("/").pop() || "package";
  console.log(`🔍 Validating ${packageName} dependencies...`);

  const fullPath = join(import.meta.dir, "..", packageDir);

  // Run depcheck
  const proc = Bun.spawn(
    ["bun", "x", "depcheck", "--json", "--ignore-dirs=dist,node_modules"],
    {
      cwd: fullPath,
      stdout: "pipe",
    },
  );

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  // Check if depcheck failed
  if (exitCode !== 0 && !output.trim()) {
    console.error(`❌ depcheck failed with exit code ${exitCode}`);
    console.error("   This might be due to installation issues.");
    console.error(`   Try running: cd ${packageDir} && bunx depcheck`);
    process.exit(1);
  }

  let depcheck: DepcheckResult;
  try {
    depcheck = JSON.parse(output);
  } catch (error) {
    console.error("❌ Failed to parse depcheck output");
    console.error(`   Output: ${output.slice(0, 200)}`);
    throw error;
  }

  let hasErrors = false;

  // Common test dependencies that should be in root devDependencies
  const rootTestDeps = [
    "@happy-dom/global-registrator",
    "@testing-library/jest-dom",
    "@testing-library/react",
    "@types/bun",
    "@types/node",
    "bun-types",
  ];

  // Check for missing dependencies, filtering out false positives
  const missingDeps = Object.keys(depcheck.missing).filter((dep) => {
    const files = depcheck.missing[dep] || [];

    // Ignore built-ins and workspace packages
    if (
      dep.startsWith("bun:") ||
      dep.startsWith("node:") ||
      dep.startsWith("@fiberplane/mcp-gateway") ||
      dep.startsWith("@/")
    ) {
      return false;
    }

    // Ignore test deps (should be in devDeps at root)
    if (rootTestDeps.includes(dep)) {
      return false;
    }

    // Ignore @types/* packages only used in config files
    if (dep.startsWith("@types/")) {
      const onlyInConfigFiles = files.every((file) =>
        file.match(/\.(json|toml|yaml|yml)$/),
      );
      if (onlyInConfigFiles) {
        return false;
      }
    }

    return true;
  });

  if (missingDeps.length > 0) {
    hasErrors = true;
    console.error("❌ Missing dependencies found:");
    for (const dep of missingDeps) {
      const files = depcheck.missing[dep] || [];
      console.error(`  - ${dep} (used in ${files.length} file(s))`);
      for (const file of files.slice(0, 2)) {
        console.error(`    - ${file}`);
      }
      if (files.length > 2) {
        console.error(`    ... and ${files.length - 2} more`);
      }
    }
    console.error("\nThese should be added to dependencies in package.json");
  }

  if (hasErrors) {
    console.error(`\n💡 Tip: Run 'bunx depcheck' in ${packageDir} for details`);
    process.exit(1);
  }

  console.log(`✅ ${packageName} dependencies are valid!`);
  console.log(`  - ${missingDeps.length || "No"} missing dependencies`);
}

// Get package directory from args
const packageDir = process.argv[2];
if (!packageDir) {
  console.error(
    "Usage: bun run scripts/validate-package-deps.ts <package-dir>",
  );
  console.error(
    "Example: bun run scripts/validate-package-deps.ts packages/api",
  );
  process.exit(1);
}

// Run
try {
  await validateDependencies(packageDir);
} catch (error) {
  if (error instanceof Error && "exitCode" in error) {
    process.exit((error as { exitCode: number }).exitCode);
  }
  console.error("❌ Validation failed:");
  console.error(error);
  process.exit(1);
}
