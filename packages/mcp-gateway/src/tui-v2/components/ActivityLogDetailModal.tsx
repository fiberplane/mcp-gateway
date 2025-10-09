import { useAppStore } from "../store";
import { useTheme } from "../theme-context";
import { getRequestResponsePair } from "../utils/logCorrelation";
import { Modal } from "./Modal";
import { RoundedBox } from "./ui/RoundedBox";

export function ActivityLogDetailModal() {
  const theme = useTheme();
  const closeModal = useAppStore((state) => state.closeModal);
  const selectedLog = useAppStore((state) => state.selectedLog);
  const logs = useAppStore((state) => state.logs);

  if (!selectedLog) {
    closeModal();
    return null;
  }

  // Find correlated request/response
  const pair = getRequestResponsePair(selectedLog, logs);
  const { request: requestLog, response: responseLog } = pair;

  // Determine what to display
  const hasCorrelation = requestLog && responseLog;
  const isPending = requestLog && !responseLog;
  const isOrphaned = responseLog && !requestLog;
  const isNotification = requestLog && !requestLog.request?.id;

  // Calculate timing
  const requestTime = requestLog ? new Date(requestLog.timestamp) : null;
  const responseTime = responseLog ? new Date(responseLog.timestamp) : null;

  // Get request/response IDs
  const requestId = requestLog?.request?.id ?? responseLog?.response?.id;

  // Determine status color
  const getStatusColor = () => {
    if (isPending) return theme.foregroundMuted;
    if (isOrphaned) return theme.warning;
    if (responseLog?.errorMessage) return theme.danger;
    const status = responseLog?.httpStatus ?? 0;
    if (status >= 200 && status < 300) return theme.success;
    if (status >= 400 && status < 500) return theme.warning;
    if (status >= 500) return theme.danger;
    return theme.foreground;
  };

  const statusColor = getStatusColor();

  // Format status text
  const getStatusText = () => {
    if (isPending) return "⏳ Pending (no response yet)";
    if (isOrphaned) return "⚠ Orphaned (no matching request)";
    const status = responseLog?.httpStatus ?? 0;
    if (status === 200) return "200 OK";
    if (status === 404) return "404 Not Found";
    if (status >= 500) return `${status} Server Error`;
    if (status >= 400) return `${status} Client Error`;
    return status ? `${status}` : "Unknown";
  };

  const modalTitle = hasCorrelation
    ? "Exchange Details"
    : isNotification
      ? "Notification Details"
      : isPending
        ? "Request Details"
        : isOrphaned
          ? "Response Details"
          : "Log Details";

  return (
    <Modal
      title={modalTitle}
      onClose={closeModal}
      size="large"
      scrollable={true}
    >
      <box style={{ flexDirection: "column", gap: 1 }}>
        {/* Header Section - Two Column Layout */}
        <box style={{ flexDirection: "row", gap: 2 }}>
          {/* Left Column - Labels */}
          <box style={{ flexDirection: "column", gap: 0, flexShrink: 0 }}>
            <text fg={theme.foregroundMuted}>Server:</text>
            <text fg={theme.foregroundMuted}>Session:</text>
            {requestId && <text fg={theme.foregroundMuted}>Request ID:</text>}
            <text fg={theme.foregroundMuted}>Method:</text>
            <text fg={theme.foregroundMuted}>Status:</text>
            {hasCorrelation && requestTime && (
              <>
                <text fg={theme.foregroundMuted}>Request Time:</text>
                <text fg={theme.foregroundMuted}>Response Time:</text>
              </>
            )}
            {responseLog?.errorMessage && (
              <text fg={theme.foregroundMuted}>Error:</text>
            )}
          </box>

          {/* Right Column - Values */}
          <box style={{ flexDirection: "column", gap: 0, flexGrow: 1 }}>
            <text fg={theme.accent}>
              {requestLog?.serverName || responseLog?.serverName}
            </text>
            <text fg={theme.foreground}>
              {requestLog?.sessionId || responseLog?.sessionId}
            </text>
            {requestId && <text fg={theme.accent}>{String(requestId)}</text>}
            <text fg={theme.foreground}>
              {requestLog?.method || responseLog?.method}
            </text>
            <box style={{ flexDirection: "row", gap: 1 }}>
              <text fg={statusColor}>{getStatusText()}</text>
              {responseLog?.duration && (
                <text fg={theme.foregroundMuted}>
                  ({responseLog.duration}ms)
                </text>
              )}
            </box>
            {hasCorrelation && requestTime && responseTime && (
              <>
                <text fg={theme.foreground}>{requestTime.toISOString()}</text>
                <text fg={theme.foreground}>{responseTime.toISOString()}</text>
              </>
            )}
            {responseLog?.errorMessage && (
              <text fg={theme.danger}>{responseLog.errorMessage}</text>
            )}
          </box>
        </box>

        {/* Request Section */}
        {requestLog?.request && (
          <RoundedBox
            title={isNotification ? "Notification" : "Request"}
            style={{ borderColor: theme.foregroundMuted }}
          >
            {/* <box
            style={{
              flexDirection: "column",
              border: true,
              borderColor: theme.border,
              padding: 1,
            }}
            title={isNotification ? "Notification" : "Request"}
          > */}
            <text fg={theme.foreground}>
              {JSON.stringify(requestLog.request, null, 2)}
            </text>
            {/* </box> */}
          </RoundedBox>
        )}

        {/* Response Section */}
        {responseLog?.response && (
          // <box
          //   style={{
          //     flexDirection: "column",
          //     border: true,
          //     borderColor: responseLog.response.error ? theme.danger : theme.border,
          //     padding: 1,
          //   }}
          //   title={responseLog.response.error ? "Error Response" : "Response"}
          // >
          <RoundedBox
            title={responseLog.response.error ? "Error Response" : "Response"}
            style={{ borderColor: theme.foregroundMuted }}
          >
            <text fg={theme.foreground}>
              {JSON.stringify(responseLog.response, null, 2)}
            </text>
          </RoundedBox>
        )}

        {/* Pending message */}
        {isPending && (
          <box
            style={{
              padding: 1,
              backgroundColor: theme.emphasis,
            }}
          >
            <text fg={theme.foregroundMuted}>
              ℹ Response not received yet. Check activity log for updates.
            </text>
          </box>
        )}

        {/* Orphaned message */}
        {isOrphaned && (
          <RoundedBox
            style={{
              borderColor: theme.warning,
              backgroundColor: theme.emphasis,
            }}
          >
            <text fg={theme.warning}>
              ⚠ No matching request found in logs. This may happen if the
              gateway restarted or logs were cleared.
            </text>
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
