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

  it("includes WWW-Authenticate header in 401 response", async () => {
    const app = new Hono();
    app.use("/*", createAuthMiddleware(testToken));
    app.get("/test", (c) => c.json({ success: true }));

    const response = await app.request("/test");

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
  });
});
