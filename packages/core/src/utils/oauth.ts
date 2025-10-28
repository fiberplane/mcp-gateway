/**
 * Open URL in default browser
 * Used for OAuth authorization flow
 */
export async function openBrowser(url: string): Promise<void> {
  const { spawn } = await import("node:child_process");

  const command = process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "start"
      : "xdg-open";

  spawn(command, [url], {
    detached: true,
    stdio: "ignore",
  }).unref();
}
