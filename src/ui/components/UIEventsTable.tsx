import type { FC } from "hono/jsx";
import type { UIEvent } from "../types/events.js";
import { PromptGet, type PromptGetData } from "./events/PromptGet.tsx";
import { ResourceRead, type ResourceReadData } from "./events/ResourceRead.tsx";
import { ToolCall, type ToolCallData } from "./events/ToolCall.tsx";

// Unknown event component for rendering unrecognized event types
const UnknownEvent: FC<{ data: UIEvent; expanded?: boolean }> = ({
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

  const formatJson = (obj: unknown) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  return (
    <details open={expanded}>
      <summary>
        <span class="width-min" style="opacity: 0.72">
          &nbsp;[{formatTimestamp(data.timestamp)}]&nbsp;
        </span>
        <span class="width-auto">
          <span style="opacity:0.72">[unknown]&nbsp;</span>
          {data.type || "Unknown Event"}&nbsp;
        </span>
        <span class="width-min">?</span>
      </summary>

      <div style="margin-left: 1ch; margin-top: 0.5em;">
        <h4>Raw Event Data</h4>
        <pre style="font-size: 0.9em; padding: 0.5em; overflow-x: auto; background: #f8f8f8;">
          {formatJson(data)}
        </pre>
      </div>
    </details>
  );
};

// Function to convert UIEvent to specific event component data
function convertUIEventToComponentData(
  event: UIEvent,
): ToolCallData | PromptGetData | ResourceReadData | null {
  const baseData = {
    requestId: event.requestId?.toString() || "",
    timestamp: event.timestamp,
    durationMs: event.metadata.durationMs,
    sessionId: event.metadata.sessionId,
  };

  switch (event.type) {
    case "tool_call":
      if (event.details?.type === "tool_call") {
        return {
          ...baseData,
          toolName: event.details.toolName,
          requestParams: event.details.arguments,
          response: event.details.result && {
            success: !event.details.result.isError,
            result: event.details.result.content,
            error: event.details.result.isError
              ? "Tool call failed"
              : undefined,
            timestamp: event.timestamp,
          },
        } as ToolCallData;
      }
      break;

    case "prompt_get":
      if (event.details?.type === "prompt_get") {
        return {
          ...baseData,
          promptName: event.details.prompt.name,
          requestParams: {
            name: event.details.prompt.name,
            arguments: event.details.prompt.arguments,
          },
          response: {
            success: event.status === "success",
            result: {
              messages: event.details.messages.map((msg) => ({
                role: msg.role,
                content: msg.content[0] || { type: "text", text: "" },
              })),
            },
            timestamp: event.timestamp,
          },
        } as PromptGetData;
      }
      break;

    case "resource_read":
      if (event.details?.type === "resource_read") {
        return {
          ...baseData,
          uri: event.details.resource.uri,
          response: {
            success: event.status === "success",
            result: {
              contents: [
                {
                  uri: event.details.resource.uri,
                  name: event.details.resource.name,
                  mimeType: event.details.resource.mimeType,
                  text: event.details.content.find((c) => c.type === "text")
                    ?.text,
                },
              ],
            },
            timestamp: event.timestamp,
          },
        } as ResourceReadData;
      }
      break;
  }

  return null;
}

export const UIEventsTable: FC<{
  events: UIEvent[];
  compact?: boolean;
}> = ({ events }) => {
  if (events.length === 0) {
    return (
      <p>
        📭 No events yet. Events will appear here when the server starts
        processing requests.
      </p>
    );
  }

  return (
    <div>
      {events.map((event) => {
        // Render specific event component based on type
        switch (event.type) {
          case "tool_call": {
            const componentData = convertUIEventToComponentData(event);
            if (componentData && "toolName" in componentData) {
              return (
                <ToolCall
                  key={event.id}
                  data={componentData as ToolCallData}
                  expanded={false}
                />
              );
            }
            break;
          }

          case "prompt_get": {
            const componentData = convertUIEventToComponentData(event);
            if (componentData && "promptName" in componentData) {
              return (
                <PromptGet
                  key={event.id}
                  data={componentData as PromptGetData}
                  expanded={false}
                />
              );
            }
            break;
          }

          case "resource_read": {
            const componentData = convertUIEventToComponentData(event);
            if (componentData && "uri" in componentData) {
              return (
                <ResourceRead
                  key={event.id}
                  data={componentData as ResourceReadData}
                  expanded={false}
                />
              );
            }
            break;
          }
        }

        // Fallback to unknown event component
        return <UnknownEvent key={event.id} data={event} expanded={false} />;
      })}
    </div>
  );
};
