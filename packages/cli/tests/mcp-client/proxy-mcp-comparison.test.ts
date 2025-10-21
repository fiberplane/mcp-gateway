/** biome-ignore-all lint/suspicious/noConsole: tests */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	loadRegistry,
	savePromotion,
	saveRegistry,
} from "@fiberplane/mcp-gateway-core";
import type { Registry } from "@fiberplane/mcp-gateway-types";
import { createApp } from "@fiberplane/mcp-gateway-server";
import { McpServer, StreamableHttpTransport } from "mcp-lite";

// JSON-RPC response type
interface JsonRpcResponse {
	jsonrpc: string;
	id: string | number | null;
	result?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

// Test harness for MCP server
interface TestServer {
	url: string;
	port: number;
	stop: () => Promise<void>;
}

// Gateway test harness
interface GatewayServer {
	port: number;
	mode: "proxy" | "mcp-client";
	stop: () => void;
}

/**
 * Create test MCP server with tools, resources, and prompts
 */
function createTestMcpServer(name: string, port: number): TestServer {
	const mcp = new McpServer({
		name,
		version: "1.0.0",
	});

	// Add test tools
	mcp.tool("echo", {
		description: "Echoes the input message back to you",
		inputSchema: {
			type: "object",
			properties: {
				message: { type: "string" },
			},
			required: ["message"],
		},
		handler: (args: { message: string }) => ({
			content: [{ type: "text", text: args.message }],
		}),
	});

	mcp.tool("add", {
		description: "Adds two numbers together and returns the sum",
		inputSchema: {
			type: "object",
			properties: {
				a: { type: "number" },
				b: { type: "number" },
			},
			required: ["a", "b"],
		},
		handler: (args: { a: number; b: number }) => ({
			content: [{ type: "text", text: String(args.a + args.b) }],
		}),
	});

	mcp.tool("multiply", {
		description: "Multiplies two numbers and returns the product",
		inputSchema: {
			type: "object",
			properties: {
				a: { type: "number" },
				b: { type: "number" },
			},
			required: ["a", "b"],
		},
		handler: (args: { a: number; b: number }) => ({
			content: [{ type: "text", text: String(args.a * args.b) }],
		}),
	});

	// Add test resources
	mcp.resource(
		"file://config.json",
		{
			name: "Configuration File",
			description: "Application configuration",
			mimeType: "application/json",
		},
		async (uri) => ({
			contents: [
				{
					uri: uri.href,
					type: "text",
					text: JSON.stringify({ name, version: "1.0.0" }, null, 2),
					mimeType: "application/json",
				},
			],
		}),
	);

	mcp.resource(
		"file://readme.md",
		{
			name: "README",
			description: "Documentation file",
			mimeType: "text/markdown",
		},
		async (uri) => ({
			contents: [
				{
					uri: uri.href,
					type: "text",
					text: `# ${name}\n\nTest MCP server documentation`,
					mimeType: "text/markdown",
				},
			],
		}),
	);

	// Add test prompts
	mcp.prompt("greet", {
		description: "Generate a greeting message",
		arguments: [
			{ name: "name", description: "Name to greet", required: true },
		],
		handler: (args: { name?: string }) => ({
			description: `Greeting for ${args.name || "someone"}`,
			messages: [
				{
					role: "user" as const,
					content: {
						type: "text",
						text: `Say hello to ${args.name || "someone"}`,
					},
				},
			],
		}),
	});

	const transport = new StreamableHttpTransport();
	const handler = transport.bind(mcp);

	// Start HTTP server
	const server = Bun.serve({
		port,
		fetch: handler,
	});

	return {
		url: `http://localhost:${port}`,
		port,
		stop: async () => {
			server.stop();
		},
	};
}

/**
 * Helper to make JSON-RPC requests to gateway
 */
async function makeJsonRpcRequest(
	url: string,
	method: string,
	params?: unknown,
	sessionId?: string,
): Promise<JsonRpcResponse> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		"MCP-Protocol-Version": "2025-06-18",
	};

	if (sessionId) {
		headers["Mcp-Session-Id"] = sessionId;
	}

	const response = await fetch(url, {
		method: "POST",
		headers,
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: Math.random().toString(36),
			method,
			params,
		}),
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${await response.text()}`);
	}

	return response.json() as Promise<JsonRpcResponse>;
}

/**
 * Start a gateway server in either proxy or MCP client mode
 */
async function startGatewayServer(
	registry: Registry,
	storageDir: string,
	port: number,
	enableMcpClient: boolean,
): Promise<GatewayServer> {
	const { app } = await createApp(registry, storageDir, {
		enableMcpClient,
	});

	const server = Bun.serve({
		port,
		fetch: app.fetch,
	});

	// Wait for server to start
	await new Promise<void>((resolve) => {
		setTimeout(resolve, 100);
	});

	return {
		port,
		mode: enableMcpClient ? "mcp-client" : "proxy",
		stop: () => server.stop(),
	};
}

describe("Proxy vs MCP Client Comparison Integration Tests", () => {
	let testMcpServer: TestServer;
	let proxyGateway: GatewayServer;
	let mcpClientGateway: GatewayServer;
	let storageDir: string;

	beforeAll(async () => {
		// Create temp directory for storage
		storageDir = await mkdtemp(join(tmpdir(), "mcp-gateway-test-"));

		// Create test MCP server
		testMcpServer = createTestMcpServer("test-server", 9001);

		// Initialize test server
		await makeJsonRpcRequest(testMcpServer.url, "initialize", {
			protocolVersion: "2025-06-18",
			clientInfo: {
				name: "test-client",
				version: "1.0.0",
			},
		});

		// Create test registry
		const registry: Registry = {
			servers: [
				{
					name: "test-server",
					type: "http" as const,
					url: testMcpServer.url,
					headers: {},
					lastActivity: null,
					exchangeCount: 0,
				},
			],
		};

		// Save registry to storage
		await saveRegistry(storageDir, registry);

		// Start proxy mode gateway (port 3333)
		const proxyRegistry = await loadRegistry(storageDir);
		proxyGateway = await startGatewayServer(
			proxyRegistry,
			storageDir,
			3333,
			false,
		);

		console.log(
			`Started proxy gateway on port ${proxyGateway.port} (mode: ${proxyGateway.mode})`,
		);

		// Start MCP client mode gateway (port 3334)
		const mcpClientRegistry = await loadRegistry(storageDir);
		mcpClientGateway = await startGatewayServer(
			mcpClientRegistry,
			storageDir,
			3334,
			true,
		);

		console.log(
			`Started MCP client gateway on port ${mcpClientGateway.port} (mode: ${mcpClientGateway.mode})`,
		);

		// Give servers time to fully initialize
		await new Promise((resolve) => setTimeout(resolve, 500));
	});

	afterAll(async () => {
		// Stop all servers
		proxyGateway?.stop();
		mcpClientGateway?.stop();
		await testMcpServer?.stop();

		// Clean up temp directory
		try {
			await rm(storageDir, { recursive: true, force: true });
		} catch (error) {
			console.warn("Failed to clean up temp directory:", error);
		}
	});

	describe("Tools API", () => {
		it("both modes list same tools", async () => {
			const proxyUrl = `http://localhost:${proxyGateway.port}/servers/test-server/mcp`;
			const mcpClientUrl = `http://localhost:${mcpClientGateway.port}/servers/test-server/mcp`;

			// Get tools from proxy mode
			const proxyResponse = await makeJsonRpcRequest(proxyUrl, "tools/list");
			expect(proxyResponse.error).toBeUndefined();
			expect(proxyResponse.result).toBeDefined();
			const proxyTools = (proxyResponse.result as { tools: unknown[] }).tools;

			// Get tools from MCP client mode
			const mcpClientResponse = await makeJsonRpcRequest(
				mcpClientUrl,
				"tools/list",
			);
			expect(mcpClientResponse.error).toBeUndefined();
			expect(mcpClientResponse.result).toBeDefined();
			const mcpClientTools = (mcpClientResponse.result as { tools: unknown[] })
				.tools;

			// Should have same number of tools
			expect(proxyTools).toHaveLength(mcpClientTools.length);
			expect(proxyTools).toHaveLength(3); // echo, add, multiply

			// Sort by name for comparison
			const sortByName = (a: { name: string }, b: { name: string }) =>
				a.name.localeCompare(b.name);
			const sortedProxyTools = [...proxyTools].sort(sortByName);
			const sortedMcpTools = [...mcpClientTools].sort(sortByName);

			// Check each tool
			for (let i = 0; i < sortedProxyTools.length; i++) {
				const proxyTool = sortedProxyTools[i] as {
					name: string;
					description: string;
				};
				const mcpTool = sortedMcpTools[i] as {
					name: string;
					description: string;
				};

				expect(proxyTool.name).toBe(mcpTool.name);
				expect(proxyTool.description).toBe(mcpTool.description);
			}
		});

		it("both modes call tools with same results", async () => {
			const proxyUrl = `http://localhost:${proxyGateway.port}/servers/test-server/mcp`;
			const mcpClientUrl = `http://localhost:${mcpClientGateway.port}/servers/test-server/mcp`;

			// Test echo tool
			const proxyEchoResponse = await makeJsonRpcRequest(
				proxyUrl,
				"tools/call",
				{
					name: "echo",
					arguments: { message: "Hello from test" },
				},
			);
			const mcpClientEchoResponse = await makeJsonRpcRequest(
				mcpClientUrl,
				"tools/call",
				{
					name: "echo",
					arguments: { message: "Hello from test" },
				},
			);

			expect(proxyEchoResponse.error).toBeUndefined();
			expect(mcpClientEchoResponse.error).toBeUndefined();
			expect(proxyEchoResponse.result).toEqual(mcpClientEchoResponse.result);
			expect(proxyEchoResponse.result).toEqual({
				content: [{ type: "text", text: "Hello from test" }],
			});

			// Test add tool
			const proxyAddResponse = await makeJsonRpcRequest(
				proxyUrl,
				"tools/call",
				{
					name: "add",
					arguments: { a: 10, b: 20 },
				},
			);
			const mcpClientAddResponse = await makeJsonRpcRequest(
				mcpClientUrl,
				"tools/call",
				{
					name: "add",
					arguments: { a: 10, b: 20 },
				},
			);

			expect(proxyAddResponse.error).toBeUndefined();
			expect(mcpClientAddResponse.error).toBeUndefined();
			expect(proxyAddResponse.result).toEqual(mcpClientAddResponse.result);
			expect(proxyAddResponse.result).toEqual({
				content: [{ type: "text", text: "30" }],
			});
		});

		it("MCP client mode uses optimized descriptions", async () => {
			// Create a promotion for the echo tool
			await savePromotion(storageDir, "test-server", "echo", {
				toolName: "echo",
				candidateId: "test-candidate-1",
				description: "OPTIMIZED: Echoes your message back to you instantly",
				promotedAt: new Date().toISOString(),
			});

			const mcpClientUrl = `http://localhost:${mcpClientGateway.port}/servers/test-server/mcp`;

			// Get tools from MCP client mode (should use optimized description)
			const mcpClientResponse = await makeJsonRpcRequest(
				mcpClientUrl,
				"tools/list",
			);
			expect(mcpClientResponse.error).toBeUndefined();
			expect(mcpClientResponse.result).toBeDefined();

			const tools = (mcpClientResponse.result as { tools: unknown[] }).tools;
			const echoTool = tools.find(
				(t: { name: string }) => t.name === "echo",
			) as { description: string };

			// Should have optimized description
			expect(echoTool.description).toBe(
				"OPTIMIZED: Echoes your message back to you instantly",
			);

			// Verify it still works
			const callResponse = await makeJsonRpcRequest(
				mcpClientUrl,
				"tools/call",
				{
					name: "echo",
					arguments: { message: "test with optimized description" },
				},
			);
			expect(callResponse.error).toBeUndefined();
			expect(callResponse.result).toEqual({
				content: [{ type: "text", text: "test with optimized description" }],
			});
		});

		it("both modes handle errors consistently", async () => {
			const proxyUrl = `http://localhost:${proxyGateway.port}/servers/test-server/mcp`;
			const mcpClientUrl = `http://localhost:${mcpClientGateway.port}/servers/test-server/mcp`;

			// Call non-existent tool - expect both to return errors (not throw)
			let proxyResponse: JsonRpcResponse;
			let mcpClientResponse: JsonRpcResponse;

			try {
				proxyResponse = await makeJsonRpcRequest(proxyUrl, "tools/call", {
					name: "non-existent-tool",
					arguments: {},
				});
			} catch (error) {
				// If it throws, extract JSON-RPC response from error message
				const errorMessage = String(error);
				const match = errorMessage.match(/HTTP 500: (.+)/);
				if (match) {
					proxyResponse = JSON.parse(match[1]) as JsonRpcResponse;
				} else {
					throw error;
				}
			}

			try {
				mcpClientResponse = await makeJsonRpcRequest(
					mcpClientUrl,
					"tools/call",
					{
						name: "non-existent-tool",
						arguments: {},
					},
				);
			} catch (error) {
				// If it throws, extract JSON-RPC response from error message
				const errorMessage = String(error);
				const match = errorMessage.match(/HTTP 500: (.+)/);
				if (match) {
					mcpClientResponse = JSON.parse(match[1]) as JsonRpcResponse;
				} else {
					throw error;
				}
			}

			// Both should have errors
			expect(proxyResponse.error).toBeDefined();
			expect(mcpClientResponse.error).toBeDefined();

			// Both should be JSON-RPC error codes (negative numbers)
			expect(proxyResponse.error?.code).toBeLessThan(0);
			expect(mcpClientResponse.error?.code).toBeLessThan(0);

			// Both should have error messages
			expect(proxyResponse.error?.message).toBeDefined();
			expect(mcpClientResponse.error?.message).toBeDefined();
		});
	});

	describe("Resources API", () => {
		it("both modes handle resources", async () => {
			const proxyUrl = `http://localhost:${proxyGateway.port}/servers/test-server/mcp`;
			const mcpClientUrl = `http://localhost:${mcpClientGateway.port}/servers/test-server/mcp`;

			// List resources
			const proxyListResponse = await makeJsonRpcRequest(
				proxyUrl,
				"resources/list",
			);
			const mcpClientListResponse = await makeJsonRpcRequest(
				mcpClientUrl,
				"resources/list",
			);

			expect(proxyListResponse.error).toBeUndefined();
			expect(mcpClientListResponse.error).toBeUndefined();

			const proxyResources = (
				proxyListResponse.result as { resources: unknown[] }
			).resources;
			const mcpClientResources = (
				mcpClientListResponse.result as { resources: unknown[] }
			).resources;

			// Should have same number of resources
			expect(proxyResources).toHaveLength(mcpClientResources.length);
			expect(proxyResources).toHaveLength(2); // config.json, readme.md

			// Read a resource
			const proxyReadResponse = await makeJsonRpcRequest(
				proxyUrl,
				"resources/read",
				{
					uri: "file://config.json",
				},
			);
			const mcpClientReadResponse = await makeJsonRpcRequest(
				mcpClientUrl,
				"resources/read",
				{
					uri: "file://config.json",
				},
			);

			expect(proxyReadResponse.error).toBeUndefined();
			expect(mcpClientReadResponse.error).toBeUndefined();

			// Both should return similar content structure
			expect(proxyReadResponse.result).toBeDefined();
			expect(mcpClientReadResponse.result).toBeDefined();
		});
	});

	describe("Prompts API", () => {
		it("both modes handle prompts", async () => {
			const proxyUrl = `http://localhost:${proxyGateway.port}/servers/test-server/mcp`;
			const mcpClientUrl = `http://localhost:${mcpClientGateway.port}/servers/test-server/mcp`;

			// List prompts
			const proxyListResponse = await makeJsonRpcRequest(
				proxyUrl,
				"prompts/list",
			);
			const mcpClientListResponse = await makeJsonRpcRequest(
				mcpClientUrl,
				"prompts/list",
			);

			expect(proxyListResponse.error).toBeUndefined();
			expect(mcpClientListResponse.error).toBeUndefined();

			const proxyPrompts = (proxyListResponse.result as { prompts: unknown[] })
				.prompts;
			const mcpClientPrompts = (
				mcpClientListResponse.result as { prompts: unknown[] }
			).prompts;

			// Should have same number of prompts
			expect(proxyPrompts).toHaveLength(mcpClientPrompts.length);
			expect(proxyPrompts).toHaveLength(1); // greet

			// Get a prompt
			const proxyGetResponse = await makeJsonRpcRequest(
				proxyUrl,
				"prompts/get",
				{
					name: "greet",
					arguments: { name: "Alice" },
				},
			);
			const mcpClientGetResponse = await makeJsonRpcRequest(
				mcpClientUrl,
				"prompts/get",
				{
					name: "greet",
					arguments: { name: "Alice" },
				},
			);

			expect(proxyGetResponse.error).toBeUndefined();
			expect(mcpClientGetResponse.error).toBeUndefined();

			// Both should return similar prompt structure
			const proxyPrompt = proxyGetResponse.result as {
				description: string;
				messages: unknown[];
			};
			const mcpClientPrompt = mcpClientGetResponse.result as {
				description: string;
				messages: unknown[];
			};

			expect(proxyPrompt.description).toBe(mcpClientPrompt.description);
			expect(proxyPrompt.messages).toHaveLength(mcpClientPrompt.messages.length);
		});
	});

	describe("Connection Management", () => {
		it("both modes handle initialize requests", async () => {
			const proxyUrl = `http://localhost:${proxyGateway.port}/servers/test-server/mcp`;
			const mcpClientUrl = `http://localhost:${mcpClientGateway.port}/servers/test-server/mcp`;

			// Initialize in proxy mode
			const proxyInitResponse = await makeJsonRpcRequest(
				proxyUrl,
				"initialize",
				{
					protocolVersion: "2025-06-18",
					clientInfo: {
						name: "test-client-proxy",
						version: "1.0.0",
					},
				},
			);

			// Initialize in MCP client mode
			const mcpClientInitResponse = await makeJsonRpcRequest(
				mcpClientUrl,
				"initialize",
				{
					protocolVersion: "2025-06-18",
					clientInfo: {
						name: "test-client-mcp",
						version: "1.0.0",
					},
				},
			);

			expect(proxyInitResponse.error).toBeUndefined();
			expect(mcpClientInitResponse.error).toBeUndefined();

			// Both should return server info
			expect(proxyInitResponse.result).toBeDefined();
			expect(mcpClientInitResponse.result).toBeDefined();
		});

		it("both modes handle ping requests", async () => {
			const proxyUrl = `http://localhost:${proxyGateway.port}/servers/test-server/mcp`;
			const mcpClientUrl = `http://localhost:${mcpClientGateway.port}/servers/test-server/mcp`;

			// Ping in proxy mode
			const proxyPingResponse = await makeJsonRpcRequest(proxyUrl, "ping");

			// Ping in MCP client mode
			const mcpClientPingResponse = await makeJsonRpcRequest(
				mcpClientUrl,
				"ping",
			);

			expect(proxyPingResponse.error).toBeUndefined();
			expect(mcpClientPingResponse.error).toBeUndefined();

			// Both should return empty result
			expect(proxyPingResponse.result).toBeDefined();
			expect(mcpClientPingResponse.result).toBeDefined();
		});
	});
});
