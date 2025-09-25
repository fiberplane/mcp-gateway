import { METHODS } from "../../schemas.js";
import type {
  UIEvent,
  UIEventDetails,
  UIEventStatus,
  UIEventType,
} from "../types/events.js";

// Sample data for realistic fake events
const SAMPLE_SERVERS = [
  "everything",
  "file-tools",
  "web-scraper",
  "database",
  "analytics",
];
const SAMPLE_CLIENTS = [
  { name: "mcp-inspector", version: "0.16.8" },
  { name: "claude-desktop", version: "1.2.0" },
  { name: "vs-code-mcp", version: "0.5.2" },
  { name: "custom-client", version: "2.1.0" },
];

const SAMPLE_TOOLS = [
  { name: "echo", description: "Echoes a message with optional repetition" },
  { name: "add", description: "Adds two numbers together" },
  {
    name: "multiply",
    description: "Multiplies multiple numbers with optional precision",
  },
  {
    name: "getWeather",
    description: "Gets weather information for a location",
  },
  { name: "getTinyImage", description: "Returns a tiny base64 encoded image" },
  {
    name: "longRunningOperation",
    description: "Demonstrates a long running operation with progress updates",
  },
  {
    name: "annotatedMessage",
    description: "Returns a rich message with multiple content types",
  },
  { name: "listFiles", description: "Lists files in a directory (simulated)" },
  { name: "generateId", description: "Generates various types of IDs" },
  {
    name: "searchCode",
    description: "Search for code patterns in repositories",
  },
  { name: "readFile", description: "Read contents of a file" },
  { name: "writeFile", description: "Write content to a file" },
];

const SAMPLE_RESOURCES = [
  {
    uri: "file://config.json",
    name: "Application Configuration",
    description: "Main application configuration file",
    mimeType: "application/json",
  },
  {
    uri: "file://readme.md",
    name: "README Documentation",
    description: "Project documentation and setup instructions",
    mimeType: "text/markdown",
  },
  {
    uri: "file://sample.txt",
    name: "Sample Text File",
    description: "A sample text file for demonstration",
    mimeType: "text/plain",
  },
  {
    uri: "file://data.csv",
    name: "Sample Data",
    description: "CSV file with sample data",
    mimeType: "text/csv",
  },
  {
    uri: "http://example.com/api",
    name: "External API",
    description: "Connection to external service",
    mimeType: "application/json",
  },
];

const SAMPLE_PROMPTS = [
  {
    name: "summarize",
    description: "Summarize provided text",
    arguments: [
      { name: "text", description: "Text to summarize", required: true },
    ],
  },
  { name: "fix_code", description: "Suggest code fixes" },
  {
    name: "explain_concept",
    description: "Explain a technical concept",
    arguments: [
      { name: "concept", description: "Concept to explain", required: true },
    ],
  },
  {
    name: "translate",
    description: "Translate text between languages",
    arguments: [
      { name: "text", required: true },
      { name: "target_language", required: true },
    ],
  },
];

const ERROR_MESSAGES = [
  "Tool not found",
  "Invalid parameters",
  "Execution timeout",
  "Permission denied",
  "Network error",
  "Resource unavailable",
  "Rate limit exceeded",
  "Authentication failed",
];

/**
 * Generate fake UI events for testing and development
 */
export function generateFakeUIEvents(
  count: number = 20,
  serverNames?: string[],
): UIEvent[] {
  const events: UIEvent[] = [];
  const now = Date.now();
  const servers = serverNames || SAMPLE_SERVERS;

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(
      now - Math.random() * 60 * 60 * 1000,
    ).toISOString(); // Last hour
    const serverName = randomChoice(servers);
    const client = randomChoice(SAMPLE_CLIENTS);
    const sessionId =
      Math.random() < 0.3
        ? "stateless"
        : `session-${Math.floor(Math.random() * 1000)}`;
    const durationMs = Math.floor(Math.random() * 500) + 10;
    const httpStatus =
      Math.random() < 0.85 ? 200 : randomChoice([400, 404, 500, 502]);

    const event = generateRandomEvent(
      i,
      timestamp,
      serverName,
      client,
      sessionId,
      durationMs,
      httpStatus,
    );
    events.push(event);
  }

  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

