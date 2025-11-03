/**
 * Validate MCP Gateway Dependencies
 *
 * Ensures CLI package.json only lists dependencies that are directly imported
 * Uses depcheck to detect unused and missing dependencies
 *
 * Rules:
 * - dependencies: Must be imported directly by CLI source code
 * - devDependencies: Skipped (build tools, workspace packages allowed)
 * - Fails if unused dependencies found in "dependencies"
 * - Fails if missing dependencies found
 */

import { join } from "node:path";

interface DepcheckResult {
  dependencies: string[]; // Unused deps
  devDependencies: string[]; // Unused devDeps
  missing: Record<string, string[]>; // Missing deps
}

async function validateDependencies(): Promise<void> {
  console.log("🔍 Validating CLI package dependencies...");

  const cliDir = join(import.meta.dir, "..", "packages", "mcp-gateway");

  // Run depcheck (may exit with 255 but still provide valid JSON output)
  // Ignore dist folder since it contains bundled code from internal packages
  const proc = Bun.spawn(
    ["bun", "x", "depcheck", "--json", "--ignore-dirs=dist,node_modules"],
    {
      cwd: cliDir,
      stdout: "pipe",
    },
  );

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  const depcheck: DepcheckResult = JSON.parse(output);

  let hasErrors = false;

  // Check for unused dependencies (not devDependencies)
  if (depcheck.dependencies.length > 0) {
    hasErrors = true;
    console.error("❌ Unused dependencies found in CLI package:");
    for (const dep of depcheck.dependencies) {
      console.error(`  - ${dep}`);
    }
    console.error(
      "\nThese should either be:",
      "\n  1. Removed (if truly unused)",
      "\n  2. Moved to devDependencies (if build-time only)",
      "\n  3. Used by internal packages (will be added by merge-dependencies)",
    );
  }

  // Check for missing dependencies
  const missingDeps = Object.keys(depcheck.missing).filter(
    (dep) =>
      !dep.startsWith("bun:") && // Ignore bun built-ins
      !dep.startsWith("node:") && // Ignore node built-ins
      !dep.startsWith("@fiberplane/"), // Ignore workspace packages
  );

  if (missingDeps.length > 0) {
    hasErrors = true;
    console.error("❌ Missing dependencies found:");
    for (const dep of missingDeps) {
      const files = depcheck.missing[dep];
      console.error(`  - ${dep} (used in ${files.length} file(s))`);
    }
    console.error("\nThese should be added to dependencies in package.json");
  }

  if (hasErrors) {
    console.error(
      "\n💡 Tip: Run 'bunx depcheck' in packages/mcp-gateway for details",
    );
    process.exit(1);
  }

  console.log("✅ CLI dependencies are valid!");
  console.log(
    `  - ${depcheck.dependencies.length || "No"} unused dependencies`,
  );
  console.log(`  - ${missingDeps.length || "No"} missing dependencies`);
}

// Run
try {
  await validateDependencies();
} catch (error) {
  if (error instanceof Error && "exitCode" in error) {
    // Already handled
    process.exit((error as { exitCode: number }).exitCode);
  }
  console.error("❌ Validation failed:");
  console.error(error);
  process.exit(1);
}
