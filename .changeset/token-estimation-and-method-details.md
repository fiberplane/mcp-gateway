---
"@fiberplane/mcp-gateway": minor
---

Add token estimation and method detail display to track the cost of MCP tool calls in LLM applications.

**Token Tracking:**
- Estimate input tokens from request parameters and output tokens from response results
- Use lightweight string.length / 4 heuristic for fast, zero-dependency estimation (~±10-20% accuracy)
- Display total token count in sortable table column with hover tooltip showing input/output breakdown
- Support all MCP methods (tools/call, resources/read, prompts/get, etc.)

**Method Details:**
- Show function call syntax with argument values for requests: `sum(a: 4, b: 44)`
- Display response previews including text content, error messages, images, and arrays
- Automatically truncate long values to prevent tall table rows
- Format values intelligently (strings with quotes, arrays as `[N items]`, etc.)

This enables users to identify expensive tool calls, optimize token usage, and quickly understand request/response content at a glance in the web UI.
