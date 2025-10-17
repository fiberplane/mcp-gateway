import type {
	CaptureRecord,
	ClientInfo,
	JsonRpcRequest,
	JsonRpcResponse,
	McpServer,
	Registry,
} from "@fiberplane/mcp-gateway-types";
import { JsonlStorageBackend } from "./capture/backends/jsonl-backend.js";
import { SqliteStorageBackend } from "./capture/backends/sqlite-backend.js";
import { StorageManager } from "./capture/storage-manager.js";
import type { SSEEvent } from "./capture/sse-parser.js";

/**
 * Gateway instance - scoped to a single storage directory
 *
 * Provides all core functionality without global state:
 * - Capture operations (write logs, handle errors, SSE events)
 * - Registry operations (get server, manage registry)
 * - Storage management (lifecycle)
 *
 * Created via `createGateway()` factory function.
 */
export interface Gateway {
	/**
	 * Capture operations for logging MCP traffic
	 */
	capture: {
		/**
		 * Append a capture record to storage
		 */
		append(record: CaptureRecord): Promise<void>;

		/**
		 * Capture an error response
		 */
		error(
			serverName: string,
			sessionId: string,
			request: JsonRpcRequest,
			error: { code: number; message: string; data?: unknown },
			httpStatus: number,
			durationMs: number,
		): Promise<void>;

		/**
		 * Capture an SSE event
		 */
		sseEvent(
			serverName: string,
			sessionId: string,
			sseEvent: SSEEvent,
			method?: string,
			requestId?: string | number | null,
		): Promise<void>;

		/**
		 * Capture JSON-RPC message from SSE
		 */
		sseJsonRpc(
			serverName: string,
			sessionId: string,
			jsonRpcMessage: JsonRpcRequest | JsonRpcResponse,
			sseEvent: SSEEvent,
			isResponse?: boolean,
		): Promise<CaptureRecord | null>;
	};

	/**
	 * Registry operations for server management
	 */
	registry: {
		/**
		 * Get a server from the registry by name
		 */
		getServer(registry: Registry, name: string): McpServer | undefined;
	};

	/**
	 * Client info management for sessions
	 */
	clientInfo: {
		/**
		 * Store client info for a session
		 */
		store(sessionId: string, info: ClientInfo): void;

		/**
		 * Get client info for a session
		 */
		get(sessionId: string): ClientInfo | undefined;

		/**
		 * Clear client info for a session
		 */
		clear(sessionId: string): void;

		/**
		 * Get all active session IDs
		 */
		getActiveSessions(): string[];
	};

	/**
	 * Close all connections and clean up resources
	 */
	close(): Promise<void>;
}

/**
 * Options for creating a Gateway instance
 */
export interface GatewayOptions {
	/**
	 * Storage directory for logs and registry
	 */
	storageDir: string;
}

// In-memory storage for client info by session (scoped to Gateway instance)
class ClientInfoStore {
	private sessionClientInfo = new Map<string, ClientInfo>();

	store(sessionId: string, clientInfo: ClientInfo): void {
		this.sessionClientInfo.set(sessionId, clientInfo);
	}

	get(sessionId: string): ClientInfo | undefined {
		return this.sessionClientInfo.get(sessionId);
	}

	clear(sessionId: string): void {
		this.sessionClientInfo.delete(sessionId);
	}

	getActiveSessions(): string[] {
		return Array.from(this.sessionClientInfo.keys()).filter(
			(id) => id !== "stateless",
		);
	}
}

// Store request start times for duration calculation (scoped to Gateway instance)
class RequestTracker {
	private requestStartTimes = new Map<string | number, number>();
	private requestMethods = new Map<string | number, string>();

	trackRequest(id: string | number, method: string): void {
		this.requestStartTimes.set(id, Date.now());
		this.requestMethods.set(id, method);
	}

	calculateDuration(id: string | number): number {
		const startTime = this.requestStartTimes.get(id);
		if (startTime === undefined) {
			return 0;
		}
		const duration = Date.now() - startTime;
		this.requestStartTimes.delete(id);
		this.requestMethods.delete(id);
		return duration;
	}

	getMethod(id: string | number): string | undefined {
		return this.requestMethods.get(id);
	}

