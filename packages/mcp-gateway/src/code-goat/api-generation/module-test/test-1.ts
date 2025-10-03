// Generated MCP Tools API - Runtime Implementation

// Export combined API
const mcpTools = {
  TheWeatherChannel: {
    getWeather: async (input) => {
      return await __rpcCall("TheWeatherChannel", "getWeather", input);
    },

    complainAboutWeather: async (input) => {
      return await __rpcCall(
        "TheWeatherChannel",
        "complainAboutWeather",
        input,
      );
    },
  },

  EchoServer: {
    echo: async (input) => {
      return await __rpcCall("EchoServer", "echo", input);
    },
  },
};
