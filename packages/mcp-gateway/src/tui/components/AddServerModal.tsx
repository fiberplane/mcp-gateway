import { useKeyboard } from "@opentui/react";
import { useCallback, useState } from "react";
import { logger } from "@fiberplane/mcp-gateway-core";
import { useCompactHeight } from "../hooks/useCompactHeight";
import { useAppStore } from "../store";
import { useTheme } from "../theme-context";
import { getGatewayBaseUrl } from "../utils/gateway-urls";
import { Modal } from "./Modal";
import { BorderedInput } from "./ui/BorderedInput";

export function AddServerModal() {
  const theme = useTheme();
  const closeModal = useAppStore((state) => state.closeModal);
  const addServer = useAppStore((state) => state.addServer);
  const port = useAppStore((state) => state.port);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [focusedField, setFocusedField] = useState<"name" | "url">("url");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const compactHeight = useCompactHeight();

  // Debug paste handling
  const handleUrlPaste = useCallback((pastedText: string) => {
    logger.debug("Paste detected in URL field", { text: pastedText });
    setUrl(pastedText.trim());
  }, []);

  const handleNamePaste = useCallback((pastedText: string) => {
    logger.debug("Paste detected in name field", { text: pastedText });
    setName(pastedText.trim());
  }, []);

  // Handle Tab key to switch between fields
  useKeyboard((key) => {
    if (key.name === "tab") {
      setFocusedField((prev) => (prev === "name" ? "url" : "name"));
    }
  });

  const handleSubmit = useCallback(async () => {
    // Validation
    if (!name.trim()) {
      setStatus("error");
      setErrorMessage("Server name is required");
      return;
    }

    if (!url.trim()) {
      setStatus("error");
      setErrorMessage("Server URL is required");
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      setStatus("error");
      setErrorMessage("Invalid URL format");
      return;
    }

    // Submit
    try {
      setStatus("submitting");
      setErrorMessage("");
      logger.debug("Adding server", { name, url });
      await addServer(name, url);
      logger.debug("Server added successfully");
      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error("Error adding server", { error: message });
      setStatus("error");
      setErrorMessage(message);
    }
  }, [name, url, addServer, closeModal]);

  const statusColor = status === "error" ? theme.danger : theme.foregroundMuted;
  const statusText =
    status === "submitting"
      ? "Adding server..."
      : status === "error"
        ? `Error: ${errorMessage}`
        : "";

  // Generate preview of gateway URL
  const previewName = name.trim();
  const encodedName = encodeURIComponent(previewName);
  const baseUrl = getGatewayBaseUrl(port);
  const gatewayUrl = (
    <>
      {baseUrl}/servers/
      {encodedName || <em style={{ fg: theme.foregroundSubtle }}>my-server</em>}
      /mcp
    </>
  );

  return (
    <Modal
      title="Add MCP Server"
      onClose={closeModal}
      size="medium"
      scrollable={false}
    >
      <box style={{ flexDirection: "column", gap: 1 }}>
        <box style={{ flexDirection: "column" }}>
          <BorderedInput
            title="Server URL"
            placeholder="http://localhost:3000/mcp"
            value={url}
            onInput={setUrl}
            onPaste={handleUrlPaste}
            onSubmit={handleSubmit}
            focused={focusedField === "url"}
          />
          <text fg={theme.foregroundMuted}>Your MCP server URL</text>
        </box>

        <box
          style={{
            flexDirection: "column",
            gap: compactHeight.enabled ? 0 : 1,
          }}
        >
          <BorderedInput
            title="Server Name"
            placeholder="my-server"
            value={name}
            onInput={setName}
            onPaste={handleNamePaste}
            onSubmit={handleSubmit}
            focused={focusedField === "name"}
          />
          <text fg={theme.foregroundMuted}>
            Give your server/service a name
          </text>
        </box>
        {/* Gateway URL Preview */}
        <box
          style={{
            flexDirection: "column",
          }}
        >
          <text fg={theme.foregroundMuted}>
            This will enable traffic from the gateway at:
          </text>
          <text fg={theme.accent}>{gatewayUrl}</text>
          <box style={{ flexDirection: "row", gap: 1 }}>
            <text fg={theme.foregroundMuted}>&#x2192; </text>
            {url ? (
              <text fg={theme.accent}>{url}</text>
            ) : (
              <text fg={theme.foregroundSubtle}>
                <em>http://localhost:3000/mcp</em>
              </text>
            )}
          </box>
        </box>

        {statusText && (
          <box
            style={{
              padding: 1,
              marginTop: 1,
              border: status === "error",
              borderColor: theme.danger,
            }}
          >
            <text fg={statusColor}>{statusText}</text>
          </box>
        )}

        <text fg={theme.foregroundMuted} style={{ marginTop: 1 }}>
          [ENTER] Add Server • [TAB] Switch Field
        </text>
      </box>
    </Modal>
  );
}
