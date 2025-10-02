/**
 * Example usage of the code-goat module
 *
 * This demonstrates how to use the code mode module independently
 * of the gateway, and shows what integration would look like.
 */

import { createCodeMode, type MCPServer } from "./index";

// Example: Mock MCP servers with their tools
const mockServers: MCPServer[] = [
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
              description: "Path to the file to read",
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
            path: {
              type: "string",
              description: "Path to the file to write",
            },
            content: {
              type: "string",
              description: "Content to write to the file",
            },
          },
          required: ["path", "content"],
        },
      },
    ],
  },
  {
    name: "weather-api",
    tools: [
      {
        name: "get_weather",
        description: "Get current weather for a location",
        inputSchema: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "City name or zip code",
            },
          },
          required: ["location"],
        },
      },
    ],
  },
];

// Example: Mock RPC handler that simulates calling actual MCP servers
async function mockRpcHandler(
  serverName: string,
  toolName: string,
  args: unknown,
): Promise<unknown> {
  console.log(`[RPC] ${serverName}.${toolName}`, args);

  // Simulate different responses based on tool
  if (serverName === "Filesystem" && toolName === "readFile") {
    return { content: "Hello from file!" };
  }

  if (serverName === "WeatherApi" && toolName === "getWeather") {
    return {
      location: (args as { location: string }).location,
      temperature: 72,
      condition: "Sunny",
    };
  }

  return { status: "success" };
}

// Example: Run the code mode
async function runExample() {
  console.log("=== Code Goat Example ===\n");

  // Create code mode instance
  const codeMode = await createCodeMode({
    servers: mockServers,
    rpcHandler: mockRpcHandler,
    timeout: 5000, // 5 second timeout
  });

  console.log("✅ Code mode initialized\n");

  // Show the generated type definitions
  console.log("📝 Type Definitions:");
  console.log(codeMode.typeDefinitions);
  console.log("\n");

  // Show the execute_code tool schema
  console.log("🔧 Execute Code Tool Schema:");
  console.log(JSON.stringify(codeMode.getExecuteCodeToolSchema(), null, 2));
  console.log("\n");

  // Example 1: Simple execution
  console.log("--- Example 1: Simple Console Output ---");
  const result1 = await codeMode.executeCode(`
    console.log('Hello from code mode!');
    console.log('This is a test');
  `);
  console.log("Output:", result1.output);
  console.log("Success:", result1.success);
  console.log("\n");

  // Example 2: Calling MCP tools
  console.log("--- Example 2: Calling MCP Tools ---");
  const result2 = await codeMode.executeCode(`
    // Read a file
    const file = await mcpTools.Filesystem.readFile({ path: '/test.txt' });
    console.log('File contents:', file.content);
    
    // Get weather
    const weather = await mcpTools.WeatherApi.getWeather({ location: 'San Francisco' });
    console.log('Weather:', weather.temperature, weather.condition);
  `);
  console.log("Output:", result2.output);
  console.log("Success:", result2.success);
  console.log("\n");

  // Example 3: Error handling
  console.log("--- Example 3: Error Handling ---");
  const result3 = await codeMode.executeCode(`
    console.log('Starting...');
    throw new Error('Something went wrong!');
  `);
  console.log("Output:", result3.output);
  console.log("Success:", result3.success);
  console.log("Error:", result3.error);
  console.log("\n");

  // Example 4: Complex logic
  console.log("--- Example 4: Complex Logic ---");
  const result4 = await codeMode.executeCode(`
    // Get weather for multiple cities
    const cities = ['San Francisco', 'New York', 'London'];
    
    for (const city of cities) {
      const weather = await mcpTools.WeatherApi.getWeather({ location: city });
      console.log(\`\${city}: \${weather.temperature}°F, \${weather.condition}\`);
    }
    
    console.log('Done checking weather for all cities!');
  `);
  console.log("Output:", result4.output);
  console.log("Success:", result4.success);
  console.log("\n");

  console.log("=== Example Complete ===");
}

// Run the example
if (import.meta.main) {
  runExample().catch(console.error);
}
