import type { FC } from "hono/jsx";

// Type definitions for the PromptGet component based on MCP spec
export interface PromptGetData {
  promptName: string;
  durationMs?: number;
  sessionId?: string;
  requestId: string;
  requestParams: {
    name: string;
    arguments?: Record<string, unknown>;
  };
  response?: {
    success: boolean;
    result?: {
      description?: string;
      messages: Array<{
        role: "user" | "assistant";
        content: {
          type: "text" | "image" | "audio" | "resource";
          text?: string;
          data?: string;
          mimeType?: string;
          resource?: {
            uri: string;
            name: string;
            title?: string;
            mimeType: string;
            text?: string;
          };
        };
      }>;
    };
    error?: string;
    timestamp: string;
  };
  timestamp: string;
}

interface PromptGetProps {
  data: PromptGetData;
  expanded?: boolean;
}

export const PromptGet: FC<PromptGetProps> = ({ data, expanded = false }) => {
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

  const renderContent = (
    content: PromptGetData["response"]["result"]["messages"][0]["content"],
  ) => {
    switch (content.type) {
      case "text":
        return (
          <pre style="font-size: 0.9em; padding: 0.5em; overflow-x: auto; white-space: pre-wrap;">
            {content.text}
          </pre>
        );
      case "image":
        return (
          <div>
            <p>
              <strong>Image:</strong>&nbsp;{content.mimeType}
            </p>
            <code style="font-size: 0.8em; opacity: 0.72; word-break: break-all;">
              {content.data?.substring(0, 100)}...
            </code>
          </div>
        );
      case "audio":
        return (
          <div>
            <p>
              <strong>Audio:</strong>&nbsp;{content.mimeType}
            </p>
            <code style="font-size: 0.8em; opacity: 0.72; word-break: break-all;">
              {content.data?.substring(0, 100)}...
            </code>
          </div>
        );
      case "resource":
        return (
          <div>
            <p>
              <strong>Resource:</strong>&nbsp;{content.resource?.name}
            </p>
            <table>
              <tbody>
                <tr>
                  <th class="width-min">URI</th>
                  <td class="width-auto">{content.resource?.uri}</td>
                </tr>
                {content.resource?.title && (
                  <tr>
                    <th class="width-min">Title</th>
                    <td class="width-auto">{content.resource.title}</td>
                  </tr>
                )}
                <tr>
                  <th class="width-min">MIME Type</th>
                  <td class="width-auto">{content.resource?.mimeType}</td>
                </tr>
              </tbody>
            </table>
            {content.resource?.text && (
              <pre style="font-size: 0.9em; padding: 0.5em; overflow-x: auto; margin-top: 0.5em;">
                {content.resource.text}
              </pre>
            )}
          </div>
        );
      default:
        return <em>Unknown content type</em>;
    }
  };

  return (
    <details open={expanded}>
      <summary>
        <span class="width-min" style="opacity: 0.72">
          &nbsp;[{formatTimestamp(data.timestamp)}]&nbsp;
        </span>
        <span class="width-auto">
          <span style="opacity:0.72">[prompts/get]&nbsp;</span>
          {data.promptName}&nbsp;
        </span>
        <span class="width-min">{getResponseIcon()}</span>
      </summary>

      <div style="margin-left: 1ch; margin-top: 0.5em;">
        <table>
          <tbody>
            <tr>
              <th class="width-min">Status</th>
              <td class="width-auto">{getResponseStatus()}</td>
            </tr>
            <tr>
              <th class="width-min">Duration</th>
              <td class="width-auto">{data.durationMs || "N/A"}&nbsp;(ms)</td>
            </tr>
            {data.sessionId && (
              <tr>
                <th class="width-min">Session</th>
                <td class="width-auto">{data.sessionId}</td>
              </tr>
            )}
            <tr>
              <th class="width-min">Request ID</th>
              <td class="width-auto">
                <code style="font-size: 0.8em; opacity: 0.72;">
                  {data.requestId}
                </code>
              </td>
            </tr>
          </tbody>
        </table>

        <h4>Request Parameters</h4>
        <pre style="font-size: 0.9em; padding: 0.5em; overflow-x: auto;">
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
                {data.response.result.description && (
                  <>
                    <h5>Description</h5>
                    <p style="margin: 0.5em 0;">
                      {data.response.result.description}
                    </p>
                  </>
                )}

                <h5>Messages</h5>
                {data.response.result.messages.map((message, index) => (
                  <div
                    key={`${data.requestId}-msg-${index}`}
                    style="margin-bottom: 1em; border-left: 2px solid #ccc; padding-left: 0.5em;"
                  >
                    <p style="margin: 0 0 0.5em 0;">
                      <strong>Role:</strong>&nbsp;{message.role}
                    </p>
                    {renderContent(message.content)}
                  </div>
                ))}
              </>
            )}

            {!data.response.success && data.response.error && (
              <>
                <h5>Error</h5>
                <pre style="font-size: 0.9em; padding: 0.5em; overflow-x: auto; color: #d00;">
                  {data.response.error}
                </pre>
              </>
            )}
          </>
        )}

        {!data.response && (
          <div style="margin-top: 1em; padding: 0.5em; text-align: center;">
            <em>Response pending...</em>
          </div>
        )}
      </div>
    </details>
  );
};

