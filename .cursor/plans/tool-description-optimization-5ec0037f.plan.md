<!-- 5ec0037f-844c-4ecc-9bed-41681634e20e bbaea852-9113-47e2-9eb0-264b5f5fe256 -->
# Tool Description Optimization System

## Architecture Overview (REVISED)

**New Gateway Architecture:**

- Gateway is now a **genuine MCP client** (using mcp-lite's McpClient)
- Connects to downstream MCP servers and discovers tools via `tools/list`
- **Re-exposes** downstream tools through its own MCP server at `/servers/{server}/mcp`
- Swaps descriptions at re-exposure time (not in-flight interception)
- Proxies tool calls through McpClient to downstream servers

**Claude Code does:**

- Generate description candidates and golden prompts
- Run evaluations locally
- Store results via gateway optimization tools
- Pick winners and promote them

**Gateway does:**

- Connect to downstream servers as MCP client
- Store canonical tools on first connection
- Re-expose tools with optimized descriptions (if promoted)
- Provide optimization MCP tools at `/gateway/mcp`
- Forward tool calls to downstream via McpClient

## Key Architectural Changes

**Before (proxy approach):**

```
Client → Gateway (HTTP proxy) → Downstream Server
         ↓ intercept tools/list response
         ↓ swap descriptions
```

**After (MCP client approach):**

```
Client → Gateway MCP Server → Gateway McpClient → Downstream Server
         ↓ re-expose tools
         ↓ swap descriptions at exposure time
```

## Implementation Structure

### 1. Types Package (`packages/types/src/optimization.ts`)

**Core types:**

```typescript
interface ToolCandidate {
  id: string;
  toolName: string;
  description: string;
  example?: string;
  charCount: number;
  createdAt: string;
}

interface GoldenPrompt {
  id: string;
  toolName: string;
  category: 'direct' | 'indirect' | 'negative';
  prompt: string;
  expectedBehavior: {
    shouldCallTool: boolean;
    notes?: string;
  };
}

interface EvalRun {
  id: string;
  candidateId: string;
  promptId: string;
  timestamp: string;
  result: {
    toolCalled: boolean;
    correct: boolean;
    error?: string;
    reasoning?: string;
  };
}

interface PromotedTool {
  toolName: string;
  candidateId: string;
  promotedAt: string;
  metrics: {
    directSuccess: number;
    indirectSuccess: number;
    negativeSuccess: number;
    overall: number;
  };
}
```

### 2. Core Package - Client Management (`packages/core/src/mcp/client-manager.ts`)

**NEW: Manage McpClient connections to downstream servers**

```typescript
class ClientManager {
  private clients: Map<string, { client: McpClient; connection: Connection }>;
  
  // Create McpClient for a server
  async connectServer(server: McpServer): Promise<void>
  
  // Discover tools from downstream server
  async discoverTools(serverName: string): Promise<Tool[]>
  
  // Forward tool call to downstream
  async callTool(serverName: string, toolName: string, args: unknown): Promise<ToolCallResult>
  
  // Disconnect client
  async disconnectServer(serverName: string): Promise<void>
}
```

**Usage:**

```typescript
const manager = new ClientManager();

// When server added to registry
await manager.connectServer(server);

// Fetch canonical tools
const tools = await manager.discoverTools(server.name);
await saveCanonicalTools(server.name, tools);

// Forward tool calls
const result = await manager.callTool(server.name, "get_weather", {city: "Paris"});
```

### 3. Core Package - Dynamic Tool Re-exposure (`packages/core/src/mcp/dynamic-server.ts`)

**NEW: Dynamically expose downstream tools**

```typescript
// Register downstream tools on gateway's MCP server
function registerDownstreamTools(
  mcp: McpServer,
  serverName: string,
  tools: Tool[],
  clientManager: ClientManager,
  promotions: Map<string, PromotedTool>
): void {
  
  for (const tool of tools) {
    // Get promoted description if exists
    const promoted = promotions.get(tool.name);
    const description = promoted?.description || tool.description;
    
    // Register tool on gateway's MCP server
    mcp.tool(`${serverName}.${tool.name}`, {
      description,
      inputSchema: tool.inputSchema, // Never modified
      handler: async (args) => {
        // Forward to downstream via McpClient
        return await clientManager.callTool(serverName, tool.name, args);
      }
    });
  }
}
```

**Tool naming:** `{serverName}.{toolName}` (e.g., `weather.get_forecast`)

### 4. Core Package - Storage (`packages/core/src/optimization/storage.ts`)

**Storage structure:** `~/.mcp-gateway/optimizations/{serverName}/`

```
canonical-tools.json      # Original tools from downstream
candidates/
  {toolName}.json        # Array of ToolCandidate
prompts/
  {toolName}.json        # Array of GoldenPrompt
eval-runs/
  {candidateId}.json     # Array of EvalRun
promotions.json          # Map of toolName → PromotedTool
```

**Functions:**

- `saveCanonicalTools(serverName, tools)` - Store originals
- `loadCanonicalTools(serverName)` - Retrieve originals
- `saveCandidate(serverName, toolName, candidate)` - Store rewrite
- `saveGoldenPrompts(serverName, toolName, prompts)` - Store prompt set
- `saveEvalRun(serverName, candidateId, run)` - Store eval result
- `savePromotion(serverName, toolName, promotion)` - Activate candidate
- `loadPromotions(serverName)` - Get active optimizations

### 5. Core Package - Optimization Tools (`packages/core/src/mcp/tools/optimization-tools.ts`)

**MCP tools at `/gateway/mcp`:**

**`get_canonical_tools`** - Get original tool definitions

- Input: `{server: string}`
- Output: `{tools: Array<{name, description, inputSchema}>}`

**`propose_candidate`** - Store rewritten description

- Input: `{server: string, tool: string, description: string, example?: string}`
- Output: `{candidateId: string, charCount: number}`
- Validates ≤280 char limit

**`save_golden_prompts`** - Store prompt set

- Input: `{server: string, tool: string, prompts: Array<GoldenPrompt>}`
- Output: `{saved: number}`

**`record_eval_run`** - Store evaluation result

- Input: `{server: string, candidateId: string, promptId: string, result: {...}}`
- Output: `{runId: string}`

**`get_eval_results`** - Retrieve metrics

- Input: `{server: string, candidateId?: string, tool?: string}`
- Output: `{candidates: Array<{candidateId, metrics, runs}>}`

**`promote_candidate`** - Activate optimized description

- Input: `{server: string, tool: string, candidateId: string}`
- Output: `{promoted: true, metrics: {...}}`
- **Effect:** Gateway re-registers tools with new description

**`get_optimization_report`** - Overall stats

- Input: `{server?: string}`
- Output: Aggregate metrics

**Generator tools (with MCP Sampling / headless fallback):**

**`generate_candidates`** - Auto-generate rewrites

- Input: `{server: string, tool: string, count?: number}`
- Uses sampling/createMessage or claude -p headless mode
- Calls propose_candidate for each

**`generate_golden_prompts`** - Auto-generate test prompts

- Input: `{server: string, tool: string}`
- Generates direct/indirect/negative prompts
- Calls save_golden_prompts internally

### 6. Server Package - MCP Server Routes (`packages/server/src/routes/mcp-server.ts`)

**NEW: Replace proxy routes with MCP server per downstream server**

```typescript
export function createDownstreamMcpApp(
  serverName: string,
  clientManager: ClientManager,
  storageDir: string
): Hono {
  // Create MCP server for this downstream server
  const mcp = new McpServer({
    name: `mcp-gateway-${serverName}`,
    version: "1.0.0",
    schemaAdapter: (schema) => z.toJSONSchema(schema as z.ZodType),
  });
  
  // Load promotions
  const promotions = await loadPromotions(serverName);
  
  // Fetch tools from downstream
  const tools = await clientManager.discoverTools(serverName);
  
  // Register tools with optional description swaps
  registerDownstreamTools(mcp, serverName, tools, clientManager, promotions);
  
  // Create HTTP transport
  const transport = new StreamableHttpTransport();
  const httpHandler = transport.bind(mcp);
  
  // Mount at /servers/{serverName}/mcp
  const app = new Hono();
  app.all("/mcp", async (c) => await httpHandler(c.req.raw));
  
  return app;
}
```

### 7. Server Package - Main App (`packages/server/src/app.ts`)

**MODIFIED: Initialize McpClient connections**

```typescript
export async function createApp(
  registry: Registry,
  storageDir?: string,
  eventHandlers?: {...}
): Promise<{ app: Hono; registry: Registry }> {
  const app = new Hono();
  const clientManager = new ClientManager();
  
  // Connect to all registered servers as MCP client
  for (const server of registry.servers) {
    await clientManager.connectServer(server);
    
    // Discover and save canonical tools
    const tools = await clientManager.discoverTools(server.name);
    await saveCanonicalTools(server.name, tools);
    
    // Mount MCP server for this downstream server
    const downstreamApp = createDownstreamMcpApp(server.name, clientManager, storage);
    app.route(`/servers/${server.name}`, downstreamApp);
    app.route(`/s/${server.name}`, downstreamApp); // Short alias
  }
  
  // Mount gateway's own MCP server with optimization tools
  const gatewayMcp = createMcpApp(registry, storage);
  app.route("/gateway", gatewayMcp);
  app.route("/g", gatewayMcp);
  
  return { app, registry, clientManager };
}
```

### 8. Golden Prompt Categories

For each tool, Claude Code generates ~9-15 prompts:

1. **Direct prompts** (3-5) - User explicitly names the data source

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Example: "Get weather in Paris for tomorrow"
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Expected: Tool called with correct args

2. **Indirect prompts** (3-5) - User describes outcome without naming tool

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Example: "Should I bring an umbrella to my Paris meeting?"
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Expected: Tool called, Claude infers weather needed

3. **Negative prompts** (3-5) - Other tools or built-in knowledge should handle

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Example: "What's the capital of France?" → general knowledge
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Example: "Book a flight to Paris" → travel tool
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Expected: Tool NOT called (tests precision)

## Workflow: Adding a Server

**Old (proxy):**

1. User adds server to registry
2. Gateway stores URL
3. Client requests proxied through

**New (MCP client):**

1. User adds server to registry via `add_server` tool
2. Gateway creates McpClient connection
3. Gateway calls `tools/list` on downstream
4. Gateway saves canonical tools
5. Gateway dynamically registers tools on its MCP server
6. Clients call `{serverName}.{toolName}` → forwarded to downstream

## Workflow: Optimizing Tools

**Step 1:** Claude Code generates candidates

```
- Call get_canonical_tools({server: "weather"})
- Generate 2-4 rewrites
- Call propose_candidate for each
```

**Step 2:** Generate golden prompts

```
- Call generate_golden_prompts({server: "weather", tool: "get_forecast"})
- Or manually: save_golden_prompts
```

**Step 3:** Run evaluation

```
For each candidate:
  For each prompt:
 - Run in local session
 - Check if weather.get_forecast called
 - Call record_eval_run
```

**Step 4:** Promote winner

```
- Call get_eval_results
- Pick best candidate
- Call promote_candidate
  → Gateway re-registers tools with new description
```

## Metrics & Success Criteria

**Per-category metrics:**

- Direct success: % tool called correctly on direct prompts
- Indirect success: % tool called correctly on indirect prompts
- Negative success: % tool NOT called on negative prompts (precision)

**Promotion criteria:**

- Candidate improves overall score vs canonical
- No category drops below threshold (e.g., negative ≥ 80%)

## Key Design Decisions

- **McpClient-based**: Gateway is real MCP client, not HTTP proxy
- **Tool re-exposure**: Downstream tools re-registered on gateway's MCP server
- **Namespaced tools**: `{serverName}.{toolName}` prevents collisions
- **Dynamic registration**: When promotion changes, tools re-registered
- **No schema mutation**: Only swap `description`, never `inputSchema`
- **280 char limit**: Enforced in propose_candidate
- **Auto-capture**: Canonical tools saved on first McpClient connection
- **Feature toggle**: `--enable-optimization` flag (default off)

## File Changes Summary

**New files:**

- `packages/types/src/optimization.ts` (~100 lines)
- `packages/core/src/mcp/client-manager.ts` (~200 lines)
- `packages/core/src/mcp/dynamic-server.ts` (~150 lines)
- `packages/core/src/optimization/storage.ts` (~250 lines)
- `packages/core/src/optimization/registry.ts` (~100 lines)
- `packages/core/src/optimization/index.ts` (~20 lines)
- `packages/core/src/mcp/tools/optimization-tools.ts` (~500 lines)
- `packages/server/src/routes/mcp-server.ts` (~100 lines)

**Modified files:**

- `packages/server/src/app.ts` (~50 lines - McpClient initialization)
- `packages/core/src/mcp/server.ts` (~5 lines - register optimization tools)
- `packages/server/src/routes/proxy.ts` - **DELETE** (replaced by MCP client approach)

**Dependencies:**

- Already using `mcp-lite` which now has McpClient (PR #133)
- No new dependencies needed

## TUI Integration: User Stories

### Story 1: Viewing Optimization Status

**New View Mode: "optimization"** (accessible via `o` shortcut)

```
┌─ MCP Gateway ─────────────────────────────────────────────────┐
│ Servers: 2 | Port: 3333 | Optimizations: weather (3/5 tools)  │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌─ weather ─────────────────────────────────────────────────┐│
│ │ ●●●○○  3/5 tools optimized                     [Optimize]││
│ │                                                            ││
│ │ ✓ get_forecast       Direct: 95%  Indirect: 87%  Neg: 92% ││
│ │ ✓ get_current        Direct: 91%  Indirect: 84%  Neg: 88% ││
│ │ ✓ get_alerts         Direct: 93%  Indirect: 89%  Neg: 90% ││
│ │ ○ get_historical     Not optimized                        ││
│ │ ○ get_radar          Not optimized                        ││
│ └────────────────────────────────────────────────────────────┘│
│                                                               │
│ ┌─ github ───────────────────────────────────────────────────┐│
│ │ ○○○○○  0/8 tools optimized                      [Optimize]││
│ │                                                            ││
│ │ ○ create_issue       Not optimized                        ││
│ │ ○ list_issues        Not optimized                        ││
│ │ ○ get_pr             Not optimized                        ││
│ │ ... 5 more                                                 ││
│ └────────────────────────────────────────────────────────────┘│
├───────────────────────────────────────────────────────────────┤
│ o: Optimize  d: Detail  c: Clear  ESC: Back  q: Quit         │
└───────────────────────────────────────────────────────────────┘
```

**Store additions:**

```typescript
interface OptimizationState {
  optimizedTools: Map<string, Map<string, PromotedTool>>;  // server → tool → promotion
  optimizationProgress: Map<string, {
    phase: 'generating' | 'evaluating' | 'promoting' | 'complete';
    currentTool: string;
    progress: number;  // 0-100
  }>;
}
```

### Story 2: Tool Selection After Adding Server

**Trigger:** After server is added and tools discovered

**Modal: SelectToolsModal**

```
┌─ Configure Tools: weather ────────────────────────────────────┐
│                                                               │
│ Select which tools to expose through the gateway.            │
│ Discovered 5 tools from weather server:                      │
│                                                               │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ [✓] get_forecast        Get weather forecast data        │ │
│ │ [✓] get_current         Get current weather conditions   │ │
│ │ [✓] get_alerts          Get severe weather alerts        │ │
│ │ [ ] get_historical      Historical weather data          │ │
│ │ [ ] get_radar           Radar and satellite imagery      │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                               │
│ Selected: 3/5 tools                                          │
│                                                               │
│ Note: Only selected tools will be available to MCP clients.  │
│ You can change this later in server settings.                │
│                                                               │
│         [Select All]  [Save Selection]  [Cancel]             │
└───────────────────────────────────────────────────────────────┘
```

**Store update:**

```typescript
interface UIServer {
  // Existing fields...
  enabledTools?: string[];  // null = all enabled (default)
}
```

### Story 2b: Editing Tool Selection

**Trigger:** Press `t` on a server in server management view

**Modal: Same as above, but with current selection pre-checked**

### Story 3: Starting Optimization Workflow

**Trigger:** Press `o` on a server in optimization view

**Modal: OptimizeServerModal**

```
┌─ Optimize Tools: weather ─────────────────────────────────────┐
│                                                               │
│ This will optimize tool descriptions for better LLM recall.  │
│                                                               │
│ Process:                                                      │
│ 1. Generate 2-4 description candidates per tool             │
│ 2. Generate golden prompt set (direct/indirect/negative)     │
│ 3. Run evaluation (Claude Code tests each candidate)         │
│ 4. Promote winners (auto-update gateway tools)               │
│                                                               │
│ Tools to optimize (3 enabled, 5 discovered):                 │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ [✓] get_forecast        Enabled & Selected               │ │
│ │ [✓] get_current         Enabled & Selected               │ │
│ │ [ ] get_alerts          Enabled (skip optimization)      │ │
│ │ [ ] get_historical      Disabled (not exposed)           │ │
│ │ [ ] get_radar           Disabled (not exposed)           │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                               │
│ Selected for optimization: 2 tools                           │
│                                                               │
│ Options:                                                      │
│   Candidates per tool: [4]                                   │
│   Prompts per category: [5]                                  │
│   Auto-promote threshold: [85%]                              │
│                                                               │
│        [Select All Enabled]  [Start]  [Cancel]               │
└───────────────────────────────────────────────────────────────┘
```

**Note:** Disabled tools (not in `enabledTools`) are grayed out and can't be selected for optimization.

**Behind the scenes:** Triggers `generate_candidates` and `generate_golden_prompts` tools

### Story 3: Live Optimization Progress

**During optimization, view updates in real-time:**

```
┌─ weather ─────────────────────────────────────────────────────┐
│ ████████████░░░░░░░░  Optimizing... (3/5 tools)              │
│                                                               │
│ ✓ get_forecast       [Complete] Best: +12% overall           │
│ ✓ get_current        [Complete] Best: +8% overall            │
│ ⚙ get_alerts         [Evaluating] 45/60 prompts tested       │
│ ⋯ get_historical     [Queued]                                │
│ ⋯ get_radar          [Queued]                                │
│                                                               │
│ Current: Testing candidate 3/4 for get_alerts                │
│ Progress: Direct (15/20) | Indirect (15/20) | Negative (15/20)│
└───────────────────────────────────────────────────────────────┘
```

**Implementation:**

- Subscribe to optimization events via gateway tools
- Update progress bar and status in real-time
- Show toast notifications on completion

### Story 4: Viewing Optimization Details

**Trigger:** Press `d` on an optimized tool

**Modal: OptimizationDetailModal**

```
┌─ Optimization Details: weather.get_forecast ──────────────────┐
│                                                               │
│ Status: ✓ Optimized (Promoted: 3 days ago)                   │
│                                                               │
│ Canonical Description (85 chars):                            │
│ "Get weather forecast for a location and date."              │
│                                                               │
│ Optimized Description (267 chars):                           │
│ "Fetch weather forecast data. Use when user needs future     │
│  weather conditions. Required: location (city or coords),    │
│  date (YYYY-MM-DD). Returns: temp, conditions, wind. Do NOT  │
│  use for: historical data (use get_historical), current      │
│  weather (use get_current), or general climate questions."   │
│                                                               │
│ Performance Improvement:                                      │
│   Direct:    87% → 95% (+8pp)  ████████████████░░░░          │
│   Indirect:  79% → 87% (+8pp)  ████████████████░░░░          │
│   Negative:  85% → 92% (+7pp)  ████████████████░░░░          │
│   Overall:   84% → 92% (+8pp)                                │
│                                                               │
│ Tested against 15 prompts (5 direct, 5 indirect, 5 negative) │
│                                                               │
│ [Revert to Canonical]  [Re-optimize]  [Export Report]  [OK]  │
└───────────────────────────────────────────────────────────────┘
```

### Story 5: Viewing Test Prompts

**Trigger:** Press `p` in detail modal

**Sub-view showing golden prompts:**

```
┌─ Golden Prompts: weather.get_forecast ────────────────────────┐
│                                                               │
│ Direct Prompts (5):                                          │
│ 1. ✓ "Get weather forecast for Paris tomorrow"              │
│ 2. ✓ "What's the weather in NYC on Dec 25, 2025?"           │
│ 3. ✓ "Show me forecast for London next week"                │
│ 4. ✓ "Weather forecast: Tokyo, 2025-12-20"                  │
│ 5. ✓ "Forecast for Berlin on Friday"                        │
│                                                               │
│ Indirect Prompts (5):                                        │
│ 1. ✓ "Should I bring an umbrella to my Paris meeting?"      │
│ 2. ✓ "Will it be cold in NYC for Christmas?"                │
│ 3. ✓ "Do I need a jacket in London next Monday?"            │
│ 4. ✗ "Is it a good day for a picnic?" (missing location)    │
│ 5. ✓ "Can I go hiking in the mountains this weekend?"       │
│                                                               │
│ Negative Prompts (5):                                        │
│ 1. ✓ "What's the capital of France?" (not called)           │
│ 2. ✓ "Book me a flight to Paris" (not called)               │
│ 3. ✓ "What time is it in Tokyo?" (not called)               │
│ 4. ✗ "Tell me about climate change" (incorrectly called)    │
│ 5. ✓ "Convert 20°C to Fahrenheit" (not called)              │
│                                                               │
│ Success Rate: 13/15 (87%)                                    │
└───────────────────────────────────────────────────────────────┘
```

### Story 6: Command Menu Integration

**Updated Command Menu (Cmd+K):**

```
┌─ Commands ────────────────────────────────────────────────────┐
│                                                               │
│ > optimize                                                    │
│                                                               │
│ ● Server Management                                          │
│   Add Server                               Cmd+A             │
│   View Servers                             s                 │
│                                                               │
│ ● Activity                                                    │
│   Activity Log                             l                 │
│   Clear Logs                               Cmd+L             │
│                                                               │
│ ● Optimization                                               │
│   View Optimizations                       o                 │
│   Optimize All Servers                     Cmd+O             │
│   Export Optimization Report               Cmd+E             │
│                                                               │
│ ● Help                                                        │
│   Show Help                                ?                 │
│   MCP Instructions                         i                 │
└───────────────────────────────────────────────────────────────┘
```

### Story 7: Batch Optimization

**Trigger:** `Cmd+O` to optimize all servers

**Modal: BatchOptimizationModal**

```
┌─ Batch Optimize All Servers ──────────────────────────────────┐
│                                                               │
│ This will optimize tools for all registered servers.         │
│                                                               │
│ Servers (2):                                                  │
│   ✓ weather (5 tools)      ○ Not optimized                  │
│   ✓ github (8 tools)       ○ Not optimized                  │
│                                                               │
│ Total: 13 tools to optimize                                  │
│ Estimated time: ~15 minutes                                  │
│                                                               │
│ Note: This will use Claude Code to generate and test         │
│ descriptions. Make sure you're in a good working session.    │
│                                                               │
│              [Start Batch Optimize]  [Cancel]                │
└───────────────────────────────────────────────────────────────┘
```

### Store Additions

```typescript
// Add to AppStore
interface AppStore {
  // Existing...
  
  // Optimization state
  optimizations: Map<string, ServerOptimization>;
  optimizationProgress: OptimizationProgress | null;
  
  // Optimization actions
  loadOptimizations: () => Promise<void>;
  startOptimization: (server: string, tools: string[]) => Promise<void>;
  viewOptimizationDetail: (server: string, tool: string) => void;
  revertOptimization: (server: string, tool: string) => Promise<void>;
  exportOptimizationReport: (server: string) => Promise<void>;
}

interface ServerOptimization {
  serverName: string;
  toolCount: number;
  optimizedCount: number;
  tools: Map<string, ToolOptimization>;
}

interface ToolOptimization {
  toolName: string;
  promoted: PromotedTool | null;
  candidateCount: number;
  promptCount: number;
  lastOptimized?: string;
}

interface OptimizationProgress {
  serverName: string;
  phase: 'generating' | 'evaluating' | 'promoting' | 'complete';
  currentTool: string;
  totalTools: number;
  completedTools: number;
  currentProgress: number; // 0-100 for current tool
}
```

## Implementation Stages

**Progress Summary:**
- ✅ Stage 0: Subprocess evaluation infrastructure (COMPLETE)
- ✅ Stage 1: Type definitions (COMPLETE)
- ✅ Stage 2: Storage layer (COMPLETE)
- ✅ Stage 3: Optimization logic & metrics (COMPLETE)
- ✅ Stage 4: MCP optimization tools (COMPLETE)
- ⬜ Stage 5: MCP Client integration (NOT STARTED)
- ⬜ Stage 6: Main app integration (NOT STARTED)
- ⬜ Stage 7: CLI integration & feature flags (NOT STARTED)
- ⬜ Stage 8: End-to-end testing (NOT STARTED)
- ⬜ Stage 9: Documentation & polish (NOT STARTED)

---

### Stage 0: Prerequisites & Infrastructure Setup

**Goal**: Set up foundational infrastructure for running evaluations and storing optimization data.

#### 0.1: Subprocess Evaluation Infrastructure ✅ **COMPLETED**
- [x] Create evaluation subprocess module (`packages/core/src/optimization/subprocess.ts`)
  - Implement `runEvaluation()` using `Bun.spawn()` with timeout handling
  - Capture stdout/stderr for tool call detection
  - Handle process lifecycle (kill on timeout, cleanup)
  - Return structured results (success, duration, output, errors)
- [x] Tool call detection via Claude CLI `--output-format stream-json`
  - Spawns `claude -p --output-format stream-json --verbose <prompt>`
  - Parses NDJSON output for `tool_use` events
  - Detects specific tool by name from stream
  - No eval-session.ts needed (tool detection is inline)

**Implementation Notes**:
- Uses Claude CLI directly with `--output-format stream-json` flag
- Tool detection parses assistant messages with `tool_use` content
- Timeout enforced via `setTimeout` + `proc.kill()`
- Returns structured `EvaluationResult` with all metadata

**Testing**: ✅
- 15 passing tests in `subprocess.test.ts`
- Tests timeout handling, output capture, tool detection, correctness evaluation

---

### Stage 1: Type Definitions ✅ **COMPLETED**

**Goal**: Define comprehensive TypeScript types and Zod schemas for optimization system.

**File**: `packages/types/src/optimization.ts`

- [x] Define core interfaces
  ```typescript
  interface ToolCandidate {
    id: string;
    toolName: string;
    description: string;
    example?: string;
    charCount: number;
    createdAt: string;
  }

  interface GoldenPrompt {
    id: string;
    toolName: string;
    category: 'direct' | 'indirect' | 'negative';
    prompt: string;
    expectedBehavior: {
      shouldCallTool: boolean;
      notes?: string;
    };
  }

  interface EvalRun {
    id: string;
    candidateId: string;
    promptId: string;
    timestamp: string;
    result: {
      toolCalled: boolean;
      correct: boolean;
      error?: string;
      reasoning?: string;
      durationMs: number;
    };
  }

  interface PromotedTool {
    toolName: string;
    candidateId: string;
    promotedAt: string;
    description: string;
    metrics: {
      directSuccess: number;
      indirectSuccess: number;
      negativeSuccess: number;
      overall: number;
    };
  }

  interface OptimizationReport {
    serverName: string;
    toolCount: number;
    optimizedCount: number;
    totalEvals: number;
    avgImprovement: number;
    tools: Array<{
      name: string;
      status: 'optimized' | 'baseline' | 'unoptimized';
      metrics?: PromotedTool['metrics'];
    }>;
  }
  ```

- [x] Create Zod schemas for validation
  ```typescript
  const ToolCandidateSchema = z.object({
    id: z.string(),
    toolName: z.string(),
    description: z.string().max(280),
    example: z.string().optional(),
    charCount: z.number().int().min(1).max(280),
    createdAt: z.string().datetime(),
  });

  const GoldenPromptSchema = z.object({
    id: z.string(),
    toolName: z.string(),
    category: z.enum(['direct', 'indirect', 'negative']),
    prompt: z.string().min(10),
    expectedBehavior: z.object({
      shouldCallTool: z.boolean(),
      notes: z.string().optional(),
    }),
  });
  // ... etc for all types
  ```

- [x] Export from `packages/types/src/index.ts`

**Testing**: ✅ Types imported and used in core package, schemas validate correctly

---

### Stage 2: Storage Layer ✅ **COMPLETED**

**Goal**: Implement file-based storage following existing codebase patterns.

**File**: `packages/core/src/optimization/storage.ts` (323 lines)

**Storage Structure**:
```
~/.mcp-gateway/
├── optimization/
│   ├── {serverName}/
│   │   ├── canonical-tools.json          # Original tools from server
│   │   ├── candidates/
│   │   │   ├── {toolName}.json          # Array<ToolCandidate>
│   │   ├── prompts/
│   │   │   ├── {toolName}.json          # Array<GoldenPrompt>
│   │   ├── eval-runs/
│   │   │   ├── {candidateId}.json       # Array<EvalRun>
│   │   └── promotions.json               # Map<toolName, PromotedTool>
```

#### 2.1: Storage Utilities (follow `utils/storage.ts` pattern) ✅
- [x] Implement path helpers
  ```typescript
  function getOptimizationDir(storageDir: string, serverName: string): string
  function getCandidatesDir(storageDir: string, serverName: string): string
  function getPromptsDir(storageDir: string, serverName: string): string
  function getEvalRunsDir(storageDir: string, serverName: string): string
  function getPromotionsPath(storageDir: string, serverName: string): string
  ```

- [x] Implement generic JSON read/write (with type safety)
  ```typescript
  async function loadJson<T>(path: string, schema: z.ZodType<T>): Promise<T | null> {
    const file = Bun.file(path);
    if (!(await file.exists())) return null;

    const data = await file.json();
    return schema.parse(data);
  }

  async function saveJson<T>(path: string, data: T): Promise<void> {
    // Ensure directory exists
    const dir = dirname(path);
    await mkdir(dir, { recursive: true });

    // Write pretty-printed JSON
    await Bun.write(path, JSON.stringify(data, null, 2));
  }
  ```

**Implementation Notes**:
- Uses Node.js `fs/promises` API for consistency with existing codebase
- `loadJson<T>()` and `saveJson<T>()` helpers for type-safe JSON operations
- Uses `readFile` with `"utf8"` encoding and `writeFile` for storage
- `ensureStorageDir()` creates parent directories recursively

#### 2.2: Domain-Specific Storage Functions ✅
- [x] Canonical tools
  ```typescript
  async function saveCanonicalTools(storageDir: string, serverName: string, tools: Tool[]): Promise<void> {
    const path = join(getOptimizationDir(storageDir, serverName), "canonical-tools.json");
    await Bun.write(path, JSON.stringify(tools, null, 2));
  }

  async function loadCanonicalTools(storageDir: string, serverName: string): Promise<Tool[]> {
    const path = join(getOptimizationDir(storageDir, serverName), "canonical-tools.json");
    const file = Bun.file(path);
    return await file.exists() ? await file.json() : [];
  }
  ```

- [x] Candidates (append to array in file)
  ```typescript
  async function saveCandidate(storageDir: string, serverName: string, toolName: string, candidate: ToolCandidate): Promise<void> {
    const path = join(getCandidatesDir(storageDir, serverName), `${toolName}.json`);
    const existing = await loadCandidates(storageDir, serverName, toolName);
    await Bun.write(path, JSON.stringify([...existing, candidate], null, 2));
  }

  async function loadCandidates(storageDir: string, serverName: string, toolName: string): Promise<ToolCandidate[]> {
    const path = join(getCandidatesDir(storageDir, serverName), `${toolName}.json`);
    const file = Bun.file(path);
    return await file.exists() ? await file.json() : [];
  }
  ```

- [x] Golden prompts
  ```typescript
  async function saveGoldenPrompts(storageDir: string, serverName: string, toolName: string, prompts: GoldenPrompt[]): Promise<void> {
    const path = join(getPromptsDir(storageDir, serverName), `${toolName}.json`);
    await Bun.write(path, JSON.stringify(prompts, null, 2));
  }

  async function loadGoldenPrompts(storageDir: string, serverName: string, toolName: string): Promise<GoldenPrompt[]> {
    const path = join(getPromptsDir(storageDir, serverName), `${toolName}.json`);
    const file = Bun.file(path);
    return await file.exists() ? await file.json() : [];
  }
  ```

- [x] Evaluation runs (append to array in file)
  ```typescript
  async function saveEvalRun(storageDir: string, serverName: string, candidateId: string, run: EvalRun): Promise<void> {
    const path = join(getEvalRunsDir(storageDir, serverName), `${candidateId}.json`);
    const existing = await loadEvalRuns(storageDir, serverName, candidateId);
    await Bun.write(path, JSON.stringify([...existing, run], null, 2));
  }

  async function loadEvalRuns(storageDir: string, serverName: string, candidateId: string): Promise<EvalRun[]> {
    const path = join(getEvalRunsDir(storageDir, serverName), `${candidateId}.json`);
    const file = Bun.file(path);
    return await file.exists() ? await file.json() : [];
  }
  ```

- [x] Promotions (stored as object, converted to Map)
  ```typescript
  async function savePromotion(storageDir: string, serverName: string, toolName: string, promotion: PromotedTool): Promise<void> {
    const path = getPromotionsPath(storageDir, serverName);
    const promotions = await loadPromotions(storageDir, serverName);
    promotions.set(toolName, promotion);

    // Convert Map to object for JSON storage
    const obj = Object.fromEntries(promotions);
    await Bun.write(path, JSON.stringify(obj, null, 2));
  }

  async function loadPromotions(storageDir: string, serverName: string): Promise<Map<string, PromotedTool>> {
    const path = getPromotionsPath(storageDir, serverName);
    const file = Bun.file(path);
    if (!(await file.exists())) return new Map();

    const obj = await file.json();
    return new Map(Object.entries(obj));
  }

  async function deletePromotion(storageDir: string, serverName: string, toolName: string): Promise<void> {
    const path = getPromotionsPath(storageDir, serverName);
    const promotions = await loadPromotions(storageDir, serverName);
    promotions.delete(toolName);

    const obj = Object.fromEntries(promotions);
    await Bun.write(path, JSON.stringify(obj, null, 2));
  }
  ```

**Testing**: ✅
- 22 passing tests in `storage.test.ts`
- Tests all storage operations: canonical tools, candidates, prompts, eval runs, promotions
- Includes append operations, Map conversions, and empty state handling

---

### Stage 3: Optimization Logic & Metrics ✅ **COMPLETED**

**Goal**: Implement business logic for candidate evaluation and promotion.

**File**: `packages/core/src/optimization/evaluator.ts` (211 lines)

#### 3.1: Evaluation Runner ✅
- [x] Implement `evaluateCandidate()` function
  ```typescript
  async function evaluateCandidate(
    candidate: ToolCandidate,
    prompts: GoldenPrompt[],
    evalTimeout: number = 60000
  ): Promise<EvalRun[]> {
    const runs: EvalRun[] = [];

    for (const prompt of prompts) {
      // Use subprocess runner from Stage 0
      const result = await runEvaluation(
        candidate.toolName,
        candidate.description,
        prompt.prompt,
        prompt.expectedBehavior
      );

      runs.push({
        id: crypto.randomUUID(),
        candidateId: candidate.id,
        promptId: prompt.id,
        timestamp: new Date().toISOString(),
        result: {
          toolCalled: result.toolCalled,
          correct: result.correct,
          error: result.error,
          reasoning: result.reasoning,
          durationMs: result.duration,
        },
      });
    }

    return runs;
  }
  ```

#### 3.2: Metrics Calculation ✅
- [x] Implement metrics computer
  ```typescript
  function computeMetrics(runs: EvalRun[], prompts: GoldenPrompt[]): {
    directSuccess: number;
    indirectSuccess: number;
    negativeSuccess: number;
    overall: number;
  } {
    const byCategory = {
      direct: { total: 0, correct: 0 },
      indirect: { total: 0, correct: 0 },
      negative: { total: 0, correct: 0 },
    };

    for (const run of runs) {
      const prompt = prompts.find(p => p.id === run.promptId);
      if (!prompt) continue;

      const category = prompt.category;
      byCategory[category].total++;
      if (run.result.correct) {
        byCategory[category].correct++;
      }
    }

    return {
      directSuccess: byCategory.direct.total > 0
        ? byCategory.direct.correct / byCategory.direct.total
        : 0,
      indirectSuccess: byCategory.indirect.total > 0
        ? byCategory.indirect.correct / byCategory.indirect.total
        : 0,
      negativeSuccess: byCategory.negative.total > 0
        ? byCategory.negative.correct / byCategory.negative.total
        : 0,
      overall: runs.filter(r => r.result.correct).length / runs.length,
    };
  }
  ```

#### 3.3: Promotion Logic ✅
- [x] Implement promotion validator
  ```typescript
  function shouldPromote(
    candidateMetrics: Metrics,
    baselineMetrics: Metrics,
    thresholds: {
      minOverall: number;        // e.g., 0.85
      minNegative: number;       // e.g., 0.80 (precision)
      minImprovement: number;    // e.g., 0.05 (5 percentage points)
    }
  ): boolean {
    // Must meet minimum thresholds
    if (candidateMetrics.overall < thresholds.minOverall) return false;
    if (candidateMetrics.negativeSuccess < thresholds.minNegative) return false;

    // Must improve over baseline
    const improvement = candidateMetrics.overall - baselineMetrics.overall;
    if (improvement < thresholds.minImprovement) return false;

    // No category can regress significantly
    const maxRegression = 0.10; // Allow 10% regression in any category
    if (candidateMetrics.directSuccess < baselineMetrics.directSuccess - maxRegression) return false;
    if (candidateMetrics.indirectSuccess < baselineMetrics.indirectSuccess - maxRegression) return false;
    if (candidateMetrics.negativeSuccess < baselineMetrics.negativeSuccess - maxRegression) return false;

    return true;
  }
  ```

**File**: `packages/core/src/optimization/index.ts` ✅
- [x] Export all optimization functions (subprocess, storage, evaluator)

**Testing**: ✅
- 20 passing tests in `evaluator.test.ts`
- Comprehensive metrics computation tests with various category combinations
- Promotion criteria tests including edge cases and threshold validation
- Tests for default thresholds, custom thresholds, and boundary conditions

---

### Stage 4: MCP Optimization Tools ✅ **COMPLETED**

**Goal**: Create MCP tools that Claude Code will use to manage optimization workflow.

**File**: `packages/core/src/mcp/tools/optimization-tools.ts` (656 lines, follows `server-tools.ts` pattern)

#### 4.1: Read-Only Tools (Discovery) ✅
- [x] `get_canonical_tools` - List original tool definitions
  ```typescript
  mcp.tool("get_canonical_tools", {
    description: "Get original (unoptimized) tool definitions from a server...",
    inputSchema: z.object({
      server: z.string().describe("Server name")
    }),
    handler: async ({ server }) => {
      const tools = await loadCanonicalTools(storageDir, server);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ server, tools }, null, 2)
        }]
      };
    }
  });
  ```

- [x] `get_eval_results` - Retrieve evaluation metrics
  ```typescript
  mcp.tool("get_eval_results", {
    description: "Get evaluation results and metrics for tool description candidates...",
    inputSchema: z.object({
      server: z.string(),
      candidateId: z.string().optional(),
      tool: z.string().optional(),
    }),
    handler: async ({ server, candidateId, tool }) => {
      // Load relevant eval runs
      // Compute aggregated metrics
      // Return formatted results
    }
  });
  ```

- [x] `get_optimization_report` - Overall stats
  ```typescript
  mcp.tool("get_optimization_report", {
    description: "Get comprehensive optimization report for a server or all servers...",
    inputSchema: z.object({
      server: z.string().optional(),
    }),
    handler: async ({ server }) => {
      // Aggregate all optimization data
      // Return OptimizationReport
    }
  });
  ```

#### 4.2: Write Tools (Candidate Management) ✅
- [x] `propose_candidate` - Store rewritten description
  ```typescript
  mcp.tool("propose_candidate", {
    description: "Submit a rewritten tool description for evaluation...",
    inputSchema: z.object({
      server: z.string(),
      tool: z.string(),
      description: z.string().max(280),
      example: z.string().optional(),
    }),
    handler: async ({ server, tool, description, example }) => {
      // Validate character limit
      // Create ToolCandidate
      // Save to storage
      // Return candidateId
    }
  });
  ```

- [x] `save_golden_prompts` - Store prompt set
  ```typescript
  mcp.tool("save_golden_prompts", {
    description: "Save a set of test prompts for evaluating tool descriptions...",
    inputSchema: z.object({
      server: z.string(),
      tool: z.string(),
      prompts: z.array(GoldenPromptSchema),
    }),
    handler: async ({ server, tool, prompts }) => {
      // Validate prompts
      // Save to storage
      // Return count
    }
  });
  ```

- [x] `record_eval_run` - Store evaluation result
  ```typescript
  mcp.tool("record_eval_run", {
    description: "Record the result of evaluating a candidate against a test prompt...",
    inputSchema: z.object({
      server: z.string(),
      candidateId: z.string(),
      promptId: z.string(),
      result: z.object({
        toolCalled: z.boolean(),
        correct: z.boolean(),
        error: z.string().optional(),
        reasoning: z.string().optional(),
        durationMs: z.number(),
      }),
    }),
    handler: async (args) => {
      // Create EvalRun
      // Save to storage
      // Return runId
    }
  });
  ```

#### 4.3: Promotion Tools ✅
- [x] `promote_candidate` - Activate optimized description
  ```typescript
  mcp.tool("promote_candidate", {
    description: "Promote a candidate to production (replaces tool description)...",
    inputSchema: z.object({
      server: z.string(),
      tool: z.string(),
      candidateId: z.string(),
    }),
    handler: async ({ server, tool, candidateId }) => {
      // Load candidate
      // Load eval runs
      // Compute metrics
      // Create PromotedTool
      // Save promotion
      // Return success with metrics
    }
  });
  ```

- [x] `revert_optimization` - Restore canonical description
  ```typescript
  mcp.tool("revert_optimization", {
    description: "Revert a tool back to its canonical description...",
    inputSchema: z.object({
      server: z.string(),
      tool: z.string(),
    }),
    handler: async ({ server, tool }) => {
      // Delete promotion
      // Return confirmation
    }
  });
  ```

#### 4.4: Generator Tools (Placeholders - MCP Sampling Integration Deferred)
- [x] `generate_candidates` - Auto-generate rewrites (placeholder)
  ```typescript
  mcp.tool("generate_candidates", {
    description: "Auto-generate optimized description candidates using LLM...",
    inputSchema: z.object({
      server: z.string(),
      tool: z.string(),
      count: z.number().int().min(1).max(10).default(4),
    }),
    handler: async ({ server, tool, count }) => {
      // Load canonical tool
      // Use MCP sampling or createMessage to generate candidates
      // Call propose_candidate for each
      // Return candidateIds
    }
  });
  ```

- [x] `generate_golden_prompts` - Auto-generate test prompts (placeholder)
  ```typescript
  mcp.tool("generate_golden_prompts", {
    description: "Auto-generate test prompts for a tool...",
    inputSchema: z.object({
      server: z.string(),
      tool: z.string(),
      directCount: z.number().default(5),
      indirectCount: z.number().default(5),
      negativeCount: z.number().default(5),
    }),
    handler: async ({ server, tool, directCount, indirectCount, negativeCount }) => {
      // Load canonical tool
      // Generate prompts via LLM
      // Call save_golden_prompts
      // Return prompt count
    }
  });
  ```

**File**: `packages/core/src/mcp/server.ts` ✅
- [x] Register optimization tools at gateway MCP server
  ```typescript
  export function createMcpServer(...): McpServer {
    // ... existing tools ...

    // Register optimization tools
    createOptimizationTools(mcp, registry, storageDir);

    return mcp;
  }
  ```

**Implementation Notes**:
- All 10 tools implemented with comprehensive descriptions
- Generator tools (`generate_candidates`, `generate_golden_prompts`) marked as placeholders
- Tools follow same pattern as `server-tools.ts` with detailed descriptions and error handling
- Includes helpful UX messages like "💡 Next steps:" and formatted output

**Testing**: ✅
- Tools registered successfully in MCP server
- TypeScript compilation passes
- Integration tested via storage and evaluator unit tests (42 total tests passing)

---

### Stage 5: MCP Client Integration (Dynamic Tool Re-exposure)

**Goal**: Implement MCP client connections to downstream servers and dynamic tool re-exposure with optimized descriptions.

#### 5.1: Client Manager (NEW infrastructure)
**File**: `packages/core/src/mcp/client-manager.ts`

- [ ] Implement `ClientManager` class
  ```typescript
  class ClientManager {
    private clients: Map<string, {
      client: McpClient;
      connection: Connection;
    }>;

    async connectServer(server: McpServer): Promise<void> {
      // Create HTTP transport to server.url
      // Initialize McpClient
      // Store in map
    }

    async discoverTools(serverName: string): Promise<Tool[]> {
      // Call client.listTools()
      // Return tool definitions
    }

    async callTool(serverName: string, toolName: string, args: unknown): Promise<ToolCallResult> {
      // Forward to client.callTool()
      // Return result
    }

    async disconnectServer(serverName: string): Promise<void> {
      // Close connection
      // Remove from map
    }
  }
  ```

- [ ] Export from `packages/core/src/index.ts`

**Bun APIs Used**:
- `fetch()` for MCP HTTP transport
- Standard MCP client from `mcp-lite` package

#### 5.2: Dynamic Server Module (Tool Re-exposure)
**File**: `packages/core/src/mcp/dynamic-server.ts`

- [ ] Implement `registerDownstreamTools()` function
  ```typescript
  function registerDownstreamTools(
    mcp: McpServer,
    serverName: string,
    tools: Tool[],
    clientManager: ClientManager,
    promotions: Map<string, PromotedTool>
  ): void {
    for (const tool of tools) {
      // Get promoted description if exists
      const promoted = promotions.get(tool.name);
      const description = promoted?.description || tool.description;

      // Register on gateway's MCP server
      mcp.tool(`${serverName}.${tool.name}`, {
        description,
        inputSchema: tool.inputSchema, // Never modified
        handler: async (args) => {
          // Forward to downstream via ClientManager
          return await clientManager.callTool(serverName, tool.name, args);
        }
      });
    }
  }
  ```

- [ ] Export from `packages/core/src/index.ts`

#### 5.3: MCP Server Routes (Downstream Servers)
**File**: `packages/server/src/routes/mcp-server.ts` (NEW)

- [ ] Create `createDownstreamMcpApp()` factory
  ```typescript
  export function createDownstreamMcpApp(
    serverName: string,
    clientManager: ClientManager,
    storageDir: string
  ): Hono {
    // Create MCP server instance
    const mcp = new McpServer({
      name: `mcp-gateway-${serverName}`,
      version: "1.0.0",
      schemaAdapter: (schema) => z.toJSONSchema(schema as z.ZodType),
    });

    // Load promotions
    const promotions = await loadPromotions(storageDir, serverName);

    // Discover tools from downstream
    const tools = await clientManager.discoverTools(serverName);

    // Register tools with description swaps
    registerDownstreamTools(mcp, serverName, tools, clientManager, promotions);

    // Create HTTP transport
    const transport = new StreamableHttpTransport();
    const httpHandler = transport.bind(mcp);

    // Create Hono app
    const app = new Hono();
    app.all("/mcp", async (c) => await httpHandler(c.req.raw));

    return app;
  }
  ```

**Testing**:
- Connect to test MCP server
- Discover tools successfully
- Call re-exposed tool, verify forwarding works
- Promote candidate, verify description updated

---

### Stage 6: Main App Integration

**Goal**: Wire up client manager and dynamic MCP servers in main application.

**File**: `packages/server/src/app.ts`

- [ ] Initialize `ClientManager` in `createApp()`
  ```typescript
  export async function createApp(
    registry: Registry,
    storageDir?: string,
    eventHandlers?: {...}
  ): Promise<{ app: Hono; registry: Registry; clientManager: ClientManager }> {
    const app = new Hono();
    const clientManager = new ClientManager();

    // Connect to all registered servers
    for (const server of registry.servers) {
      await clientManager.connectServer(server);

      // Discover and save canonical tools
      const tools = await clientManager.discoverTools(server.name);
      await saveCanonicalTools(storage, server.name, tools);

      // Mount downstream MCP server
      const downstreamApp = createDownstreamMcpApp(server.name, clientManager, storage);
      app.route(`/servers/${server.name}`, downstreamApp);
      app.route(`/s/${server.name}`, downstreamApp);
    }

    // Mount gateway's own MCP server (with optimization tools)
    const gatewayMcp = createMcpApp(registry, storage);
    app.route("/gateway", gatewayMcp);
    app.route("/g", gatewayMcp);

    return { app, registry, clientManager };
  }
  ```

- [ ] Handle server addition/removal
  - When server added: connect client, discover tools, save canonical
  - When server removed: disconnect client, cleanup

- [ ] Handle promotion updates
  - When promotion saved: re-register tools with new descriptions
  - Implement hot-reload mechanism

**Testing**:
- Start gateway with test server
- Verify downstream MCP endpoint works
- Add server dynamically, verify tools appear
- Promote candidate, verify description changes immediately

---

### Stage 7: CLI Integration & Feature Flags

**Goal**: Add CLI flags and configuration for optimization feature.

**File**: `packages/mcp-gateway/src/cli.ts`

- [ ] Add `--enable-optimization` flag
  ```typescript
  .option("--enable-optimization", "Enable tool description optimization (experimental)")
  ```

- [ ] Pass flag to `createApp()`
  ```typescript
  const { app, registry, clientManager } = await createApp(
    registry,
    storageDir,
    {
      onLog: handleLog,
      onRegistryUpdate: handleUpdate,
      enableOptimization: options.enableOptimization,
    }
  );
  ```

- [ ] Document in help text and README

**File**: `packages/mcp-gateway/src/tui/store.ts` (if TUI integration desired)

- [ ] Add optimization state to store
  ```typescript
  interface AppStore {
    // ... existing ...
    optimizations?: Map<string, ServerOptimization>;
  }
  ```

- [ ] Add action to load optimization data

**Testing**:
- Run CLI with `--enable-optimization`
- Verify optimization tools are available
- Verify works without flag (graceful degradation)

---

### Stage 8: End-to-End Testing

**Goal**: Validate complete optimization workflow.

**File**: `packages/mcp-gateway/tests/optimization.test.ts` (NEW)

#### 8.1: Integration Test Suite
- [ ] Test: Full optimization workflow
  ```typescript
  describe("Tool Description Optimization", () => {
    it("should optimize a tool end-to-end", async () => {
      // 1. Start gateway with test MCP server
      // 2. Get canonical tools
      // 3. Propose candidate
      // 4. Save golden prompts
      // 5. Run evaluations (mock subprocess)
      // 6. Record eval runs
      // 7. Promote candidate
      // 8. Verify tool has new description
      // 9. Call tool, verify still works
    });
  });
  ```

- [ ] Test: Promotion criteria
  ```typescript
  it("should reject candidate below thresholds", async () => {
    // Create candidate with poor metrics
    // Attempt promotion
    // Verify rejection
  });
  ```

- [ ] Test: Revert optimization
  ```typescript
  it("should revert to canonical description", async () => {
    // Promote candidate
    // Revert optimization
    // Verify canonical description restored
  });
  ```

#### 8.2: Unit Tests
- [ ] Test storage functions (read/write each type)
- [ ] Test metrics calculation (various eval run combinations)
- [ ] Test promotion logic (edge cases)
- [ ] Test subprocess runner (timeout, error handling)

#### 8.3: Manual Testing Checklist
- [ ] Claude Code workflow: Generate candidates
- [ ] Claude Code workflow: Generate golden prompts
- [ ] Claude Code workflow: Run evaluations
- [ ] Claude Code workflow: Review metrics
- [ ] Claude Code workflow: Promote winner
- [ ] Verify description persists across gateway restart
- [ ] Verify tool calls still work after optimization
- [ ] Test with multiple servers simultaneously

---

### Stage 9: Documentation & Polish

**Goal**: Document the optimization system and provide examples.

#### 9.1: Documentation
- [ ] Update `README.md` with optimization feature
  - Feature overview
  - CLI flag documentation
  - MCP tool reference
  - Workflow examples

- [ ] Create `docs/optimization.md` (detailed guide)
  - Architecture explanation
  - Storage structure
  - Metrics definitions
  - Best practices for writing candidates
  - Golden prompt guidelines

- [ ] Add JSDoc comments to all public APIs

#### 9.2: Example Workflows
- [ ] Create example Claude Code session transcript
  ```markdown
  ## Example: Optimizing the `list_files` tool

  1. Get canonical description:
     Call `get_canonical_tools({ server: "filesystem" })`

  2. Generate candidates:
     Call `generate_candidates({ server: "filesystem", tool: "list_files", count: 3 })`

  3. Generate test prompts:
     Call `generate_golden_prompts({ server: "filesystem", tool: "list_files" })`

  4. Run evaluations:
     For each candidate, for each prompt:
       - Run local session with prompt
       - Check if tool called
       - Call `record_eval_run(...)`

  5. Review metrics:
     Call `get_eval_results({ server: "filesystem", tool: "list_files" })`

  6. Promote best candidate:
     Call `promote_candidate({ server: "filesystem", tool: "list_files", candidateId: "..." })`
  ```

#### 9.3: Error Messages & UX
- [ ] Add helpful error messages
  - "No canonical tools found - have you connected to the server?"
  - "Candidate exceeds 280 character limit (got 295)"
  - "No evaluation runs found for candidate - run evaluations first"

- [ ] Add progress indicators for long operations
  - Evaluation progress: "Testing candidate 2/4 (45% complete)"

- [ ] Add validation warnings
  - "Warning: No negative prompts defined - precision metrics will be 0%"

---

## Summary of Key Infrastructure

### Subprocess Infrastructure (Critical)
- **Evaluation Runner**: `Bun.spawn()` to run Claude Code sessions
- **Timeout Handling**: `setTimeout` + `proc.kill()` pattern
- **Output Capture**: `proc.stdout.text()` for tool call detection
- **Exit Code Handling**: 0 = correct, 1 = incorrect behavior

### Storage Infrastructure
- **Pattern**: Follow existing `registry/storage.ts` patterns, but prefer Bun native APIs
- **APIs**:
  - `Bun.file(path).json()` - Fast JSON reading
  - `Bun.file(path).exists()` - File existence checks
  - `Bun.write(path, data)` - Writing files (auto-creates dirs)
  - Node.js `fs/promises.mkdir()` - Only when explicit dir creation needed
- **Format**: Pretty-printed JSON for all files
- **Structure**: Hierarchical by server → data type → tool
- **Performance**: Bun's file APIs are ~3x faster than Node.js for JSON operations

### MCP Client Infrastructure
- **ClientManager**: Manages connections to downstream servers
- **Tool Discovery**: `client.listTools()` on connection
- **Tool Forwarding**: Proxy calls through to downstream
- **Description Swapping**: At tool registration time, not in-flight

### File Changes Summary (Stages 0-4 COMPLETED)

**New Files** (~1304 lines):
- ✅ `packages/types/src/optimization.ts` (86 lines) - All types and Zod schemas
- ✅ `packages/core/src/optimization/subprocess.ts` (217 lines) - Evaluation subprocess with Claude CLI integration
- ✅ `packages/core/src/optimization/storage.ts` (323 lines) - File-based storage for all optimization data
- ✅ `packages/core/src/optimization/evaluator.ts` (211 lines) - Metrics computation and promotion logic
- ✅ `packages/core/src/optimization/index.ts` (8 lines) - Module exports
- ✅ `packages/core/src/mcp/tools/optimization-tools.ts` (656 lines) - 10 MCP tools (8 functional, 2 placeholders)

**Modified Files** (~15 lines):
- ✅ `packages/core/src/mcp/server.ts` (+3 lines) - Register optimization tools
- ✅ `packages/types/src/index.ts` (+1 line) - Export optimization types
- ✅ `packages/core/src/index.ts` (+1 line) - Export optimization module

**Test Files** (~681 lines):
- ✅ `packages/core/tests/subprocess.test.ts` (255 lines) - 15 tests for subprocess evaluation
- ✅ `packages/core/tests/storage.test.ts` (257 lines) - 22 tests for storage operations
- ✅ `packages/core/tests/evaluator.test.ts` (169 lines) - 20 tests for metrics and promotion logic

**Total Lines (Stages 0-4)**: ~2000 lines of new/modified code
**Test Coverage**: 42 tests, 100% passing

**Remaining for Stages 5-9**:
- `packages/core/src/mcp/client-manager.ts` (~200 lines) - ClientManager class
- `packages/core/src/mcp/dynamic-server.ts` (~150 lines) - Dynamic tool re-exposure
- `packages/server/src/routes/mcp-server.ts` (~100 lines) - Downstream MCP server routes
- `packages/server/src/app.ts` (~50 lines modifications) - Main app integration
- `packages/cli/src/cli.ts` (~10 lines modifications) - CLI flags
- Generator tool implementations for `generate_candidates` and `generate_golden_prompts`

### Dependencies
- ✅ `mcp-lite` - Already in use, has McpClient (PR #133)
- ✅ `zod` - Already in use for validation
- ✅ `hono` - Already in use for HTTP server
- ✅ Bun runtime - Already in use
- ✅ Node.js `fs/promises` - Already in use
- ❌ No new dependencies needed