/**
 * Generate a single random event
 */
function generateRandomEvent(
  index: number,
  timestamp: string,
  serverName: string,
  client: (typeof SAMPLE_CLIENTS)[0],
  sessionId: string,
  durationMs: number,
  httpStatus: number,
): UIEvent {
  const eventTypes: UIEventType[] = [
    "initialize",
    "tool_list",
    "tool_call",
    "resource_list",
    "resource_read",
    "prompt_list",
    "prompt_get",
    "notification",
    "ping",
  ];

  const type = randomChoice(eventTypes);
  const method = mapEventTypeToMethod(type);
  const requestId =
    type === "notification" ? null : Math.floor(Math.random() * 10000);
  const isError = httpStatus >= 400;
  const status: UIEventStatus = isError
    ? "error"
    : Math.random() < 0.05
      ? "error"
      : "success";

  const id = `fake-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const metadata = {
    serverName,
    sessionId,
    durationMs,
    httpStatus,
    client,
  };

  const summary = generateFakeSummary(type, status, durationMs);
  const details = generateFakeDetails(type, status);
  const error =
    status === "error"
      ? {
          code: -32603,
          message: randomChoice(ERROR_MESSAGES),
          data: { httpStatus },
        }
      : undefined;

  return {
    id,
    timestamp,
    type,
    method,
    requestId,
    status,
    metadata,
    summary,
    details,
    error,
  };
}

/**
 * Map UI event type back to MCP method for consistency
 */
function mapEventTypeToMethod(type: UIEventType): string {
  switch (type) {
    case "initialize":
      return METHODS.INITIALIZE;
    case "ping":
      return METHODS.PING;
    case "tool_list":
      return METHODS.TOOLS.LIST;
    case "tool_call":
      return METHODS.TOOLS.CALL;
    case "resource_list":
      return METHODS.RESOURCES.LIST;
    case "resource_read":
      return METHODS.RESOURCES.READ;
    case "prompt_list":
      return METHODS.PROMPTS.LIST;
    case "prompt_get":
      return METHODS.PROMPTS.GET;
    case "completion":
      return METHODS.COMPLETION.COMPLETE;
    case "elicitation":
      return METHODS.ELICITATION.CREATE;
    case "notification":
      return randomChoice([
        METHODS.NOTIFICATIONS.PROGRESS,
        METHODS.NOTIFICATIONS.TOOLS.LIST_CHANGED,
        METHODS.NOTIFICATIONS.RESOURCES.LIST_CHANGED,
        METHODS.NOTIFICATIONS.PROMPTS.LIST_CHANGED,
      ]);
    default:
      return "unknown/method";
  }
}

/**
 * Generate fake summary text - prioritize showing the JSON-RPC method
 */
function generateFakeSummary(
  type: UIEventType,
  status: UIEventStatus,
  durationMs: number,
): string {
  const method = mapEventTypeToMethod(type);

  if (status === "error") {
    return `${method} failed`;
  }

  switch (type) {
    case "initialize": {
      const client = randomChoice(SAMPLE_CLIENTS);
      return `${method} - ${client.name}`;
    }
    case "ping":
      return `${method} (${durationMs}ms)`;
    case "tool_list": {
      const toolCount = Math.floor(Math.random() * 10) + 1;
      return `${method} - ${toolCount} tools`;
    }
    case "tool_call": {
      const tool = randomChoice(SAMPLE_TOOLS);
      return `${method} - ${tool.name}`;
    }
    case "resource_list": {
      const resourceCount = Math.floor(Math.random() * 8) + 1;
      return `${method} - ${resourceCount} resources`;
    }
    case "resource_read": {
      const resource = randomChoice(SAMPLE_RESOURCES);
      return `${method} - ${resource.name || resource.uri}`;
    }
    case "prompt_list": {
      const promptCount = Math.floor(Math.random() * 6) + 1;
      return `${method} - ${promptCount} prompts`;
    }
    case "prompt_get": {
      const prompt = randomChoice(SAMPLE_PROMPTS);
      return `${method} - ${prompt.name}`;
    }
    case "notification":
      return `${method} - tools changed`;
    default:
      return method;
  }
}

/**
 * Generate fake event details
 */
function generateFakeDetails(
  type: UIEventType,
  status: UIEventStatus,
): UIEventDetails | undefined {
  if (status === "error") {
    return {
      type: "generic",
      request: { attempted: type },
      response: { error: randomChoice(ERROR_MESSAGES) },
    };
  }

  switch (type) {
    case "initialize": {
      const client = randomChoice(SAMPLE_CLIENTS);
      return {
        type: "initialize",
        clientInfo: client,
        serverInfo: {
          name: "comprehensive-mcp-demo",
          version: "2.0.0",
        },
        capabilities: {
          tools: { listChanged: true },
          resources: { listChanged: true },
          prompts: { listChanged: true },
        },
      };
    }

    case "tool_list": {
      const numTools = Math.floor(Math.random() * 8) + 3;
      const tools = Array.from({ length: numTools }, () =>
        randomChoice(SAMPLE_TOOLS),
      );
      return {
        type: "tool_list",
        tools,
      };
    }

    case "tool_call": {
      const tool = randomChoice(SAMPLE_TOOLS);
      return {
        type: "tool_call",
        toolName: tool.name,
        arguments: generateFakeToolArguments(tool.name),
        result: {
          content: [{ type: "text", text: generateFakeToolResult(tool.name) }],
          isError: false,
        },
      };
    }

    case "resource_list": {
      const numResources = Math.floor(Math.random() * 6) + 2;
      const resources = Array.from({ length: numResources }, () =>
        randomChoice(SAMPLE_RESOURCES),
      );
      return {
        type: "resource_list",
        resources,
      };
    }

    case "resource_read": {
      const resource = randomChoice(SAMPLE_RESOURCES);
      return {
        type: "resource_read",
        resource,
        content: [
          {
            type: "text",
            text: generateFakeResourceContent(resource.mimeType),
          },
        ],
      };
    }

    case "prompt_list": {
      const numPrompts = Math.floor(Math.random() * 4) + 2;
      const prompts = Array.from({ length: numPrompts }, () =>
        randomChoice(SAMPLE_PROMPTS),
      );
      return {
        type: "prompt_list",
        prompts,
      };
    }

    case "prompt_get": {
      const prompt = randomChoice(SAMPLE_PROMPTS);
      return {
        type: "prompt_get",
        prompt: {
          name: prompt.name,
          arguments: { text: "Sample input text for processing..." },
        },
        messages: [
          {
            role: "system",
            content: [
              {
                type: "text",
                text: "You are a helpful assistant specialized in code analysis and documentation.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please help me with this task using the provided context.",
              },
            ],
          },
        ],
      };
    }

    case "notification":
      return {
        type: "notification",
        level: randomChoice(["info", "warn"]),
        message: "Tools list has been updated with new capabilities",
        notificationType: "tools/list_changed",
      };

    default:
      return undefined;
  }
}

/**
 * Generate fake tool arguments based on tool name
 */
function generateFakeToolArguments(toolName: string): Record<string, unknown> {
  switch (toolName) {
    case "echo":
      return {
        message: "Hello from MCP!",
        repeat: Math.floor(Math.random() * 3) + 1,
      };
    case "add":
      return {
        a: Math.floor(Math.random() * 100),
        b: Math.floor(Math.random() * 100),
      };
    case "multiply":
      return { numbers: [2, 3, 4], precision: 2 };
    case "getWeather":
      return {
        location: randomChoice(["New York", "London", "Tokyo", "Sydney"]),
        unit: "celsius",
      };
    case "listFiles":
      return {
        path: randomChoice(["/workspace", "/tmp", "/home/user"]),
        includeHidden: false,
      };
    case "searchCode":
      return {
        query: randomChoice(["function", "class", "import", "export"]),
        language: "typescript",
      };
    case "readFile":
      return {
        path: randomChoice(["/config.json", "/README.md", "/package.json"]),
      };
    default:
      return { param: "value" };
  }
}

/**
 * Generate fake tool result based on tool name
 */
function generateFakeToolResult(toolName: string): string {
  switch (toolName) {
    case "echo":
      return "Hello from MCP!\nHello from MCP!";
    case "add":
      return "42";
    case "multiply":
      return "24.00";
    case "getWeather":
      return "Temperature: 22°C, Humidity: 65%, Conditions: Partly cloudy";
    case "listFiles":
      return "config.json\nREADME.md\nsrc/\npackage.json\nnode_modules/";
    case "searchCode":
      return "Found 15 matches in 8 files";
    case "readFile":
      return '{\n  "name": "mcp-gateway",\n  "version": "1.0.0"\n}';
    default:
      return "Operation completed successfully";
  }
}

/**
 * Generate fake resource content based on MIME type
 */
function generateFakeResourceContent(mimeType?: string): string {
  switch (mimeType) {
    case "application/json":
      return '{\n  "config": {\n    "debug": true,\n    "port": 3000\n  }\n}';
    case "text/markdown":
      return "# MCP Gateway\\n\\nThis is a sample MCP server gateway that demonstrates various capabilities.\\n\\n## Features\\n\\n- Tool execution\\n- Resource management\\n- Prompt handling";
    case "text/csv":
      return "name,value,timestamp\\nmetric1,42,2025-09-24T10:00:00Z\\nmetric2,38,2025-09-24T10:01:00Z";
    // case "text/plain":
    default:
      return "This is sample text content from a resource.\\nIt demonstrates how resources can contain various types of information.";
  }
}

/**
 * Utility function to randomly choose from an array
 */
function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate events for a specific server (useful for server-specific views)
 */
export function generateFakeUIEventsForServer(
  serverName: string,
  count: number = 15,
): UIEvent[] {
  return generateFakeUIEvents(count, [serverName]);
}

/**
 * Generate a mix of recent and older events for timeline views
 */
export function generateFakeUIEventsWithTimeSpread(
  count: number = 50,
): UIEvent[] {
  const events: UIEvent[] = [];
  const now = Date.now();

  // 30% recent (last 10 minutes)
  const recentCount = Math.floor(count * 0.3);
  for (let i = 0; i < recentCount; i++) {
    const timestamp = new Date(
      now - Math.random() * 10 * 60 * 1000,
    ).toISOString();
    events.push(...generateFakeUIEvents(1).map((e) => ({ ...e, timestamp })));
  }

  // 40% medium (last hour)
  const mediumCount = Math.floor(count * 0.4);
  for (let i = 0; i < mediumCount; i++) {
    const timestamp = new Date(
      now - 10 * 60 * 1000 - Math.random() * 50 * 60 * 1000,
    ).toISOString();
    events.push(...generateFakeUIEvents(1).map((e) => ({ ...e, timestamp })));
  }

  // 30% older (last day)
  const olderCount = count - recentCount - mediumCount;
  for (let i = 0; i < olderCount; i++) {
    const timestamp = new Date(
      now - 60 * 60 * 1000 - Math.random() * 23 * 60 * 60 * 1000,
    ).toISOString();
    events.push(...generateFakeUIEvents(1).map((e) => ({ ...e, timestamp })));
  }

  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}
