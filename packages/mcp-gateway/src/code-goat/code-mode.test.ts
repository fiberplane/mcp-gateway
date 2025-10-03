import { describe, expect, test } from "bun:test";
import type { McpServer } from "../registry";
import { createCodeMode } from "./code-mode";
import { CODE_GOAT_TOOL_NAME } from "./code-tool-description";

describe("Code Mode Integration", () => {
  const mockServers: McpServer[] = [
    {
      name: "filesystem",
      tools: [
        {
          name: "read_file",
          description: "Read contents of a file",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Path to the file",
              },
            },
            required: ["path"],
          },
        },
        {
          name: "write_file",
          description: "Write contents to a file",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
            required: ["path", "content"],
          },
        },
      ],
    } as unknown as McpServer,
    {
      name: "weather-api",
      tools: [
        {
          name: "get_weather",
          description: "Get current weather",
          inputSchema: {
            type: "object",
            properties: {
              location: { type: "string" },
            },
            required: ["location"],
          },
        },
      ],
    } as unknown as McpServer,
  ];

  test("creates code mode instance with type definitions", async () => {
    const codeMode = await createCodeMode({
      servers: mockServers,
      rpcHandler: async () => ({ result: "test" }),
    });

    expect(codeMode.typeDefinitions).toBeDefined();
    expect(codeMode.typeDefinitions.length).toBeGreaterThan(0);
    expect(codeMode.typeDefinitions).toContain("ReadFile");
    expect(codeMode.typeDefinitions).toContain("WriteFile");
    expect(codeMode.typeDefinitions).toContain("GetWeather");
  });

  test("creates runtime API with correct structure", async () => {
    const codeMode = await createCodeMode({
      servers: mockServers,
      rpcHandler: async () => ({ result: "test" }),
    });

    expect(codeMode.runtimeApi).toBeDefined();
    expect(codeMode.runtimeApi).toContain("Filesystem");
    expect(codeMode.runtimeApi).toContain("WeatherApi");
    expect(codeMode.runtimeApi).toContain("readFile");
    expect(codeMode.runtimeApi).toContain("writeFile");
    expect(codeMode.runtimeApi).toContain("getWeather");
    expect(codeMode.runtimeApi).toContain("__rpcCall");
    expect(codeMode.runtimeApi).toContain("mcpTools");
  });

  test("returns code execution tool schema", async () => {
    const codeMode = await createCodeMode({
      servers: mockServers,
      rpcHandler: async () => ({ result: "test" }),
    });

    const schema = codeMode.getExecuteCodeToolSchema();

    expect(schema.name).toBe(CODE_GOAT_TOOL_NAME);
    expect(schema.description).toContain("JavaScript");
    expect(schema.description).toContain("mcpTools");
    expect(schema.inputSchema.properties.code).toBeDefined();
    expect(schema.inputSchema.required).toContain("code");
  });

  test("executes code with MCP tool calls", async () => {
    const calls: Array<{ server: string; tool: string; args: unknown }> = [];

    const codeMode = await createCodeMode({
      servers: mockServers,
      rpcHandler: async (server, tool, args) => {
        calls.push({ server, tool, args });

        if (tool === "read_file") {
          return { content: "File contents here" };
        }
        if (tool === "write_file") {
          return { status: "ok" };
        }
        if (tool === "get_weather") {
          return { temperature: 72, condition: "Sunny" };
        }
        return { result: "ok" };
      },
    });

    const result = await codeMode.executeCode(`
      const file = await mcpTools.Filesystem.readFile({ path: '/test.txt' });
      console.log('File:', file.content);
      
      const weather = await mcpTools.WeatherApi.getWeather({ location: 'SF' });
      console.log('Weather:', weather.temperature, weather.condition);
    `);

    expect(result.success).toBe(true);
    expect(result.output).toContain("File: File contents here");
    expect(result.output).toContain("Weather: 72 Sunny");
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls.some((c) => c.tool === "read_file")).toBe(true);
    expect(calls.some((c) => c.tool === "get_weather")).toBe(true);
  });

  test("handles errors from RPC handler", async () => {
    const codeMode = await createCodeMode({
      servers: mockServers,
      rpcHandler: async (_server, tool) => {
        if (tool === "read_file") {
          throw new Error("File not found");
        }
        return { result: "ok" };
      },
    });

    const result = await codeMode.executeCode(`
      try {
        await mcpTools.Filesystem.readFile({ path: '/missing.txt' });
      } catch (error) {
        console.error('Caught error:', error.message);
      }
    `);

    expect(result.success).toBe(true);
    expect(result.output).toContain("File not found");
  });

  test("supports multiple servers and tools", async () => {
    const complexServers: McpServer[] = [
      {
        name: "server-one",
        tools: [
          {
            name: "tool_a",
            description: "Tool A",
            inputSchema: { type: "object" },
          },
          {
            name: "tool_b",
            description: "Tool B",
            inputSchema: { type: "object" },
          },
        ],
      } as unknown as McpServer,
      {
        name: "server-two",
        tools: [
          {
            name: "tool_c",
            description: "Tool C",
            inputSchema: { type: "object" },
          },
        ],
      } as unknown as McpServer,
    ];

    const codeMode = await createCodeMode({
      servers: complexServers,
      rpcHandler: async (server, tool) => ({ server, tool }),
    });

    const result = await codeMode.executeCode(`
      const r1 = await mcpTools.ServerOne.toolA({});
      const r2 = await mcpTools.ServerTwo.toolC({});
      console.log('Called', r1.tool, 'and', r2.tool);
    `);

    expect(result.success).toBe(true);
    expect(result.output).toContain("Called");
    expect(result.output).toContain("tool_a");
    expect(result.output).toContain("tool_c");
  });

  test("respects timeout configuration", async () => {
    const codeMode = await createCodeMode({
      servers: mockServers,
      rpcHandler: async () => ({}),
      timeout: 100,
    });

    const result = await codeMode.executeCode(`
      await new Promise(resolve => setTimeout(resolve, 5000));
    `);

    expect(result.success).toBe(false);
    expect(result.error).toContain("timeout");
  });

  test("captures console output from complex workflows", async () => {
    const codeMode = await createCodeMode({
      servers: mockServers,
      rpcHandler: async (_server, tool, _args) => {
        if (tool === "get_weather") {
          return { temperature: 65, condition: "Cloudy" };
        }
        return {};
      },
    });

    const result = await codeMode.executeCode(`
      const cities = ['SF', 'NYC', 'LA'];
      
      console.log('Checking weather for', cities.length, 'cities');
      
      for (const city of cities) {
        const weather = await mcpTools.WeatherApi.getWeather({ location: city });
        console.log(city + ':', weather.temperature + '°F', weather.condition);
      }
      
      console.log('Weather check complete!');
    `);

    expect(result.success).toBe(true);
    expect(result.output).toContain("Checking weather for 3 cities");
    expect(result.output).toContain("SF: 65°F Cloudy");
    expect(result.output).toContain("NYC: 65°F Cloudy");
    expect(result.output).toContain("LA: 65°F Cloudy");
    expect(result.output).toContain("Weather check complete!");
  });
});