// Story data for the storybook
export const PromptGetStories = {
  successful: {
    promptName: "code_review",
    durationMs: 150,
    sessionId: "sess-prompt123",
    requestId: "req-prompt456",
    requestParams: {
      name: "code_review",
      arguments: {
        code: "def hello():\n    print('world')",
        language: "python",
      },
    },
    response: {
      success: true,
      result: {
        description: "Code review prompt",
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: "Please review this Python code:\ndef hello():\n    print('world')\n\nConsider style, efficiency, and best practices.",
            },
          },
        ],
      },
      timestamp: "2025-09-25T14:30:45.123Z",
    },
    timestamp: "2025-09-25T14:30:42.789Z",
  } as PromptGetData,

  withResource: {
    promptName: "documentation_help",
    durationMs: 200,
    sessionId: "sess-doc789",
    requestId: "req-doc123",
    requestParams: {
      name: "documentation_help",
      arguments: {
        topic: "authentication",
      },
    },
    response: {
      success: true,
      result: {
        description: "Documentation assistance prompt",
        messages: [
          {
            role: "user" as const,
            content: {
              type: "resource" as const,
              resource: {
                uri: "resource://docs/auth",
                name: "auth_guide",
                title: "Authentication Guide",
                mimeType: "text/markdown",
                text: "# Authentication\n\nThis guide covers authentication patterns...",
              },
            },
          },
          {
            role: "assistant" as const,
            content: {
              type: "text" as const,
              text: "I can help you understand authentication. What specific aspect would you like to know about?",
            },
          },
        ],
      },
      timestamp: "2025-09-25T14:32:18.456Z",
    },
    timestamp: "2025-09-25T14:32:15.123Z",
  } as PromptGetData,

  error: {
    promptName: "invalid_prompt",
    durationMs: 50,
    sessionId: "sess-err456",
    requestId: "req-err789",
    requestParams: {
      name: "invalid_prompt",
      arguments: {
        missing_required: "value",
      },
    },
    response: {
      success: false,
      error: "Prompt 'invalid_prompt' not found",
      timestamp: "2025-09-25T14:33:10.234Z",
    },
    timestamp: "2025-09-25T14:33:07.890Z",
  } as PromptGetData,

  pending: {
    promptName: "long_analysis",
    requestId: "req-pending789",
    requestParams: {
      name: "long_analysis",
      arguments: {
        dataset: "large_file.csv",
        analysis_type: "comprehensive",
      },
    },
    timestamp: "2025-09-25T14:35:20.789Z",
  } as PromptGetData,
};
