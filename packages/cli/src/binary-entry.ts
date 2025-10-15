#!/usr/bin/env bun
// Binary entry point for compiled executable
// This avoids top-level await issues with bun build --compile
import { runCli } from "./cli.js";

runCli();
