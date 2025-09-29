import open from "open";
import { getActiveSessions } from "./capture.js";
import type { Registry } from "./registry.js";
import { isValidUrl } from "./registry.js";
import { saveRegistry } from "./storage.js";

// ANSI escape codes for terminal control
const CLEAR_SCREEN = "\x1Bc";
const RESET_COLOR = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[96m";
const GREEN = "\x1b[92m";
const YELLOW = "\x1b[93m";

// Truncate URL for display
function _truncateUrl(url: string, maxLength: number = 30): string {
  if (url.length <= maxLength) return url;
  return `${url.slice(0, maxLength - 3)}...`;
}

// Format timestamp for display
function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return "—";
  try {
    const date = new Date(timestamp);
    return date.toISOString().slice(0, 16).replace("T", " ");
  } catch {
    return "—";
  }
}

// Format relative time (e.g., "2 min ago", "1 hour ago")
function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "—";
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatTimestamp(timestamp);
  } catch {
    return "—";
  }
}

// Render the main menu
function renderMenu(registry: Registry): void {
  process.stdout.write(CLEAR_SCREEN);

  const activeSessions = getActiveSessions();
  console.log(`${CYAN}MCP Gateway v0.1.0${RESET_COLOR}`);
  console.log(`${DIM}Gateway: http://localhost:3333${RESET_COLOR}`);
  console.log(`${DIM}MCP: http://localhost:3333/mcp${RESET_COLOR}`);
  if (activeSessions.length > 0) {
    console.log(
      `${DIM}Active sessions: ${activeSessions.length}${RESET_COLOR}`,
    );
  }
  console.log();

  if (registry.servers.length === 0) {
    console.log(`${DIM}No servers registered${RESET_COLOR}`);
  } else {
    console.log(`${CYAN}Servers:${RESET_COLOR}`);
    for (const server of registry.servers) {
      const activity = formatRelativeTime(server.lastActivity);
      const encodedName = encodeURIComponent(server.name);
      const proxyUrl = `http://localhost:3333/${encodedName}/mcp`;
      console.log(`  ${GREEN}${server.name}${RESET_COLOR}`);
      console.log(`    ${CYAN}${proxyUrl}${RESET_COLOR}`);
      console.log(`    ${DIM}→ ${server.url}${RESET_COLOR}`);
      console.log(
        `    ${DIM}Last active: ${activity} • ${server.exchangeCount} exchanges${RESET_COLOR}`,
      );
    }
  }

  console.log();
  console.log(`${YELLOW}[a]${RESET_COLOR} Add server`);

  if (registry.servers.length > 0) {
    console.log(`${YELLOW}[r]${RESET_COLOR} Remove server`);
  } else {
    console.log(`${DIM}[r] Remove server${RESET_COLOR}`);
  }

  console.log(`${YELLOW}[o]${RESET_COLOR} Open UI in browser`);
  console.log(`${YELLOW}[q]${RESET_COLOR} Quit`);
  console.log();
}

// Prompt for user input
function prompt(message: string): Promise<string | null> {
  return new Promise((resolve) => {
    // Reset stdin to a clean state
    process.stdin.removeAllListeners("data");
    process.stdin.removeAllListeners("keypress");

    // Enable raw mode to capture ESC immediately
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }

    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdout.write(message);

    let inputBuffer = "";

    const handleKeypress = (data: string) => {
      const char = data.charCodeAt(0);

      // ESC key - cancel immediately
      if (char === 27) {
        process.stdin.removeAllListeners("data");
        if (process.stdin.setRawMode) {
          process.stdin.setRawMode(false);
        }
        process.stdout.write("\n"); // Clean newline
        resolve(null);
        return;
      }

      // Ctrl+C - exit
      if (char === 3) {
        process.stdin.removeAllListeners("data");
        if (process.stdin.setRawMode) {
          process.stdin.setRawMode(false);
        }
        process.exit(0);
        return;
      }

      // Enter key - submit input
      if (char === 13 || char === 10) {
        process.stdin.removeAllListeners("data");
        if (process.stdin.setRawMode) {
          process.stdin.setRawMode(false);
        }
        process.stdout.write("\n"); // Clean newline
        resolve(inputBuffer.trim());
        return;
      }

      // Backspace
      if (char === 127 || char === 8) {
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
          process.stdout.write("\b \b");
        }
        return;
      }

      // Regular printable characters
      if (char >= 32 && char <= 126) {
        inputBuffer += data;
        process.stdout.write(data);
      }
    };

    process.stdin.on("data", handleKeypress);
  });
}

