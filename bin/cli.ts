#!/usr/bin/env node

import { greet } from "../src/index.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

function showHelp(): void {
  console.log(`
Usage: mcp-gateway [options]

Options:
  -h, --help     Show help
  -v, --version  Show version

Examples:
  mcp-gateway --help
  mcp-gateway --version
`);
}

function showVersion(): void {
  // Read version from package.json
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packageJsonPath = join(__dirname, "../package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  console.log(`mcp-gateway v${packageJson.version}`);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(greet("MCP Gateway"));
    console.log("Run with --help for usage information.");
    return;
  }

  const arg = args[0];

  switch (arg) {
    case "-h":
    case "--help":
      showHelp();
      break;
    case "-v":
    case "--version":
      showVersion();
      break;
    default:
      console.error(`Unknown option: ${arg}`);
      console.error("Run with --help for usage information.");
      process.exit(1);
  }
}

main();
