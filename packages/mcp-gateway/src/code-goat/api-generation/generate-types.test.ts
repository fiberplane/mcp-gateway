import { generateTypes } from "./generate-types";

// Smoketest for the api type generation
// Let's us look at output in the console
const tools = listToolsExample().result.tools;
const result = await generateTypes(tools);

console.log("--------------------------------");
console.log(result);

export function listToolsExample() {
  return {
    jsonrpc: "2.0",
    id: 1,
    result: {
      tools: [
        {
          name: "get_weather",
          title: "Weather Information Provider",
          description: "Get current weather information for a location",
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
      nextCursor: "next-page-cursor",
    },
  };
}
