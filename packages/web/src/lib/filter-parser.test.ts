/**
 * Tests for filter parser
 */

import { describe, expect, test } from "bun:test";
import {
  getAutocompleteSuggestions,
  parseFilterInput,
  validateFilterInput,
} from "./filter-parser";

describe("parseFilterInput", () => {
  describe("valid inputs", () => {
    test("parses numeric filter with >", () => {
      const result = parseFilterInput("tokens > 150");
      expect(result).toEqual({
        field: "tokens",
        operator: "gt",
        value: 150,
      });
    });

    test("parses numeric filter with <", () => {
      const result = parseFilterInput("duration < 25");
      expect(result).toEqual({
        field: "duration",
        operator: "lt",
        value: 25,
      });
    });

    test("parses numeric filter with =", () => {
      const result = parseFilterInput("tokens = 100");
      expect(result).toEqual({
        field: "tokens",
        operator: "eq",
        value: 100,
      });
    });

    test("parses numeric filter with >=", () => {
      const result = parseFilterInput("duration >= 500");
      expect(result).toEqual({
        field: "duration",
        operator: "gte",
        value: 500,
      });
    });

    test("parses numeric filter with <=", () => {
      const result = parseFilterInput("tokens <= 1000");
      expect(result).toEqual({
        field: "tokens",
        operator: "lte",
        value: 1000,
      });
    });

    test("parses numeric filter with ≥ (Unicode)", () => {
      const result = parseFilterInput("tokens ≥ 100");
      expect(result).toEqual({
        field: "tokens",
        operator: "gte",
        value: 100,
      });
    });

    test("parses numeric filter with ≤ (Unicode)", () => {
      const result = parseFilterInput("duration ≤ 500");
      expect(result).toEqual({
        field: "duration",
        operator: "lte",
        value: 500,
      });
    });

    test("parses string filter with is", () => {
      const result = parseFilterInput("client is claude-code");
      expect(result).toEqual({
        field: "client",
        operator: "is",
        value: "claude-code",
      });
    });

    test("parses string filter with contains", () => {
      const result = parseFilterInput("method contains tools");
      expect(result).toEqual({
        field: "method",
        operator: "contains",
        value: "tools",
      });
    });

    test("handles extra whitespace", () => {
      const result = parseFilterInput("tokens  >  150");
      expect(result).toEqual({
        field: "tokens",
        operator: "gt",
        value: 150,
      });
    });

    test("handles no whitespace", () => {
      const result = parseFilterInput("tokens>150");
      expect(result).toEqual({
        field: "tokens",
        operator: "gt",
        value: 150,
      });
    });

    test("handles case-insensitive field names", () => {
      const result = parseFilterInput("TOKENS > 150");
      expect(result).toEqual({
        field: "tokens",
        operator: "gt",
        value: 150,
      });
    });

    test("handles case-insensitive operators", () => {
      const result = parseFilterInput("client IS claude-code");
      expect(result).toEqual({
        field: "client",
        operator: "is",
        value: "claude-code",
      });
    });

    test("parses all field types", () => {
      expect(parseFilterInput("tokens > 100")?.field).toBe("tokens");
      expect(parseFilterInput("duration < 50")?.field).toBe("duration");
      expect(parseFilterInput("client is foo")?.field).toBe("client");
      expect(parseFilterInput("method contains bar")?.field).toBe("method");
      expect(parseFilterInput("session is abc")?.field).toBe("session");
      expect(parseFilterInput("server is baz")?.field).toBe("server");
    });
  });

  describe("invalid inputs", () => {
    test("returns null for empty input", () => {
      expect(parseFilterInput("")).toBeNull();
      expect(parseFilterInput("   ")).toBeNull();
    });

    test("returns null for unknown field", () => {
      expect(parseFilterInput("tokns > 150")).toBeNull();
      expect(parseFilterInput("unknown is value")).toBeNull();
    });

    test("returns null for invalid operator", () => {
      expect(parseFilterInput("tokens >> 150")).toBeNull();
      expect(parseFilterInput("tokens <> 150")).toBeNull();
    });

    test("returns null for missing operator", () => {
      expect(parseFilterInput("tokens")).toBeNull();
      expect(parseFilterInput("tokens 150")).toBeNull();
    });

    test("returns null for missing value", () => {
      expect(parseFilterInput("tokens >")).toBeNull();
      expect(parseFilterInput("client is")).toBeNull();
    });

    test("returns null for non-numeric value on numeric field", () => {
      expect(parseFilterInput("tokens > abc")).toBeNull();
      expect(parseFilterInput("duration < foo")).toBeNull();
    });

    test("returns null for negative values", () => {
      expect(parseFilterInput("tokens > -150")).toBeNull();
      expect(parseFilterInput("duration < -25")).toBeNull();
    });
  });
});