	hasRequest(id: string | number): boolean {
		return this.requestStartTimes.has(id);
	}
}

/**
 * Create a scoped Gateway instance
 *
 * This replaces the old global singleton pattern with a factory that returns
 * a scoped instance. Each instance manages its own storage connections and state.
 *
 * @param options - Gateway configuration
 * @returns Gateway instance
 *
 * @example
 * ```typescript
 * const gateway = await createGateway({ storageDir: "~/.mcp-gateway" });
 *
 * // Use capture operations
 * await gateway.capture.append(record);
 *
 * // Use registry operations
 * const server = gateway.registry.getServer(registry, "my-server");
 *
 * // Cleanup on shutdown
 * await gateway.close();
 * ```
 */
export async function createGateway(
	options: GatewayOptions,
): Promise<Gateway> {
	const { storageDir } = options;

	// Create scoped storage manager (not global)
	const storageManager = new StorageManager();
	storageManager.registerBackend(new JsonlStorageBackend());
	storageManager.registerBackend(new SqliteStorageBackend());
	await storageManager.initialize(storageDir);

	// Create scoped client info store
	const clientInfoStore = new ClientInfoStore();

	// Create scoped request tracker
	const requestTracker = new RequestTracker();

	// Import capture functions dynamically to avoid circular dependencies
	const captureModule = await import("./capture/index.js");

	return {
		capture: {
			append: async (record: CaptureRecord) => {
				await storageManager.write(record);
			},

			error: async (
				serverName: string,
				sessionId: string,
				request: JsonRpcRequest,
				error: { code: number; message: string; data?: unknown },
				httpStatus: number,
				durationMs: number,
			) => {
				// Only capture error response if request expected a response
				if (request.id == null) {
					return; // Notification errors aren't sent back
				}

				const errorResponse: JsonRpcResponse = {
					jsonrpc: "2.0",
					id: request.id,
					error,
				};

				const record = captureModule.createResponseCaptureRecord(
					serverName,
					sessionId,
					errorResponse,
					httpStatus,
					request.method,
					clientInfoStore.get(sessionId),
					requestTracker,
				);

				// Override the calculated duration with the provided one
				record.metadata.durationMs = durationMs;

				await storageManager.write(record);
			},

			sseEvent: async (
				serverName: string,
				sessionId: string,
				sseEvent: SSEEvent,
				method?: string,
				requestId?: string | number | null,
			) => {
				try {
					const record = captureModule.createSSEEventCaptureRecord(
						serverName,
						sessionId,
						sseEvent,
						method,
						requestId,
						clientInfoStore.get(sessionId),
					);
					await storageManager.write(record);
				} catch (error) {
					// Import logger dynamically to avoid circular deps
					const { logger } = await import("./logger.js");
					logger.error("Failed to capture SSE event", { error: String(error) });
					// Don't throw - SSE capture failures shouldn't break streaming
				}
			},

			sseJsonRpc: async (
				serverName: string,
				sessionId: string,
				jsonRpcMessage: JsonRpcRequest | JsonRpcResponse,
				sseEvent: SSEEvent,
				isResponse = false,
			) => {
				try {
					const record = captureModule.createSSEJsonRpcCaptureRecord(
						serverName,
						sessionId,
						jsonRpcMessage,
						sseEvent,
						isResponse,
						clientInfoStore.get(sessionId),
						requestTracker,
					);
					await storageManager.write(record);
					return record;
				} catch (error) {
					const { logger } = await import("./logger.js");
					logger.error("Failed to capture SSE JSON-RPC", {
						error: String(error),
					});
					// Don't throw - SSE capture failures shouldn't break streaming
					return null;
				}
			},
		},

		registry: {
			getServer: (registry: Registry, name: string) => {
				return registry.servers.find((s) => s.name === name);
			},
		},

		clientInfo: {
			store: (sessionId: string, info: ClientInfo) =>
				clientInfoStore.store(sessionId, info),
			get: (sessionId: string) => clientInfoStore.get(sessionId),
			clear: (sessionId: string) => clientInfoStore.clear(sessionId),
			getActiveSessions: () => clientInfoStore.getActiveSessions(),
		},

		close: async () => {
			await storageManager.close();
		},
	};
}
