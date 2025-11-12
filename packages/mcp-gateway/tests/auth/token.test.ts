import { describe, expect, it } from "bun:test";
import { generateToken, loadOrGenerateToken } from "../../src/utils/token.js";

describe("Token generation", () => {
  it("generateToken creates 32-byte base64url token", () => {
    const token = generateToken();

    // Base64url encoding of 32 bytes should be 43 characters
    expect(token).toHaveLength(43);

    // Should only contain base64url-safe characters
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generateToken creates unique tokens", () => {
    const token1 = generateToken();
    const token2 = generateToken();

    expect(token1).not.toBe(token2);
  });

  it("loadOrGenerateToken uses MCP_GATEWAY_TOKEN env var if set", () => {
    const customToken = "custom-test-token-12345";
    process.env.MCP_GATEWAY_TOKEN = customToken;

    const token = loadOrGenerateToken();

    expect(token).toBe(customToken);

    // Cleanup
    delete process.env.MCP_GATEWAY_TOKEN;
  });

  it("loadOrGenerateToken generates token when env var not set", () => {
    delete process.env.MCP_GATEWAY_TOKEN;

    const token = loadOrGenerateToken();

    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
