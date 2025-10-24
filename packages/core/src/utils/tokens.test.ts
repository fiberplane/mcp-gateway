import { describe, expect, it } from "bun:test";
import { estimateInputTokens, estimateOutputTokens } from "./tokens";

describe("estimateInputTokens", () => {
  it("estimates tokens for tools/call", () => {
    const params = {
      name: "fetch_url",
      arguments: { url: "https://example.com", method: "GET" },
    };

    const tokens = estimateInputTokens("tools/call", params);

    // Should be roughly: {"name":"fetch_url","arguments":{"url":"https://example.com","method":"GET"}}
    // That's about 80 characters = 20 tokens
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(50);
  });

  it("estimates tokens for resources/read", () => {
    const params = { uri: "file:///path/to/file.txt" };

    const tokens = estimateInputTokens("resources/read", params);

    // Should be roughly: {"uri":"file:///path/to/file.txt"}
    // That's about 40 characters = 10 tokens
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(20);
  });

  it("handles invalid params gracefully", () => {
    const tokens = estimateInputTokens("tools/call", null);
    // Should handle null params gracefully
    expect(tokens).toBeGreaterThanOrEqual(0);
  });

  it("handles prompts/get with arguments", () => {
    const params = {
      name: "code_review",
      arguments: { language: "typescript", style: "detailed" },
    };

    const tokens = estimateInputTokens("prompts/get", params);

    // Should extract name and arguments
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(50);
  });

  it("handles list methods with cursor", () => {
    const params = { cursor: "abc123def456" };

    const tokens = estimateInputTokens("tools/list", params);

    // Should count cursor param
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(20);
  });

  it("handles unknown methods", () => {
    const params = { someField: "someValue" };

    const tokens = estimateInputTokens("custom/method", params);

    // Should use full params for unknown methods
    expect(tokens).toBeGreaterThan(0);
  });

  it("handles tools/call with complex nested arguments", () => {
    const params = {
      name: "search_database",
      arguments: {
        query: {
          filters: [
            { field: "status", operator: "eq", value: "active" },
            { field: "created", operator: "gte", value: "2024-01-01" },
          ],
          sort: [{ field: "name", direction: "asc" }],
          limit: 100,
        },
      },
    };

    const tokens = estimateInputTokens("tools/call", params);

    // Should count entire nested structure
    expect(tokens).toBeGreaterThan(50);
    expect(tokens).toBeLessThan(150);
  });
});

describe("estimateOutputTokens", () => {
  it("estimates tokens from result", () => {
    const result = {
      content: [{ type: "text", text: "Hello, world!" }],
    };

    const tokens = estimateOutputTokens(result);

    // Should use optimized content extraction
    // "Hello, world!" = 13 chars + structure overhead ~60 chars = ~73 chars = ~19 tokens
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(30);
  });

  it("handles empty results", () => {
    const tokens = estimateOutputTokens(undefined);
    expect(tokens).toBeGreaterThan(0); // "{}" is 2 chars = 1 token
  });

  it("handles null results gracefully", () => {
    const tokens = estimateOutputTokens(null);
    // Should handle null results gracefully
    expect(tokens).toBeGreaterThanOrEqual(0);
  });

  it("estimates tokens from error responses", () => {
    const error = {
      code: -32601,
      message: "Method not found",
      data: { details: "The requested method does not exist" },
    };

    const tokens = estimateOutputTokens(error);

    // Should estimate tokens from error object
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(50);
  });

  it("handles large content arrays with multiple items", () => {
    const result = {
      content: [
        { type: "text", text: "First paragraph of text." },
        { type: "text", text: "Second paragraph of text." },
        { type: "text", text: "Third paragraph of text." },
      ],
    };

    const tokens = estimateOutputTokens(result);

    // Should count all text content + structure
    // ~75 chars of text + structure overhead ~100 chars = ~175 chars = ~44 tokens
    expect(tokens).toBeGreaterThan(30);
    expect(tokens).toBeLessThan(60);
  });

  it("handles content with base64 image data", () => {
    const result = {
      content: [
        {
          type: "image",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", // 1x1 red pixel
        },
      ],
    };

    const tokens = estimateOutputTokens(result);

    // Should count base64 data length
    // ~104 chars of base64 + structure ~60 = ~164 chars = ~41 tokens
    expect(tokens).toBeGreaterThan(30);
    expect(tokens).toBeLessThan(60);
  });

  it("handles non-content structured responses", () => {
    const result = {
      status: "success",
      data: {
        id: 123,
        name: "Test Item",
        description: "This is a test item with some description text.",
      },
    };

    const tokens = estimateOutputTokens(result);

    // Should stringify entire object
    // ~120 chars = ~30 tokens
    expect(tokens).toBeGreaterThan(20);
    expect(tokens).toBeLessThan(50);
  });

  it("handles empty string text content", () => {
    const result = {
      content: [{ type: "text", text: "" }],
    };

    const tokens = estimateOutputTokens(result);

    // Should count structure overhead only
    // ~60 chars structure = ~15 tokens
    expect(tokens).toBeGreaterThan(10);
    expect(tokens).toBeLessThan(25);
  });

  it("handles very large responses", () => {
    // Simulate a large file read
    const largeText = "x".repeat(10000);
    const result = {
      content: [{ type: "text", text: largeText }],
    };

    const tokens = estimateOutputTokens(result);

    // Should handle large content
    // 10000 chars + ~60 structure = ~10060 chars = ~2515 tokens
    expect(tokens).toBeGreaterThan(2400);
    expect(tokens).toBeLessThan(2600);
  });

  it("handles objects without content field", () => {
    const result = {
      message: "Operation completed successfully",
      timestamp: "2024-01-01T00:00:00Z",
    };

    const tokens = estimateOutputTokens(result);

    // Should stringify entire object
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(30);
  });

  it("handles arrays at top level", () => {
    const result = ["item1", "item2", "item3"];

    const tokens = estimateOutputTokens(result);

    // Should stringify array
    // ["item1","item2","item3"] = ~30 chars = ~8 tokens
    expect(tokens).toBeGreaterThan(5);
    expect(tokens).toBeLessThan(15);
  });

  it("handles primitive values", () => {
    expect(estimateOutputTokens("simple string")).toBeGreaterThan(0);
    expect(estimateOutputTokens(12345)).toBeGreaterThan(0);
    expect(estimateOutputTokens(true)).toBeGreaterThan(0);
  });
});
