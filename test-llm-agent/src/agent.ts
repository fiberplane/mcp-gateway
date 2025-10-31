import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getScenario } from "./scenarios";
import { mcpTools, setConversationId } from "./tools";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:3333";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-key";

/**
 * Run an agent scenario
 *
 * This creates a real LLM agent using the AI SDK that:
 * 1. Sends LLM requests through the gateway proxy
 * 2. Calls MCP tools through the gateway
 * 3. Allows us to validate correlation between LLM calls and MCP calls
 */
export async function runAgent(scenarioName?: string) {
  const scenario = getScenario(scenarioName);
  const conversationId = crypto.randomUUID();

  const correlationMode = process.env.CORRELATION_MODE || "manual";

  console.log("\n🤖 Test Agent Starting");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📝 Scenario: ${scenario.name}`);
  console.log(`💬 Prompt: "${scenario.prompt}"`);
  console.log(`🔧 Expected tools: ${scenario.expectedTools.join(", ")}`);
  console.log(`🆔 Conversation ID: ${conversationId}`);
  console.log(`🔗 Correlation mode: ${correlationMode}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const startTime = Date.now();

  // Set conversation ID for MCP tool calls
  setConversationId(conversationId);

  try {
    const baseURL = `${GATEWAY_URL}/llm/v1`;
    console.log(`🔗 Base URL: ${baseURL}`);
    console.log(`📡 All LLM requests will go through: ${baseURL}\n`);

    const openai = createOpenAI({
      apiKey: OPENAI_API_KEY,
      baseURL,
    });

    // Track LLM request count
    let llmRequestCount = 0;

    const result = await generateText({
      model: openai.chat("gpt-4o-mini"),
      messages: [{ role: "user", content: scenario.prompt }],
      tools: mcpTools,
      maxToolRoundtrips: 5,
      headers: {
        "X-Conversation-Id": conversationId,
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      onStepStart: ({ step }) => {
        llmRequestCount++;
        console.log(`\n📤 LLM Request #${llmRequestCount} (Step ${step})`);
      },
      onStepFinish: ({ step, text, toolCalls, usage }) => {
        console.log(`📥 LLM Response #${llmRequestCount} (Step ${step})`);
        if (toolCalls && toolCalls.length > 0) {
          console.log(`   └─ Requested ${toolCalls.length} tool call(s)`);
        }
        if (text) {
          console.log(
            `   └─ Generated text: ${text.substring(0, 50)}${text.length > 50 ? "..." : ""}`,
          );
        }
        if (usage) {
          console.log(
            `   └─ Tokens: ${usage.promptTokens} in, ${usage.completionTokens} out`,
          );
        }
      },
    });

    const duration = Date.now() - startTime;

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ Agent Completed Successfully");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`\n🤖 Response:\n${result.text}\n`);

    console.log("📊 Statistics:");
    console.log(`  - LLM requests: ${llmRequestCount}`);
    console.log(`  - Tool calls: ${result.toolCalls.length}`);
    console.log(`  - Tool results: ${result.toolResults.length}`);
    console.log(`  - Duration: ${duration}ms`);
    console.log(`  - Finish reason: ${result.finishReason}`);

    if (result.toolCalls.length > 0) {
      console.log("\n🔧 Tool Calls Made:");
      for (const call of result.toolCalls) {
        console.log(`  - ${call.toolName}(${JSON.stringify(call.args)})`);
      }
    }

    console.log("\n🔗 View in Gateway UI:");
    console.log(`  ${GATEWAY_URL}/ui/conversations/${conversationId}`);
    console.log(`\n💡 Expected timeline order:`);
    console.log(`  1. LLM Request #1 (initial question)`);
    console.log(`  2. LLM Response #1 (with tool_calls)`);
    console.log(`  3. MCP Tool Calls (executed via gateway)`);
    console.log(`  4. LLM Request #2 (with tool results)`);
    console.log(`  5. LLM Response #2 (final answer)`);
    console.log();
  } catch (error) {
    console.error("\n❌ Agent Failed");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error(error);
    process.exit(1);
  }
}

// CLI entry point
if (import.meta.main) {
  const scenarioName = process.argv[2];
  await runAgent(scenarioName);
}