// Handle adding a new server
async function handleAddServer(
  registry: Registry,
  storageDir: string,
): Promise<void> {
  console.log(`\n${CYAN}Add New Server${RESET_COLOR}`);

  try {
    const url = await prompt("\nServer URL (ESC to cancel): ");

    if (url === null) {
      // ESC pressed - return to main menu
      return;
    }

    if (!url) {
      console.log("Error: URL cannot be empty");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return;
    }

    if (!isValidUrl(url)) {
      console.log("Error: Invalid URL format (must be HTTP or HTTPS)");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return;
    }

    const name = await prompt("Display name (ESC to cancel): ");

    if (name === null) {
      // ESC pressed - return to main menu
      return;
    }

    if (!name) {
      console.log("Error: Display name cannot be empty");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return;
    }

    // Direct mutation approach - no new objects created
    const normalizedUrl = new URL(url).toString().replace(/\/$/, "");
    const normalizedName = name.toLowerCase().trim();

    // Check if server already exists
    if (registry.servers.some((s) => s.name === normalizedName)) {
      throw new Error(`Server '${name}' already exists`);
    }

    // Create and push new server directly to existing array
    registry.servers.push({
      name: normalizedName,
      url: normalizedUrl,
      type: "http",
      headers: {},
      lastActivity: null,
      exchangeCount: 0,
    });

    await saveRegistry(storageDir, registry);
    console.log(
      `\n${BOLD}✓${RESET_COLOR} Server '${name}' added successfully!`,
    );
    await new Promise((resolve) => setTimeout(resolve, 1500));
  } catch (error) {
    console.log(
      `\nError: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

// Handle removing a server
async function handleRemoveServer(
  registry: Registry,
  storageDir: string,
): Promise<void> {
  if (registry.servers.length === 0) {
    console.log(`\n${DIM}No servers to remove${RESET_COLOR}`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return;
  }

  console.log(`\n${CYAN}Remove Server${RESET_COLOR}`);

  console.log("\nSelect a server to remove:");
  registry.servers.forEach((server, index) => {
    console.log(`  ${index + 1}. ${server.name} (${server.url})`);
  });

  const selection = await prompt("\nEnter number (ESC/Enter to cancel): ");

  if (selection === null || !selection) {
    // ESC pressed or empty input - return to main menu
    return;
  }

  const serverIndex = parseInt(selection, 10) - 1;

  if (
    Number.isNaN(serverIndex) ||
    serverIndex < 0 ||
    serverIndex >= registry.servers.length
  ) {
    console.log("Error: Invalid selection");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return;
  }

  const server = registry.servers[serverIndex];
  if (!server) {
    console.log("Error: Server not found");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return;
  }

  const confirm = await prompt(`\nReally remove '${server.name}'? (y/N): `);

  if (confirm === null || confirm.toLowerCase() !== "y") {
    // ESC pressed or not confirmed - return to main menu
    console.log("Cancelled");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return;
  }

  try {
    // Direct mutation approach - find and remove server
    const serverIndex = registry.servers.findIndex(
      (s) => s.name === server.name,
    );

    if (serverIndex === -1) {
      throw new Error(`Server '${server.name}' not found`);
    }

    // Remove directly from existing array
    registry.servers.splice(serverIndex, 1);

    await saveRegistry(storageDir, registry);
    console.log(
      `\n${BOLD}✓${RESET_COLOR} Server '${server.name}' removed successfully!`,
    );
    console.log(`${DIM}Note: Capture history preserved on disk${RESET_COLOR}`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  } catch (error) {
    console.log(
      `\nError: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

// Open UI in browser
async function handleOpenUI(): Promise<void> {
  const url = "http://localhost:3333/ui";

  try {
    console.log(`\n${CYAN}Opening UI in browser...${RESET_COLOR}`);
    console.log(`${DIM}${url}${RESET_COLOR}`);

    await open(url);

    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    console.log(
      `\nError opening browser: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    console.log(`${DIM}Please manually open: ${url}${RESET_COLOR}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

// Read single keypress
function readKey(): Promise<string> {
  return new Promise((resolve) => {
    // Clear any existing listeners
    process.stdin.removeAllListeners("data");
    process.stdin.removeAllListeners("keypress");

    // Enable raw mode to capture single keypresses without Enter
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }

    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const onKeypress = (key: string) => {
      // Clean up: disable raw mode and remove listeners
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(false);
      }

      process.stdin.removeAllListeners("data");

      const char = key.charCodeAt(0);

      // Handle special keys
      if (char === 3) {
        // Ctrl+C
        resolve("q");
      } else if (char === 13 || char === 10) {
        // Enter - return empty to be ignored in main loop
        resolve("");
      } else if (char >= 32 && char <= 126) {
        // Regular printable characters
        resolve(key.toLowerCase());
      } else {
        // Ignore other special characters
        resolve("");
      }
    };

    process.stdin.once("data", onKeypress);
  });
}

// Main interactive CLI loop
export async function runInteractiveCli(
  storageDir: string,
  registry: Registry,
  onExit?: () => void,
): Promise<void> {
  let running = true;

  // Handle Ctrl+C gracefully
  process.on("SIGINT", () => {
    console.log("\n\nClosing the MCP Gateway...");
    onExit?.();
    process.exit(0);
  });

  while (running) {
    renderMenu(registry);

    const key = await readKey();

    // Skip empty keys (like Enter) - but still re-render to show updates
    if (!key) continue;

    switch (key.toLowerCase()) {
      case "a":
        await handleAddServer(registry, storageDir);
        break;

      case "r":
        await handleRemoveServer(registry, storageDir);
        break;

      case "o":
        await handleOpenUI();
        break;

      case "q":
      case "\x03": // Ctrl+C
        running = false;
        break;

      default:
        // Silently ignore unknown keys
        break;
    }
  }

  console.log("\nClosing the MCP Gateway...");
  onExit?.();
  process.exit(0);
}
