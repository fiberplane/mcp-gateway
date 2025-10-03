import { MOCK_SERVERS } from "../test-utils";
import { generateTypes } from "./generate-types";

// Smoketest for the api type generation
// Let's us look at output in the console
const result = await generateTypes(MOCK_SERVERS);

console.log("--------------------------------");
console.log(result);
