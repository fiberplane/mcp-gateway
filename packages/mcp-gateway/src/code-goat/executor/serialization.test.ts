import { describe, expect, test } from "bun:test";
import type { ExecutionResult } from "./types";
import { formatExecutionResult } from "./types";

describe("formatExecutionResult - Robust Serialization", () => {
  test("handles circular references", () => {
    const obj: Record<string, unknown> = { name: "test" };
    obj.self = obj; // Create circular reference

    const result: ExecutionResult = {
      output: "",
      success: true,
      returnValue: obj,
    };

    const formatted = formatExecutionResult(result);
    expect(formatted).toContain("Circular");
    expect(formatted).toContain("test");
  });

  test("handles deeply nested circular references", () => {
    const parent: Record<string, unknown> = { name: "parent" };
    const child: Record<string, unknown> = { name: "child", parent };
    parent.child = child;

    const result: ExecutionResult = {
      output: "",
      success: true,
      returnValue: parent,
    };

    const formatted = formatExecutionResult(result);
    expect(formatted).toContain("parent");
    expect(formatted).toContain("child");
    expect(formatted).toContain("Circular");
  });

  test("handles functions in objects", () => {
    const obj = {
      name: "test",
      method: function testMethod() {
        return "hello";
      },
      arrow: () => "world",
    };

    const result: ExecutionResult = {
      output: "",
      success: true,
      returnValue: obj,
    };

    const formatted = formatExecutionResult(result);
    expect(formatted).toContain("Function: testMethod");
    expect(formatted).toContain("Function: arrow");
  });

  test("handles BigInt", () => {
    const result: ExecutionResult = {
      output: "",
      success: true,
      returnValue: { bigNum: BigInt(9007199254740991) },
    };

    const formatted = formatExecutionResult(result);
    expect(formatted).toContain("BigInt: 9007199254740991");
  });

  test("handles Symbols", () => {
    const sym = Symbol("test");
    const result: ExecutionResult = {
      output: "",
      success: true,
      returnValue: { symbol: sym },
    };

    const formatted = formatExecutionResult(result);
    expect(formatted).toContain("Symbol: Symbol(test)");
  });

  test("handles Date objects", () => {
    const date = new Date("2025-10-04T00:00:00.000Z");
    const result: ExecutionResult = {
      output: "",
      success: true,
      returnValue: { timestamp: date },
    };

    const formatted = formatExecutionResult(result);
    expect(formatted).toContain("2025-10-04T00:00:00.000Z");
  });

  test("handles RegExp objects", () => {
    const result: ExecutionResult = {
      output: "",
      success: true,
      returnValue: { pattern: /test\d+/gi },
    };

    const formatted = formatExecutionResult(result);
    expect(formatted).toContain("RegExp");
    expect(formatted).toContain("/test");
  });

  test("handles Error objects", () => {
    const error = new Error("Test error");
    const result: ExecutionResult = {
      output: "",
      success: true,
      returnValue: { error },
    };

    const formatted = formatExecutionResult(result);
    expect(formatted).toContain("__type");
    expect(formatted).toContain("Error");
    expect(formatted).toContain("Test error");
  });

  test("handles Set objects", () => {
    const result: ExecutionResult = {
      output: "",
      success: true,
      returnValue: { items: new Set([1, 2, 3]) },
    };

    const formatted = formatExecutionResult(result);
    expect(formatted).toContain("__type");
    expect(formatted).toContain("Set");
    expect(formatted).toContain("values");
  });

  test("handles Map objects", () => {
    const result: ExecutionResult = {
      output: "",
      success: true,
      returnValue: {
        lookup: new Map([
          ["key1", "value1"],
          ["key2", "value2"],
        ]),
      },
    };

    const formatted = formatExecutionResult(result);
    expect(formatted).toContain("__type");
    expect(formatted).toContain("Map");
    expect(formatted).toContain("entries");
  });

  test("handles TypedArrays", () => {
    const result: ExecutionResult = {
      output: "",
      success: true,
      returnValue: {
        buffer: new Uint8Array([1, 2, 3, 4]),
      },
    };

    const formatted = formatExecutionResult(result);
    expect(formatted).toContain("Uint8Array");
    expect(formatted).toContain("length 4");
  });

  test("handles undefined in objects", () => {
    const result: ExecutionResult = {
      output: "",
      success: true,
      returnValue: { value: undefined, other: "defined" },
    };

    const formatted = formatExecutionResult(result);
    expect(formatted).toContain("[undefined]");
    expect(formatted).toContain("defined");
  });

  test("compact format with complex objects", () => {
    const obj: Record<string, unknown> = { name: "test" };
    obj.self = obj;

    const result: ExecutionResult = {
      output: "Some output",
      success: true,
      returnValue: obj,
    };

    const compact = formatExecutionResult(result, true);
    expect(compact).toContain("Status: SUCCESS");
    expect(compact).toContain("Output: Some output");
    expect(compact).toContain("Result:");
    expect(compact).toContain("Circular");
  });

  test("handles mixed complex scenario", () => {
    const complex: Record<string, unknown> = {
      string: "hello",
      number: 42,
      bigint: BigInt(123),
      func: () => "test",
      date: new Date("2025-10-04"),
      regex: /test/,
      set: new Set([1, 2]),
      map: new Map([["a", 1]]),
      error: new Error("test"),
      undef: undefined,
      nil: null,
    };
    complex.circular = complex;

    const result: ExecutionResult = {
      output: "Complex test",
      success: true,
      returnValue: complex,
    };

    const formatted = formatExecutionResult(result);
    expect(formatted).toContain("hello");
    expect(formatted).toContain("BigInt");
    expect(formatted).toContain("Function");
    expect(formatted).toContain("2025-10-04"); // Date serialization
    expect(formatted).toContain("RegExp");
    expect(formatted).toContain("Set");
    expect(formatted).toContain("Map");
    expect(formatted).toContain("Error");
    expect(formatted).toContain("[undefined]");
    expect(formatted).toContain("null");
    expect(formatted).toContain("Circular");
  });
});
