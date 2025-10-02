import { generateApiClient } from "./generate-client";
import { listToolsExample } from "./generate-types.test";

const tools = listToolsExample().result.tools;

const result = generateApiClient([
  {
    name: "weather-server",
    tools: tools,
  },
]);

console.log("--------------------------------");
console.log(result);
