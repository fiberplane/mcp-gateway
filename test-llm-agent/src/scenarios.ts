/**
 * Test scenarios for the LLM agent
 *
 * Each scenario defines a prompt and expected behavior to validate
 * the LLM-MCP correlation in the gateway.
 */

export interface Scenario {
  name: string;
  prompt: string;
  expectedTools: string[];
  description: string;
}

export const scenarios: Record<string, Scenario> = {
  weather: {
    name: "weather",
    prompt: "What is the weather like in Amsterdam right now?",
    expectedTools: ["getWeather"],
    description: "Simple single tool call scenario",
  },

  echo: {
    name: "echo",
    prompt:
      "Can you echo back the message 'Hello from the test agent!' three times?",
    expectedTools: ["echo"],
    description: "Test the echo tool",
  },

  math: {
    name: "math",
    prompt: "What is 15 + 27?",
    expectedTools: ["add"],
    description: "Test the add tool",
  },

  multiStep: {
    name: "multi-step",
    prompt:
      "First, calculate 10 + 5. Then, get the weather in Paris. Finally, echo back 'All done!'",
    expectedTools: ["add", "getWeather", "echo"],
    description: "Multi-step scenario with multiple tool calls",
  },

  parallel: {
    name: "parallel",
    prompt:
      "Get the weather for Amsterdam and Paris at the same time, and tell me which city is warmer.",
    expectedTools: ["getWeather", "getWeather"],
    description: "Parallel tool execution (same tool, different arguments)",
  },

  conversation: {
    name: "conversation",
    prompt: "What's the weather in London?",
    expectedTools: ["getWeather"],
    description: "Start of a multi-turn conversation",
  },
};

/**
 * Get scenario by name or default to weather
 */
export function getScenario(name?: string): Scenario {
  const scenarioName = name || "weather";
  const scenario = scenarios[scenarioName];

  if (!scenario) {
    console.error(`❌ Unknown scenario: ${scenarioName}`);
    console.log("Available scenarios:", Object.keys(scenarios).join(", "));
    process.exit(1);
  }

  return scenario;
}
