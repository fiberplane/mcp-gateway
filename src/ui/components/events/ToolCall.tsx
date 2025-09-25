import type { FC } from "hono/jsx";

// Type definitions for the ToolCall component
export interface ToolCallData {
  toolName: string;
  sessionId?: string;
  requestId: string;
  requestParams: Record<string, unknown>;
  response?: {
    success: boolean;
    result?: unknown;
    error?: string;
    timestamp: string;
  };
  timestamp: string;
}

interface ToolCallProps {
  data: ToolCallData;
  expanded?: boolean;
}

export const ToolCall: FC<ToolCallProps> = ({ data, expanded = false }) => {
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatJson = (obj: unknown) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  const getResponseIcon = () => {
    if (!data.response) return "○"; // Empty circle for pending
    return data.response.success ? "✓" : "✗"; // Check or X
  };

  const getResponseStatus = () => {
    if (!data.response) return "pending";
    return data.response.success ? "success" : "error";
  };

  return (
    <details open={expanded}>
      <summary>
        <span class="width-min">{formatTimestamp(data.timestamp)}</span>
        <span class="width-auto">{data.toolName}</span>
        <span class="width-min">{getResponseIcon()}</span>
      </summary>

      <div style="margin-left: 1ch; margin-top: 0.5em;">
        <table>
          <tbody>
            {data.sessionId && (
              <tr>
                <th class="width-min">Session</th>
                <td class="width-auto">{data.sessionId}</td>
              </tr>
            )}
            <tr>
              <th class="width-min">Request ID</th>
              <td class="width-auto">
                <code style="font-size: 0.8em; color: #666;">
                  {data.requestId}
                </code>
              </td>
            </tr>
            <tr>
              <th class="width-min">Status</th>
              <td class="width-auto">{getResponseStatus()}</td>
            </tr>
          </tbody>
        </table>

        <h4>Request Parameters</h4>
        <pre style="font-size: 0.9em; background: #f8f8f8; padding: 0.5em; overflow-x: auto;">
          {formatJson(data.requestParams)}
        </pre>

        {data.response && (
          <>
            <h4>Response</h4>
            <table>
              <tbody>
                <tr>
                  <th class="width-min">Time</th>
                  <td class="width-auto">
                    {formatTimestamp(data.response.timestamp)}
                  </td>
                </tr>
                <tr>
                  <th class="width-min">Success</th>
                  <td class="width-auto">
                    {data.response.success ? "Yes" : "No"}
                  </td>
                </tr>
              </tbody>
            </table>

            {data.response.success && data.response.result && (
              <>
                <h5>Result</h5>
                <pre style="font-size: 0.9em; background: #f0f8f0; padding: 0.5em; overflow-x: auto;">
                  {formatJson(data.response.result)}
                </pre>
              </>
            )}

            {!data.response.success && data.response.error && (
              <>
                <h5>Error</h5>
                <pre style="font-size: 0.9em; background: #f8f0f0; padding: 0.5em; overflow-x: auto; color: #d00;">
                  {data.response.error}
                </pre>
              </>
            )}
          </>
        )}

        {!data.response && (
          <div style="margin-top: 1em; padding: 0.5em; background: #f0f0f0; text-align: center;">
            <em>Response pending...</em>
          </div>
        )}
      </div>
    </details>
  );
};

// Story data for the storybook
export const ToolCallStories = {
  successful: {
    toolName: "read_file",
    sessionId: "sess-abc123",
    requestId: "req-456def",
    requestParams: {
      target_file: "/path/to/file.txt",
      limit: 100,
    },
    response: {
      success: true,
      result: {
        content: "File contents here...",
        lines: 42,
      },
      timestamp: "2025-09-25T14:30:45.123Z",
    },
    timestamp: "2025-09-25T14:30:42.789Z",
  } as ToolCallData,

  error: {
    toolName: "write_file",
    sessionId: "sess-xyz789",
    requestId: "req-789ghi",
    requestParams: {
      file_path: "/readonly/file.txt",
      contents: "Cannot write here",
    },
    response: {
      success: false,
      error: "Permission denied: /readonly/file.txt is not writable",
      timestamp: "2025-09-25T14:32:18.456Z",
    },
    timestamp: "2025-09-25T14:32:15.123Z",
  } as ToolCallData,

  pending: {
    toolName: "codebase_search",
    requestId: "req-pending123",
    requestParams: {
      query: "How does authentication work?",
      target_directories: ["src/auth/"],
    },
    timestamp: "2025-09-25T14:35:20.789Z",
  } as ToolCallData,

  noSession: {
    toolName: "grep",
    requestId: "req-nosess456",
    requestParams: {
      pattern: "import.*React",
      path: "src/",
    },
    response: {
      success: true,
      result: {
        matches: 15,
        files: ["component1.tsx", "component2.tsx"],
      },
      timestamp: "2025-09-25T14:33:10.234Z",
    },
    timestamp: "2025-09-25T14:33:07.890Z",
  } as ToolCallData,
};
