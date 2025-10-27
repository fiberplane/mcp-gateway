---
"@fiberplane/mcp-gateway": patch
---

Fix method details for SSE streaming responses (MCP Inspector compatibility)

**Issue**
- Method details showed `null` for SSE-based responses (used by MCP Inspector)
- Only regular POST requests had method details, not streaming responses
- Web UI displayed warning icon (⚠) instead of response preview text

**Root Cause**
- SSE capture path (`createSSEJsonRpcCaptureRecord`) didn't compute `methodDetail`
- Gateway layer wasn't calling `getMethodDetail` for SSE messages
- Result: All SSE responses got `methodDetail: null` in database

**Fix**
- Added `methodDetail` parameter to `createSSEJsonRpcCaptureRecord` function
- Gateway now computes `methodDetail` before calling SSE capture (packages/core/src/gateway.ts:432-461)
- Uses same `getMethodDetail` logic as regular requests/responses for consistency
- Properly handles both request and response directions with type-safe ApiLogEntry construction

**Files Changed**
- `packages/core/src/capture/index.ts` - Added methodDetail parameter to SSE capture (line 267, 325)
- `packages/core/src/gateway.ts` - Compute methodDetail before SSE capture (lines 432-461)
- `packages/core/src/logs/storage.ts` - Fixed JSON serialization (line 612)

**Additional Fix: JSON Serialization**
- Changed `methodDetail: row.methodDetail ?? undefined` to `methodDetail: row.methodDetail`
- Ensures null/string values appear in API JSON responses (undefined gets omitted)
- Without this fix, methodDetail was missing from API responses even when stored in database

**Testing**
- Verified with MCP Inspector (SSE streaming)
- Confirmed both requests and responses now have methodDetail
- Verified methodDetail appears in API JSON responses
- Web UI now displays proper response previews (e.g., `"hoho"` for tools/call text responses)
