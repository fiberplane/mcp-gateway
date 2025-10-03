// Generated MCP Tools API - Runtime Implementation



// Export combined API
const mcpTools = {


  echo: async (input) => {
    return await __rpcCall('EverythingMcpLite', 'echo', input);
  },

  add: async (input) => {
    return await __rpcCall('EverythingMcpLite', 'add', input);
  },

  multiply: async (input) => {
    return await __rpcCall('EverythingMcpLite', 'multiply', input);
  },

  getWeather: async (input) => {
    return await __rpcCall('EverythingMcpLite', 'getWeather', input);
  },

  getTinyImage: async (input) => {
    return await __rpcCall('EverythingMcpLite', 'getTinyImage', input);
  },

  longRunningOperation: async (input) => {
    return await __rpcCall('EverythingMcpLite', 'longRunningOperation', input);
  },

  annotatedMessage: async (input) => {
    return await __rpcCall('EverythingMcpLite', 'annotatedMessage', input);
  },

  listFiles: async (input) => {
    return await __rpcCall('EverythingMcpLite', 'listFiles', input);
  },

  generateId: async (input) => {
    return await __rpcCall('EverythingMcpLite', 'generateId', input);
  },

  enableDynamicTool: async (input) => {
    return await __rpcCall('EverythingMcpLite', 'enableDynamicTool', input);
  },

  confirmAction: async (input) => {
    return await __rpcCall('EverythingMcpLite', 'confirmAction', input);
  },

  collectFormData: async (input) => {
    return await __rpcCall('EverythingMcpLite', 'collectFormData', input);
  }

};
