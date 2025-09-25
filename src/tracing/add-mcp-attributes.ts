import type { Span } from "@opentelemetry/api";
import { quickMCPCheck } from "./detection.js";
import { type ParsedMCPMessage, parseMCPMessage } from "./parser.js";
import {
  setMCPRequestAttributes,
  setMCPResponseAttributes,
} from "./span-attributes.js";
import type { ResponseBodyCaptureMode } from "./types.js";
import {
  getContentSizeLimit,
  shouldCaptureResponseBody,
} from "./utils/response-body-capture.js";

export interface MCPRequestProcessingResult {
  isMCP: boolean;
  requestMCP: ParsedMCPMessage | null;
}

export interface ResponseAnalysisResult {
  bodySize: number;
  contentType: string | null;
  compressionRatio?: number;
  jsonStructureDepth?: number;
  textAnalysis?: {
    lineCount: number;
    wordCount: number;
    hasMarkdown: boolean;
  };
  parseTime: number;
  responseBody?: string; // Full body if <= 60KB
  responsePreview?: string; // Truncated preview if > 60KB
  bodyTruncated?: boolean; // Flag if truncated
}

export interface MCPResponseProcessingResult {
  responseMCP: ParsedMCPMessage | null;
  analysisResult?: ResponseAnalysisResult;
  newResponse?: Response; // New response with consumed body
}

/**
 * Process an incoming request to detect and parse MCP content
 * Returns structured data about the MCP request for testing
 */
export async function processMCPRequest(
  request: Request,
  span: Span,
): Promise<MCPRequestProcessingResult> {
  // Quick MCP detection (1-2ms overhead)
  const mightBeMCP = quickMCPCheck(request);

  if (!mightBeMCP) {
    return { isMCP: false, requestMCP: null };
  }

  // Parse MCP request (5-10ms)
  const requestBody = await request.clone().text();
  const requestMCP = parseMCPMessage(requestBody, true);

  if (!requestMCP) {
    return { isMCP: false, requestMCP: null };
  }

  // Set common MCP span attributes per Sentry MCP spec
  span.setAttributes({
    "mcp.method.name": requestMCP.method || "",
    "mcp.transport": "http", // gateway only supports HTTP transport
    "network.transport": "tcp",
    "network.protocol.version": "2.0", // JSON-RPC version
    "mcp.request.id": requestMCP.requestId || "",
    "mcp.session.id": requestMCP.sessionId || "",
    "mcp.protocol.version": requestMCP.protocolVersion || "2.0",
  });

  // Add session-level attributes if available
  if (requestMCP.clientInfo) {
    span.setAttributes({
      "mcp.client.name": requestMCP.clientInfo.name || "",
      "mcp.client.version": requestMCP.clientInfo.version || "",
    });
  }

  // Method-specific attributes
  setMCPRequestAttributes(span, requestMCP);

  return { isMCP: true, requestMCP };
}

/**
 * Analyze response body characteristics
 */
function analyzeResponseBody(
  body: string,
  contentType: string | null,
  shouldCaptureBody = false,
  contentSizeLimit = 61440,
): ResponseAnalysisResult {
  const startTime = performance.now();

  const bodySize = new TextEncoder().encode(body).length;
  let jsonStructureDepth: number | undefined;
  let textAnalysis: ResponseAnalysisResult["textAnalysis"] | undefined;

  // Response body storage with configurable capture and configurable size limit
  let responseBody: string | undefined;
  let responsePreview: string | undefined;
  let bodyTruncated = false;

  if (shouldCaptureBody) {
    if (bodySize <= contentSizeLimit) {
      responseBody = body;
    } else {
      // Truncate content to the configured limit
      responsePreview = `${body.substring(0, contentSizeLimit)}... [truncated]`;
      bodyTruncated = true;
    }
  }

  // JSON structure analysis
  try {
    const parsed = JSON.parse(body);
    jsonStructureDepth = calculateJsonDepth(parsed);
  } catch {
    // Not valid JSON, analyze as text
    textAnalysis = {
      lineCount: body.split("\n").length,
      wordCount: body.split(/\s+/).filter((word) => word.length > 0).length,
      hasMarkdown: /[#*`_[\]()]/.test(body) && body.includes("\n"),
    };
  }

  const parseTime = performance.now() - startTime;

  return {
    bodySize,
    contentType,
    jsonStructureDepth,
    textAnalysis,
    parseTime,
    responseBody,
    responsePreview,
    bodyTruncated,
  };
}

/**
 * Calculate JSON object depth recursively
 */
function calculateJsonDepth(obj: unknown, currentDepth = 1): number {
  if (typeof obj !== "object" || obj === null) {
    return currentDepth;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return currentDepth;
    }

    return Math.max(
      ...obj.map((item) => calculateJsonDepth(item, currentDepth + 1)),
    );
  }

  const values = Object.values(obj);
  if (values.length === 0) {
    return currentDepth;
  }

  return Math.max(
    ...values.map((value) => calculateJsonDepth(value, currentDepth + 1)),
  );
}

