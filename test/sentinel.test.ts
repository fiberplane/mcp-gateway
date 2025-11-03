/**
 * Sentinel test to guide users to the correct test command
 *
 * This test always fails when running `bun test` from the root directory,
 * providing helpful guidance to use `bun run test` instead.
 */

import { expect, test } from "bun:test";

test("❌ Don't use 'bun test' from root - use 'bun run test' instead", () => {
  // This test always fails to get the user's attention
  expect(
    false,
    `
╔════════════════════════════════════════════════════════════╗
║  ⚠️  Please use 'bun run test' instead of 'bun test'      ║
╚════════════════════════════════════════════════════════════╝

Running 'bun test' from the root doesn't use workspace-specific
test configurations, causing failures in React tests.

✅ Use one of these instead:

  # Run all workspace tests (recommended)
  bun run test

  # Run specific package tests
  bun run --filter @fiberplane/mcp-gateway-cli test
  bun run --filter @fiberplane/mcp-gateway-web test
  bun run --filter @fiberplane/mcp-gateway-core test

  # Run tests from within a package
  cd packages/web && bun test

See README.md for details.
`,
  ).toBe(true);
});
