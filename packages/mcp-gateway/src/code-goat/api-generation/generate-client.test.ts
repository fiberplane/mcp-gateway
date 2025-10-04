// import { toCodeModeServer } from "../types";

// import { listToolsExample } from "./smoketest-utils";
import { MOCK_SERVERS } from "../test-utils";
import { generateApiClient } from "./generate-client";

const result = generateApiClient(MOCK_SERVERS);

console.log("--------------------------------");
console.log(result);
