import { toCodeModeServer } from "../types";

export const MOCK_SERVERS = [
  toCodeModeServer({
    name: "the-weather-channel",
    tools: listWeatherToolsExample().result.tools,
    url: "haha",
    type: "http",
    headers: {},
    exchangeCount: 0,
    lastActivity: "mock-time",
  }),
  toCodeModeServer({
    name: "echo-server",
    tools: listEchoToolsExample().result.tools,
    url: "blah",
    type: "http",
    headers: {},
    exchangeCount: 0,
    lastActivity: "mock-time",
  }),
];

export function listWeatherToolsExample() {
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
        {
          name: "complain_about_weather",
          title: "Weather Information Provider",
          description:
            "Lodge a complaint about current weather information for a location",
          inputSchema: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "City name or zip code",
              },
              complaint: {
                type: "string",
                description: "Strongly worded complaint",
              },
            },
            required: ["location", "complaint"],
          },
        },
      ],
    },
  };
}

export function listEchoToolsExample() {
  return {
    jsonrpc: "2.0",
    id: 2,
    result: {
      tools: [
        {
          name: "echo",
          title: "echo echo echo",
          description: "Echo the provided text",
          inputSchema: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "City name or zip code",
              },
            },
            required: ["message"],
          },
          outputSchema: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "The echoed message",
              },
            },
            required: ["message"],
          },
        },
      ],
      nextCursor: "next-page-cursor",
    },
  };
}
