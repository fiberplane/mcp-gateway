/** biome-ignore-all lint/suspicious/noConsole: tests */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveRegistry } from "@fiberplane/mcp-gateway-core";
import { createApp } from "@fiberplane/mcp-gateway-server";
import type { Registry } from "@fiberplane/mcp-gateway-types";

describe("OAuth Routes Integration Tests", () => {
  let storageDir: string;
  let gateway: { port: number; stop: () => void };
  let mockOAuthServer: { port: number; stop: () => void };

  beforeAll(async () => {
    // Create temp directory for storage
    storageDir = await mkdtemp(join(tmpdir(), "mcp-oauth-test-"));

    // Create mock OAuth server that returns proper discovery documents
    const mockServerPort = 8300;
    const mockServer = Bun.serve({
      port: mockServerPort,
      fetch(request) {
        const url = new URL(request.url);

        // OAuth Protected Resource discovery
        if (url.pathname === "/.well-known/oauth-protected-resource") {
          return new Response(
            JSON.stringify({
              resource: "https://api.example.com",
              authorization_servers: ["https://auth.example.com"],
            }),
            {
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // OAuth Authorization Server discovery
        if (url.pathname === "/.well-known/oauth-authorization-server") {
          return new Response(
            JSON.stringify({
              issuer: "https://auth.example.com",
              authorization_endpoint: "https://auth.example.com/authorize",
              token_endpoint: "https://auth.example.com/token",
              registration_endpoint: "https://auth.example.com/register",
            }),
            {
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // OpenID Connect discovery
        if (url.pathname === "/.well-known/openid-configuration") {
          return new Response(
            JSON.stringify({
              issuer: "https://auth.example.com",
              authorization_endpoint: "https://auth.example.com/authorize",
              token_endpoint: "https://auth.example.com/token",
              userinfo_endpoint: "https://auth.example.com/userinfo",
              jwks_uri: "https://auth.example.com/.well-known/jwks.json",
            }),
            {
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // Dynamic Client Registration
        if (url.pathname === "/register" && request.method === "POST") {
          return new Response(
            JSON.stringify({
              client_id: "test-client-123",
              client_secret: "test-secret-456",
              client_id_issued_at: Date.now(),
            }),
            {
              headers: { "Content-Type": "application/json" },
              status: 201,
            },
          );
        }

        return new Response("Not Found", { status: 404 });
      },
    });

    mockOAuthServer = {
      port: mockServerPort,
      stop: () => mockServer.stop(),
    };

    // Create test registry with OAuth-enabled server
    const registry: Registry = {
      servers: [
        {
          name: "figma",
          type: "http" as const,
          url: `http://localhost:${mockServerPort}/mcp`,
          headers: {},
          lastActivity: null,
          exchangeCount: 0,
        },
      ],
    };

    await saveRegistry(storageDir, registry);

    // Create and start gateway app
    const { app } = await createApp(registry, storageDir);
    const gatewayServer = Bun.serve({
      port: 8301,
      fetch: app.fetch,
    });

    gateway = {
      port: 8301,
      stop: () => gatewayServer.stop(),
    };
  });

  afterAll(async () => {
    // Stop servers
    gateway?.stop();
    mockOAuthServer?.stop();

    // Clean up temp directory
    try {
      await rm(storageDir, { recursive: true, force: true });
    } catch (error) {
      console.warn("Failed to clean up temp directory:", error);
    }
  });

  test("should proxy OAuth Protected Resource discovery", async () => {
    const response = await fetch(
      `http://localhost:${gateway.port}/.well-known/oauth-protected-resource/servers/figma/mcp`,
    );

    expect(response.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: test
    const data: any = await response.json();
    expect(data.resource).toBe("https://api.example.com");
    expect(data.authorization_servers).toContain("https://auth.example.com");
  });

  test("should proxy OAuth Authorization Server discovery", async () => {
    const response = await fetch(
      `http://localhost:${gateway.port}/.well-known/oauth-authorization-server/servers/figma/mcp`,
    );

    expect(response.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: test
    const data: any = await response.json();
    expect(data.issuer).toBe("https://auth.example.com");
    expect(data.authorization_endpoint).toBe(
      "https://auth.example.com/authorize",
    );
    expect(data.token_endpoint).toBe("https://auth.example.com/token");
  });

  test("should proxy OpenID Connect discovery", async () => {
    const response = await fetch(
      `http://localhost:${gateway.port}/.well-known/openid-configuration/servers/figma/mcp`,
    );

    expect(response.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: test
    const data: any = await response.json();
    expect(data.issuer).toBe("https://auth.example.com");
    expect(data.jwks_uri).toBe(
      "https://auth.example.com/.well-known/jwks.json",
    );
  });

  test("should proxy OpenID Connect discovery via alternate path", async () => {
    const response = await fetch(
      `http://localhost:${gateway.port}/servers/figma/mcp/.well-known/openid-configuration`,
    );

    expect(response.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: test
    const data: any = await response.json();
    expect(data.issuer).toBe("https://auth.example.com");
  });

  test("should proxy OAuth Dynamic Client Registration", async () => {
    const response = await fetch(
      `http://localhost:${gateway.port}/servers/figma/mcp/register`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_name: "Test MCP Client",
          redirect_uris: ["http://localhost:3000/callback"],
        }),
      },
    );

    expect(response.status).toBe(201);
    // biome-ignore lint/suspicious/noExplicitAny: test
    const data: any = await response.json();
    expect(data.client_id).toBe("test-client-123");
    expect(data.client_secret).toBe("test-secret-456");
  });

  test("should return 400 for root .well-known endpoints without server", async () => {
    const response = await fetch(
      `http://localhost:${gateway.port}/.well-known/oauth-protected-resource`,
    );

    expect(response.status).toBe(400);
    // biome-ignore lint/suspicious/noExplicitAny: test
    const data: any = await response.json();
    expect(data.error).toBe("server_not_specified");
  });

  test("should return 400 for /register without server", async () => {
    const response = await fetch(`http://localhost:${gateway.port}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    // biome-ignore lint/suspicious/noExplicitAny: test
    const data: any = await response.json();
    expect(data.error).toBe("server_not_specified");
  });

  test("should return 404 for unknown server", async () => {
    const response = await fetch(
      `http://localhost:${gateway.port}/.well-known/oauth-protected-resource/servers/unknown/mcp`,
    );

    expect(response.status).toBe(404);
  });

  // SHORT ALIAS TESTS (using /s/:server instead of /servers/:server)

  test("should proxy OAuth Protected Resource discovery via short alias", async () => {
    const response = await fetch(
      `http://localhost:${gateway.port}/.well-known/oauth-protected-resource/s/figma/mcp`,
    );

    expect(response.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: test
    const data: any = await response.json();
    expect(data.resource).toBe("https://api.example.com");
    expect(data.authorization_servers).toContain("https://auth.example.com");
  });

  test("should proxy OAuth Authorization Server discovery via short alias", async () => {
    const response = await fetch(
      `http://localhost:${gateway.port}/.well-known/oauth-authorization-server/s/figma/mcp`,
    );

    expect(response.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: test
    const data: any = await response.json();
    expect(data.issuer).toBe("https://auth.example.com");
    expect(data.authorization_endpoint).toBe(
      "https://auth.example.com/authorize",
    );
  });

  test("should proxy OpenID Connect discovery via short alias", async () => {
    const response = await fetch(
      `http://localhost:${gateway.port}/.well-known/openid-configuration/s/figma/mcp`,
    );

    expect(response.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: test
    const data: any = await response.json();
    expect(data.issuer).toBe("https://auth.example.com");
    expect(data.jwks_uri).toBe(
      "https://auth.example.com/.well-known/jwks.json",
    );
  });

  test("should proxy OpenID Connect discovery via short alias alternate path", async () => {
    const response = await fetch(
      `http://localhost:${gateway.port}/s/figma/mcp/.well-known/openid-configuration`,
    );

    expect(response.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: test
    const data: any = await response.json();
    expect(data.issuer).toBe("https://auth.example.com");
  });

  test("should proxy OAuth Dynamic Client Registration via short alias", async () => {
    const response = await fetch(
      `http://localhost:${gateway.port}/s/figma/mcp/register`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_name: "Test MCP Client via short alias",
          redirect_uris: ["http://localhost:3000/callback"],
        }),
      },
    );

    expect(response.status).toBe(201);
    // biome-ignore lint/suspicious/noExplicitAny: test
    const data: any = await response.json();
    expect(data.client_id).toBe("test-client-123");
    expect(data.client_secret).toBe("test-secret-456");
  });

  test("should return 404 for unknown server via short alias", async () => {
    const response = await fetch(
      `http://localhost:${gateway.port}/.well-known/oauth-protected-resource/s/unknown/mcp`,
    );

    expect(response.status).toBe(404);
  });
});
