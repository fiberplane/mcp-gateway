import { describe, expect, test } from "bun:test";
import { executeCode } from "./evil";
import type { ExecutionContext } from "./types";

describe("Code Executor", () => {
  test("executes simple code and captures console output", async () => {
    const context: ExecutionContext = {
      runtimeApi: "",
      rpcHandler: async () => ({ result: "test" }),
    };

    const result = await executeCode(`console.log('Hello, World!');`, context);

    expect(result.success).toBe(true);
    expect(result.output).toContain("Hello, World!");
  });

  test("captures multiple console.log statements", async () => {
    const context: ExecutionContext = {
      runtimeApi: "",
      rpcHandler: async () => ({ result: "test" }),
    };

    const result = await executeCode(
      `
      console.log('First');
      console.log('Second');
      console.log('Third');
      `,
      context,
    );

    expect(result.success).toBe(true);
    expect(result.output).toContain("First");
    expect(result.output).toContain("Second");
    expect(result.output).toContain("Third");
  });

  test("captures different console methods", async () => {
    const context: ExecutionContext = {
      runtimeApi: "",
      rpcHandler: async () => ({ result: "test" }),
    };

    const result = await executeCode(
      `
      console.log('Log message');
      console.error('Error message');
      console.warn('Warning message');
      console.info('Info message');
      `,
      context,
    );

    expect(result.success).toBe(true);
    expect(result.output).toContain("Log message");
    expect(result.output).toContain("[ERROR] Error message");
    expect(result.output).toContain("[WARN] Warning message");
    expect(result.output).toContain("[INFO] Info message");
  });

  test("handles errors and captures stack trace", async () => {
    const context: ExecutionContext = {
      runtimeApi: "",
      rpcHandler: async () => ({ result: "test" }),
    };

    const result = await executeCode(`throw new Error('Test error');`, context);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Test error");
    expect(result.stack).toBeDefined();
  });

  test("executes async code with await", async () => {
    const context: ExecutionContext = {
      runtimeApi: "",
      rpcHandler: async () => ({ result: "async result" }),
    };

    const result = await executeCode(
      `
      const promise = Promise.resolve('Resolved!');
      const value = await promise;
      console.log(value);
      `,
      context,
    );

    expect(result.success).toBe(true);
    expect(result.output).toContain("Resolved!");
  });

  test("calls RPC handler through runtime API", async () => {
    const calls: Array<{ server: string; tool: string; args: unknown }> = [];

    const context: ExecutionContext = {
      runtimeApi: `
        const mcpTools = {
          TestServer: {
            testTool: async (args) => {
              return await __rpcCall('test-server', 'test_tool', args);
            }
          }
        };
      `,
      rpcHandler: async (_server: string, _tool: string, _args: unknown) => {
        calls.push({ server: _server, tool: _tool, args: _args });
        return { result: "success" };
      },
    };

    const result = await executeCode(
      `
      const response = await mcpTools.TestServer.testTool({ input: 'test' });
      console.log('Response:', JSON.stringify(response));
      `,
      context,
    );

    expect(result.success).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0]?.server).toBe("test-server");
    expect(calls[0]?.tool).toBe("test_tool");
    expect(calls[0]?.args).toEqual({ input: "test" });
    expect(result.output).toContain("success");
  });

  test("handles multiple RPC calls in sequence", async () => {
    const calls: Array<string> = [];

    const context: ExecutionContext = {
      runtimeApi: `
        const mcpTools = {
          fs: {
            read: async (args) => __rpcCall('fs', 'read', args),
            write: async (args) => __rpcCall('fs', 'write', args),
          }
        };
      `,
      rpcHandler: async (server: string, tool: string, _args: unknown) => {
        calls.push(`${server}.${tool}`);
        return { status: "ok" };
      },
    };

    const result = await executeCode(
      `
      await mcpTools.fs.read({ path: '/test.txt' });
      await mcpTools.fs.write({ path: '/test.txt', content: 'Hello' });
      console.log('Done');
      `,
      context,
    );

    expect(result.success).toBe(true);
    expect(calls).toEqual(["fs.read", "fs.write"]);
    expect(result.output).toContain("Done");
  });

  test("logs objects as JSON", async () => {
    const context: ExecutionContext = {
      runtimeApi: "",
      rpcHandler: async () => ({}),
    };

    const result = await executeCode(
      `console.log({ name: 'Test', value: 42 });`,
      context,
    );

    expect(result.success).toBe(true);
    expect(result.output).toContain('"name"');
    expect(result.output).toContain('"Test"');
    expect(result.output).toContain("42");
  });

  test("handles timeout", async () => {
    const context: ExecutionContext = {
      runtimeApi: "",
      rpcHandler: async () => ({}),
      timeout: 100, // 100ms timeout
    };

    const result = await executeCode(
      `
      // Infinite loop
      await new Promise(resolve => setTimeout(resolve, 10000));
      `,
      context,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("timeout");
  });

  test("captures error thrown in async code", async () => {
    const context: ExecutionContext = {
      runtimeApi: "",
      rpcHandler: async () => ({}),
    };

    const result = await executeCode(
      `
      await Promise.resolve();
      throw new Error('Async error');
      `,
      context,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Async error");
  });

  test("handles complex logic with loops and conditionals", async () => {
    const context: ExecutionContext = {
      runtimeApi: `
        const mcpTools = {
          math: {
            add: async (args) => __rpcCall('math', 'add', args),
          }
        };
      `,
      rpcHandler: async (_server: string, _tool: string, args: unknown) => {
        const { a, b } = args as { a: number; b: number };
        return { result: a + b };
      },
    };

    const result = await executeCode(
      `
      let sum = 0;
      for (let i = 1; i <= 3; i++) {
        const result = await mcpTools.math.add({ a: sum, b: i });
        sum = result.result;
        console.log('Sum after', i, ':', sum);
      }
      console.log('Final sum:', sum);
      `,
      context,
    );

    expect(result.success).toBe(true);
    expect(result.output).toContain("Sum after 1 : 1");
    expect(result.output).toContain("Sum after 2 : 3");
    expect(result.output).toContain("Sum after 3 : 6");
    expect(result.output).toContain("Final sum: 6");
  });
});
