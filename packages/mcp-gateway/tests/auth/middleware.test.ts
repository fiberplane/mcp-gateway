import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { createAuthMiddleware } from "../../src/middleware/auth.js";

describe("Auth middleware", () => {
  const testToken = "test-token-12345";

  it("allows request with valid Bearer token", async () => {
    const app = new Hono();
    app.use("/*", createAuthMiddleware(testToken));
    app.get("/test", (c) => c.json({ success: true }));

    const response = await app.request("/test", {
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ success: true });
  });

  it("allows OPTIONS requests without authentication (CORS preflight)", async () => {
    const app = new Hono();
    app.use("/*", createAuthMiddleware(testToken));
    app.options("/test", (c) => c.body(null, 204));

    const response = await app.request("/test", {
      method: "OPTIONS",
    });

    expect(response.status).toBe(204);
  });

  it("rejects request without Authorization header", async () => {
    const app = new Hono();
    app.use("/*", createAuthMiddleware(testToken));
    app.get("/test", (c) => c.json({ success: true }));

    const response = await app.request("/test");

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toHaveProperty("error");
    expect(json.error).toContain("Missing or invalid Authorization header");
  });

  it("rejects request with invalid Bearer token", async () => {
    const app = new Hono();
    app.use("/*", createAuthMiddleware(testToken));
    app.get("/test", (c) => c.json({ success: true }));

    const response = await app.request("/test", {
      headers: {
        Authorization: "Bearer wrong-token",
      },
    });

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toHaveProperty("error");
    expect(json.error).toBe("Invalid token");
  });

  it("rejects request with non-Bearer auth scheme", async () => {
    const app = new Hono();
    app.use("/*", createAuthMiddleware(testToken));
    app.get("/test", (c) => c.json({ success: true }));

    const response = await app.request("/test", {
      headers: {
        Authorization: "Basic somebase64",
      },
    });

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toHaveProperty("error");
    expect(json.error).toContain("Missing or invalid Authorization header");
  });

  it("includes WWW-Authenticate header in 401 response (missing header)", async () => {
    const app = new Hono();
    app.use("/*", createAuthMiddleware(testToken));
    app.get("/test", (c) => c.json({ success: true }));

    const response = await app.request("/test");

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
  });

  it("includes WWW-Authenticate header for invalid token", async () => {
    const app = new Hono();
    app.use("/*", createAuthMiddleware(testToken));
    app.get("/test", (c) => c.json({ success: true }));

    const response = await app.request("/test", {
      headers: {
        Authorization: "Bearer wrong-token",
      },
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
  });

  it("rejects empty Bearer token", async () => {
    const app = new Hono();
    app.use("/*", createAuthMiddleware(testToken));
    app.get("/test", (c) => c.json({ success: true }));

    // Note: HTTP headers are trimmed, so "Bearer " becomes "Bearer"
    // which fails the "Bearer " prefix check (with space)
    const response = await app.request("/test", {
      headers: {
        Authorization: "Bearer ",
      },
    });

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toHaveProperty("error");
    // Due to header trimming, this is caught as missing/invalid header
    expect(json.error).toContain("Missing or invalid");
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
  });

  it("rejects Bearer token with only whitespace", async () => {
    const app = new Hono();
    app.use("/*", createAuthMiddleware(testToken));
    app.get("/test", (c) => c.json({ success: true }));

    // Note: HTTP headers are trimmed, so "Bearer    " becomes "Bearer"
    const response = await app.request("/test", {
      headers: {
        Authorization: "Bearer    ",
      },
    });

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toHaveProperty("error");
    // Due to header trimming, this is caught as missing/invalid header
    expect(json.error).toContain("Missing or invalid");
  });

  it("handles oversized tokens safely (DoS protection)", async () => {
    const app = new Hono();
    app.use("/*", createAuthMiddleware(testToken));
    app.get("/test", (c) => c.json({ success: true }));

    // Create token larger than MAX_TOKEN_LENGTH (256)
    const bigToken = "a".repeat(300);
    const response = await app.request("/test", {
      headers: {
        Authorization: `Bearer ${bigToken}`,
      },
    });

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toHaveProperty("error");
    expect(json.error).toBe("Invalid token");
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
  });

  it("accepts token with trailing/leading whitespace (trimmed)", async () => {
    const app = new Hono();
    app.use("/*", createAuthMiddleware(testToken));
    app.get("/test", (c) => c.json({ success: true }));

    const response = await app.request("/test", {
      headers: {
        Authorization: `Bearer  ${testToken}  `,
      },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ success: true });
  });
});