describe("validateFilterInput", () => {
  test("validates valid input", () => {
    const result = validateFilterInput("tokens > 150");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.filter).toEqual({
        field: "tokens",
        operator: "gt",
        value: 150,
      });
    }
  });

  test("returns error for empty input", () => {
    const result = validateFilterInput("");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.type).toBe("incomplete");
    }
  });

  test("returns error for unknown field", () => {
    const result = validateFilterInput("tokns > 150");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.type).toBe("unknown_field");
      if (result.error.type === "unknown_field") {
        expect(result.error.field).toBe("tokns");
      }
    }
  });

  test("suggests closest field", () => {
    const result = validateFilterInput("tokns > 150");
    expect(result.valid).toBe(false);
    if (!result.valid && result.error.type === "unknown_field") {
      expect(result.error.suggestion).toBe("tokens");
    }
  });

  test("returns error for missing operator", () => {
    const result = validateFilterInput("tokens");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.type).toBe("incomplete");
    }
  });

  test("returns error for invalid operator", () => {
    const result = validateFilterInput("tokens >> 150");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      // "tokens >> 150" matches ">" operator, then fails to parse "> 150" as number
      // This results in "invalid_value" error, which is reasonable
      expect(result.error.type).toBe("invalid_value");
    }
  });

  test("returns error for missing value", () => {
    const result = validateFilterInput("tokens >");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.type).toBe("incomplete");
    }
  });

  test("returns error for non-numeric value on numeric field", () => {
    const result = validateFilterInput("tokens > abc");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.type).toBe("invalid_value");
    }
  });

  test("returns error for negative value", () => {
    const result = validateFilterInput("tokens > -150");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.type).toBe("invalid_value");
    }
  });
});

describe("getAutocompleteSuggestions", () => {
  test("suggests fields for partial input", () => {
    const suggestions = getAutocompleteSuggestions("to");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]?.display).toBe("tokens");
  });

  test("suggests operators after field", () => {
    const suggestions = getAutocompleteSuggestions("tokens ");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.display === ">")).toBe(true);
  });

  test("suggests numeric operators for numeric fields", () => {
    const suggestions = getAutocompleteSuggestions("tokens ");
    const operators = suggestions.map((s) => s.display);
    expect(operators).toContain(">");
    expect(operators).toContain("<");
    expect(operators).toContain("=");
    expect(operators).toContain(">=");
    expect(operators).toContain("<=");
  });

  test("suggests string operators for string fields", () => {
    const suggestions = getAutocompleteSuggestions("client ");
    const operators = suggestions.map((s) => s.display);
    expect(operators).toContain("is");
    expect(operators).toContain("contains");
    expect(operators).not.toContain(">");
  });

  test("suggests common values for tokens", () => {
    const suggestions = getAutocompleteSuggestions("tokens > ");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.display === "100")).toBe(true);
  });

  test("suggests common values for duration", () => {
    const suggestions = getAutocompleteSuggestions("duration < ");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.display === "100")).toBe(true);
  });

  test("filters value suggestions by partial input", () => {
    const suggestions = getAutocompleteSuggestions("tokens > 1");
    const values = suggestions.map((s) => s.display);
    expect(values).toContain("100");
    expect(values).toContain("1000");
    expect(values).not.toContain("500"); // doesn't start with 1
  });
});
