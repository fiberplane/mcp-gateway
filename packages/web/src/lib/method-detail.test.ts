import { describe, expect, it } from "bun:test";
import type { ApiLogEntry } from "@fiberplane/mcp-gateway-types";
import { getMethodDetail } from "./method-detail";

describe("getMethodDetail", () => {
  it("returns empty string for non-request logs", () => {
    const log = {
      direction: "response",
      method: "tools/call",
    } as ApiLogEntry;

    expect(getMethodDetail(log)).toBe("");
  });

  it("returns empty string for SSE events", () => {
    const log = {
      direction: "sse-event",
      method: "tools/call",
    } as ApiLogEntry;

    expect(getMethodDetail(log)).toBe("");
  });

  describe("tools/call", () => {
    it("formats as function call with argument value", () => {
      const log = {
        direction: "request",
        method: "tools/call",
        request: {
          params: {
            name: "fetch_url",
            arguments: { url: "https://example.com" },
          },
        },
      } as ApiLogEntry;

      expect(getMethodDetail(log)).toBe(
        'fetch_url(url: "https://example.com")',
      );
    });

    it("handles multiple arguments with values", () => {
      const log = {
        direction: "request",
        method: "tools/call",
        request: {
          params: {
            name: "sum",
            arguments: { a: 4, b: 44 },
          },
        },
      } as ApiLogEntry;

      expect(getMethodDetail(log)).toBe("sum(a: 4, b: 44)");
    });

    it("handles tool with no arguments", () => {
      const log = {
        direction: "request",
        method: "tools/call",
        request: {
          params: {
            name: "simple_tool",
            arguments: {},
          },
        },
      } as ApiLogEntry;

      expect(getMethodDetail(log)).toBe("simple_tool()");
    });

    it("handles malformed params gracefully", () => {
      const log = {
        direction: "request",
        method: "tools/call",
        request: { params: null },
      } as ApiLogEntry;

      expect(getMethodDetail(log)).toBe("");
    });

    it("handles missing arguments field", () => {
      const log = {
        direction: "request",
        method: "tools/call",
        request: {
          params: {
            name: "tool_without_args",
          },
        },
      } as ApiLogEntry;

      expect(getMethodDetail(log)).toBe("tool_without_args()");
    });
  });

  describe("resources/read", () => {
    it("extracts URI from resources/read", () => {
      const log = {
        direction: "request",
        method: "resources/read",
        request: {
          params: {
            uri: "file:///path/to/file.txt",
          },
        },
      } as ApiLogEntry;

      expect(getMethodDetail(log)).toBe("file:///path/to/file.txt");
    });

    it("handles malformed params gracefully", () => {
      const log = {
        direction: "request",
        method: "resources/read",
        request: { params: { notUri: "something" } },
      } as ApiLogEntry;

      expect(getMethodDetail(log)).toBe("");
    });
  });

  describe("prompts/get", () => {
    it("formats as function call with argument value", () => {
      const log = {
        direction: "request",
        method: "prompts/get",
        request: {
          params: {
            name: "code_review",
            arguments: { language: "typescript" },
          },
        },
      } as ApiLogEntry;

      expect(getMethodDetail(log)).toBe('code_review(language: "typescript")');
    });

    it("handles prompt with no arguments", () => {
      const log = {
        direction: "request",
        method: "prompts/get",
        request: {
          params: {
            name: "simple_prompt",
          },
        },
      } as ApiLogEntry;

      expect(getMethodDetail(log)).toBe("simple_prompt()");
    });
  });

  describe("list methods", () => {
    it("returns 'all' for tools/list without cursor", () => {
      const log = {
        direction: "request",
        method: "tools/list",
        request: { params: {} },
      } as ApiLogEntry;

      expect(getMethodDetail(log)).toBe("all");
    });

    it("shows cursor for tools/list with cursor", () => {
      const log = {
        direction: "request",
        method: "tools/list",
        request: {
          params: { cursor: "abcdefghijklmnop" },
        },
      } as ApiLogEntry;

      expect(getMethodDetail(log)).toBe("cursor: abcdefgh...");
    });

    it("returns 'all' for resources/list without cursor", () => {
      const log = {
        direction: "request",
        method: "resources/list",
        request: { params: {} },
      } as ApiLogEntry;

      expect(getMethodDetail(log)).toBe("all");
    });

    it("returns 'all' for prompts/list without cursor", () => {
      const log = {
        direction: "request",
        method: "prompts/list",
        request: { params: {} },
      } as ApiLogEntry;

      expect(getMethodDetail(log)).toBe("all");
    });
  });

  describe("unknown methods", () => {
    it("returns empty string for unknown methods", () => {
      const log = {
        direction: "request",
        method: "unknown/method",
        request: { params: { some: "data" } },
      } as ApiLogEntry;

      expect(getMethodDetail(log)).toBe("");
    });
  });

  describe("response previews", () => {
    it("shows text content from MCP response", () => {
      const log = {
        direction: "response",
        method: "tools/call",
        response: {
          jsonrpc: "2.0",
          id: 1,
          result: {
            content: [{ type: "text", text: "Hello, world!" }],
          },
        },
      } as ApiLogEntry;

      expect(getMethodDetail(log)).toBe("Hello, world!");
    });

    it("truncates long text content", () => {
      const log = {
        direction: "response",
        method: "tools/call",
        response: {
          jsonrpc: "2.0",
          id: 1,
          result: {
            content: [
              {
                type: "text",
                text: "This is a very long response that should be truncated to fit in the preview area",
              },
            ],
          },
        },
      } as ApiLogEntry;

      const result = getMethodDetail(log);
      expect(result).toContain("This is a very long response");
      expect(result).toContain("...");
      expect(result.length).toBeLessThan(70);
    });

    it("shows content type for non-text content", () => {
      const log = {
        direction: "response",
        method: "tools/call",
        response: {
          jsonrpc: "2.0",
          id: 1,
          result: {
            content: [
              { type: "image", data: "base64data..." },
              { type: "text", text: "More content" },
            ],
          },
        },
      } as ApiLogEntry;

      expect(getMethodDetail(log)).toBe("[image +1 more]");
    });

    it("shows error message for error responses", () => {
      const log = {
        direction: "response",
        method: "tools/call",
        response: {
          jsonrpc: "2.0",
          id: 1,
          error: {
            code: -32601,
            message: "Method not found",
          },
        },
      } as ApiLogEntry;

      expect(getMethodDetail(log)).toBe("Error: Method not found");
    });

    it("shows primitive response values", () => {
      const log = {
        direction: "response",
        method: "tools/call",
        response: {
          jsonrpc: "2.0",
          id: 1,
          result: 42,
        },
      } as ApiLogEntry;

      expect(getMethodDetail(log)).toBe("42");
    });

    it("shows array length for array responses", () => {
      const log = {
        direction: "response",
        method: "tools/list",
        response: {
          jsonrpc: "2.0",
          id: 1,
          result: [{ name: "tool1" }, { name: "tool2" }, { name: "tool3" }],
        },
      } as ApiLogEntry;

      expect(getMethodDetail(log)).toBe("[3 items]");
    });
  });
});
