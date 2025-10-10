import { useAppStore } from "../store";
import { useTheme } from "../theme-context";
import { Modal } from "./Modal";
import { CodeBlock } from "./ui/CodeBlock";
import { RoundedBox } from "./ui/RoundedBox";

export function ActivityLogDetailModal() {
  const theme = useTheme();
  const closeModal = useAppStore((state) => state.closeModal);
  const selectedLog = useAppStore((state) => state.selectedLog);

  if (!selectedLog) {
    closeModal();
    return null;
  }

  const isRequest = selectedLog.direction === "request";
  const isResponse = selectedLog.direction === "response";

  // Get request/response ID
  const requestId = selectedLog.request?.id ?? selectedLog.response?.id;

  // Determine status color (for responses)
  const getStatusColor = () => {
    if (!isResponse) return theme.foreground;
    if (selectedLog.errorMessage) return theme.danger;
    const status = selectedLog.httpStatus ?? 0;
    if (status >= 200 && status < 300) return theme.success;
    if (status >= 400 && status < 500) return theme.warning;
    if (status >= 500) return theme.danger;
    return theme.foreground;
  };

  const statusColor = getStatusColor();

  // Format status text (for responses)
  const getStatusText = () => {
    const status = selectedLog.httpStatus ?? 0;
    if (status === 200) return "200 OK";
    if (status === 404) return "404 Not Found";
    if (status >= 500) return `${status} Server Error`;
    if (status >= 400) return `${status} Client Error`;
    return status ? `${status}` : "Unknown";
  };

  const modalTitle = isRequest ? "Request Details" : "Response Details";

  return (
    <Modal title={modalTitle} onClose={closeModal} size="large" scrollable>
      <box style={{ flexDirection: "column", gap: 1, flexShrink: 0 }}>
        {/* Header Section - Two Column Layout */}
        <box style={{ flexDirection: "row", gap: 2 }}>
          {/* Left Column - Labels */}
          <box style={{ flexDirection: "column", gap: 0, flexShrink: 0 }}>
            <text fg={theme.foregroundMuted}>Server:</text>
            <text fg={theme.foregroundMuted}>Session:</text>
            {!!requestId && <text fg={theme.foregroundMuted}>Request ID:</text>}
            <text fg={theme.foregroundMuted}>Method:</text>
            {isResponse && <text fg={theme.foregroundMuted}>Status:</text>}
            {!!selectedLog.errorMessage && (
              <text fg={theme.foregroundMuted}>Error:</text>
            )}
          </box>

          {/* Right Column - Values */}
          <box style={{ flexDirection: "column", gap: 0, flexGrow: 1 }}>
            <text fg={theme.accent}>{selectedLog.serverName}</text>
            <text fg={theme.foreground}>{selectedLog.sessionId}</text>
            {!!requestId && <text fg={theme.accent}>{String(requestId)}</text>}
            <text fg={theme.foreground}>{selectedLog.method}</text>
            {!!isResponse && (
              <box style={{ flexDirection: "row", gap: 1 }}>
                <text fg={statusColor}>{getStatusText()}</text>
                {selectedLog.duration && (
                  <text fg={theme.foregroundMuted}>
                    ({selectedLog.duration}ms)
                  </text>
                )}
              </box>
            )}
            {!!selectedLog.errorMessage && (
              <text fg={theme.danger}>{selectedLog.errorMessage}</text>
            )}
          </box>
        </box>

        {/* Request Payload */}
        {isRequest && selectedLog.request && (
          <RoundedBox
            title="Request"
            style={{ borderColor: theme.foregroundMuted, gap: 0 }}
          >
            <CodeBlock
              content={JSON.stringify(selectedLog.request, null, 2)}
              padding={0}
              style={{ backgroundColor: undefined }}
            />
          </RoundedBox>
        )}

        {/* Response Payload */}
        {isResponse && selectedLog.response && (
          <RoundedBox
            title={selectedLog.response.error ? "Error Response" : "Response"}
            style={{ borderColor: theme.foregroundMuted, gap: 0 }}
          >
            <CodeBlock
              content={JSON.stringify(selectedLog.response, null, 2)}
              padding={0}
              style={{ backgroundColor: undefined }}
            />
          </RoundedBox>
        )}

        {/* Footer with tip */}
        <box
          style={{
            flexDirection: "row",
            gap: 2,
            paddingTop: 1,
            border: ["top"],
            borderColor: theme.border,
          }}
        >
          <text fg={theme.foregroundMuted}>
            Tip: Use modifier keys (Shift+Option on Mac) to select and copy text
          </text>
        </box>
      </box>
    </Modal>
  );
}
