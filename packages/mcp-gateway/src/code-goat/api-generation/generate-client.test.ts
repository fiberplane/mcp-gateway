// import { toCodeModeServer } from "../types";
import { generateApiClient } from "./generate-client";
// import { listToolsExample } from "./smoketest-utils";
import { MOCK_SERVERS } from "./smoketest-utils";

const result = generateApiClient(MOCK_SERVERS);

console.log("--------------------------------");
console.log(result);
