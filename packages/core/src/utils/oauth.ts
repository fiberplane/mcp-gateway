/**
 * Generate a cryptographically secure random string for PKCE
 */
function generateRandomString(length: number): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues)
    .map(v => charset[v % charset.length])
    .join("");
}

/**
 * Generate PKCE code verifier (random string)
 */
function generateCodeVerifier(): string {
  return generateRandomString(128);
}

/**
 * Generate PKCE code challenge from verifier using SHA-256
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);

  // Convert to base64url
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Build OAuth authorization URL with state parameter and PKCE
 */
export async function buildAuthorizationUrl(
  authUrl: string,
  serverName: string,
  port: number,
  clientId?: string,
): Promise<string> {
  const redirectUri = `http://localhost:${port}/oauth/callback`;
  const effectiveClientId = clientId || "mcp-gateway";

  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const state = encodeURIComponent(
    JSON.stringify({
      serverName,
      redirectUri,
      clientId: effectiveClientId,
      codeVerifier, // Store verifier in state so it comes back in callback
    }),
  );

  // Parse the auth URL and add query parameters
  const url = new URL(authUrl);
  url.searchParams.set("client_id", effectiveClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return url.toString();
}

/**
 * Open URL in default browser
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