/**
 * Process an MCP response and update span attributes
 * Returns structured data about the MCP response for testing
 */
export async function processMCPResponse(
  response: Response,
  requestMCP: ParsedMCPMessage | null,
  span: Span,
  env?: Record<string, string>,
): Promise<MCPResponseProcessingResult> {
  if (!requestMCP) {
    return { responseMCP: null };
  }

  // Check if the response body is already consumed
  let responseBody: string;
  try {
    // Try to read the response body
    responseBody = await response.text();
  } catch (error) {
    // If the body is already consumed, we can't analyze it
    // This can happen with streaming responses where the body is consumed by the streaming wrapper
    console.warn(
      "[tracing] Response body already consumed, skipping analysis",
      {
        error: error instanceof Error ? error.message : String(error),
        url: response.url,
        status: response.status,
        contentType: response.headers.get("content-type"),
      },
    );

    // Return a minimal result without body analysis
    // Don't return the original response as it's already consumed
    return {
      responseMCP: null,
    };
  }

  const contentType = response.headers.get("content-type");

  // Determine if response body should be captured
  const responseMCPParsed = parseMCPMessage(responseBody, false);
  const isError = !response.ok || (responseMCPParsed?.isError ?? false);

  const shouldCaptureBody = env
    ? shouldCaptureResponseBody(
        env.MCP_RESPONSE_BODY_CAPTURE as ResponseBodyCaptureMode,
        isError,
      )
    : false;

  const contentSizeLimit = env ? getContentSizeLimit(env) : 61440;

  // Analyze response body characteristics
  const analysisResult = analyzeResponseBody(
    responseBody,
    contentType,
    shouldCaptureBody,
    contentSizeLimit,
  );

  // Add response analysis attributes
  span.setAttributes({
    "http.response.body_size": analysisResult.bodySize,
    "http.response.content_type": analysisResult.contentType || "unknown",
    "http.response.parse_time": analysisResult.parseTime,
  });

  if (analysisResult.jsonStructureDepth !== undefined) {
    span.setAttribute(
      "http.response.json_depth",
      analysisResult.jsonStructureDepth,
    );
  }

  if (analysisResult.textAnalysis) {
    span.setAttributes({
      "http.response.text.line_count": analysisResult.textAnalysis.lineCount,
      "http.response.text.word_count": analysisResult.textAnalysis.wordCount,
      "http.response.text.has_markdown":
        analysisResult.textAnalysis.hasMarkdown,
    });
  }

  const responseMCP = parseMCPMessage(responseBody, false);

  if (!responseMCP) {
    return { responseMCP: null };
  }

  // Add response-specific attributes per Sentry MCP spec
  setMCPResponseAttributes(span, requestMCP, {
    isError: responseMCP.isError || false,
    contentCount: responseMCP.contentCount || 0,
    contentTypes: responseMCP.contentTypes,
    content: responseMCP.content,
  });

  // Add error details if present
  if (responseMCP.isError && responseMCP.errorCode) {
    span.setAttributes({
      "mcp.error.code": responseMCP.errorCode,
    });
  }

  // For non-streaming responses, always emit the parsed event since there's only one
  // (Streaming responses handle filtering in their own logic)
  span.addEvent("mcp.response.parsed", {
    content_count: responseMCP.contentCount,
    is_error: responseMCP.isError,
    body_size: analysisResult.bodySize,
    parse_time: analysisResult.parseTime,
    streaming: false,
  });

  // Create a new response with the consumed body to avoid stream warnings
  const newResponse = new Response(responseBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });

  return { responseMCP, analysisResult, newResponse };
}
