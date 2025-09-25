import type { FC } from "hono/jsx";

// Type definitions for the ResourceRead component based on MCP spec
export interface ResourceReadData {
  uri: string;
  durationMs?: number;
  sessionId?: string;
  requestId: string;
  response?: {
    success: boolean;
    result?: {
      contents: Array<{
        uri: string;
        name?: string;
        title?: string;
        mimeType?: string;
        text?: string;
        blob?: string;
        size?: number;
      }>;
    };
    error?: string;
    timestamp: string;
  };
  timestamp: string;
}

interface ResourceReadProps {
  data: ResourceReadData;
  expanded?: boolean;
}

export const ResourceRead: FC<ResourceReadProps> = ({
  data,
  expanded = false,
}) => {
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getResponseIcon = () => {
    if (!data.response) return "○"; // Empty circle for pending
    return data.response.success ? "✓" : "✗"; // Check or X
  };

  const getResponseStatus = () => {
    if (!data.response) return "pending";
    return data.response.success ? "success" : "error";
  };

  const getResourceName = () => {
    // Extract the resource name from URI for display
    const parts = data.uri.split("/");
    return parts[parts.length - 1] || data.uri;
  };

  const formatSize = (size?: number) => {
    if (!size) return "N/A";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <details open={expanded}>
      <summary>
        <span class="width-min" style="opacity: 0.72">
          &nbsp;[{formatTimestamp(data.timestamp)}]&nbsp;
        </span>
        <span class="width-auto">
          <span style="opacity:0.72">[resources/read]&nbsp;</span>
          {getResourceName()}&nbsp;
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

        <h4>Resource URI</h4>
        <pre style="font-size: 0.9em; padding: 0.5em; overflow-x: auto;">
          {data.uri}
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

            {data.response.success && data.response.result?.contents && (
              <>
                <h5>Resource Contents</h5>
                {data.response.result.contents.map((content) => (
                  <div key={content.uri} style="margin-bottom: 1em;">
                    <table>
                      <tbody>
                        {content.name && (
                          <tr>
                            <th class="width-min">Name</th>
                            <td class="width-auto">{content.name}</td>
                          </tr>
                        )}
                        {content.title && (
                          <tr>
                            <th class="width-min">Title</th>
                            <td class="width-auto">{content.title}</td>
                          </tr>
                        )}
                        {content.mimeType && (
                          <tr>
                            <th class="width-min">MIME Type</th>
                            <td class="width-auto">{content.mimeType}</td>
                          </tr>
                        )}
                        {content.size && (
                          <tr>
                            <th class="width-min">Size</th>
                            <td class="width-auto">
                              {formatSize(content.size)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {content.text && (
                      <>
                        <h6>Text Content</h6>
                        <pre style="font-size: 0.8em; padding: 0.5em; overflow-x: auto; max-height: 200px; background: #f8f8f8;">
                          {content.text.length > 500
                            ? // biome-ignore lint/style/useTemplate: ssr
                              content.text.substring(0, 500) + "..."
                            : content.text}
                        </pre>
                      </>
                    )}

                    {content.blob && (
                      <>
                        <h6>Binary Content</h6>
                        <pre style="font-size: 0.8em; padding: 0.5em; overflow-x: auto; background: #f0f0f0;">
                          [Base64 encoded data - {content.blob.length}{" "}
                          characters]
                        </pre>
                      </>
                    )}
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
export const ResourceReadStories = {
  textFile: {
    uri: "file:///project/src/main.rs",
    durationMs: 45,
    sessionId: "sess-resource123",
    requestId: "req-res-456",
    response: {
      success: true,
      result: {
        contents: [
          {
            uri: "file:///project/src/main.rs",
            name: "main.rs",
            title: "Rust Software Application Main File",
            mimeType: "text/x-rust",
            text: 'fn main() {\n    println!("Hello world!");\n    // More code would be here...\n    let x = 42;\n    println!("The answer is {}", x);\n}',
            size: 156,
          },
        ],
      },
      timestamp: "2025-09-25T14:25:30.456Z",
    },
    timestamp: "2025-09-25T14:25:30.123Z",
  } as ResourceReadData,

  binaryFile: {
    uri: "file:///project/assets/logo.png",
    durationMs: 23,
    sessionId: "sess-resource456",
    requestId: "req-res-789",
    response: {
      success: true,
      result: {
        contents: [
          {
            uri: "file:///project/assets/logo.png",
            name: "logo.png",
            title: "Company Logo",
            mimeType: "image/png",
            blob: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
            size: 2048,
          },
        ],
      },
      timestamp: "2025-09-25T14:26:15.789Z",
    },
    timestamp: "2025-09-25T14:26:15.234Z",
  } as ResourceReadData,

  error: {
    uri: "file:///nonexistent/file.txt",
    durationMs: 12,
    sessionId: "sess-resource789",
    requestId: "req-res-error",
    response: {
      success: false,
      error: "Resource not found: file:///nonexistent/file.txt",
      timestamp: "2025-09-25T14:27:45.123Z",
    },
    timestamp: "2025-09-25T14:27:45.001Z",
  } as ResourceReadData,

  pending: {
    uri: "https://api.example.com/data/metrics.json",
    requestId: "req-res-pending",
    timestamp: "2025-09-25T14:28:10.555Z",
  } as ResourceReadData,

  withoutSession: {
    uri: "git://repo/config.yaml",
    durationMs: 78,
    requestId: "req-res-git",
    response: {
      success: true,
      result: {
        contents: [
          {
            uri: "git://repo/config.yaml",
            name: "config.yaml",
            mimeType: "application/yaml",
            text: "version: '3.8'\nservices:\n  app:\n    image: node:18\n    ports:\n      - '3000:3000'",
            size: 89,
          },
        ],
      },
      timestamp: "2025-09-25T14:29:00.234Z",
    },
    timestamp: "2025-09-25T14:28:59.890Z",
  } as ResourceReadData,
};
