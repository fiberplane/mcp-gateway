import { useKeyboard } from "@opentui/react";
import { useCallback, useState } from "react";
import { debug } from "../debug";
import { useAppStore } from "../store";
import { useTheme } from "../theme-context";
import { Modal } from "./Modal";

export function AddServerModal() {
  const theme = useTheme();
  const closeModal = useAppStore((state) => state.closeModal);
  const addServer = useAppStore((state) => state.addServer);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [focusedField, setFocusedField] = useState<"name" | "url">("url");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

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
      debug("Adding server", { name, url });
      await addServer(name, url);
      debug("Server added successfully");
      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      debug("Error adding server", message);
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
  const gatewayUrl = (
    <>
      http://localhost:3333/servers/
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
        <text fg={theme.foregroundMuted}>Enter your MCP server URL</text>
        <box
          title="Server URL"
          style={{
            border: true,
            width: 50,
            height: 3,
            paddingLeft: 1,
            paddingRight: 1,
          }}
        >
          <input
            placeholder="http://localhost:3000/mcp"
            value={url}
            onInput={setUrl}
            onSubmit={handleSubmit}
            focused={focusedField === "url"}
          />
        </box>

        <text fg={theme.foregroundMuted}>Give it a name</text>
        <box
          title="Server Name"
          style={{
            border: true,
            width: 50,
            height: 3,
            paddingLeft: 1,
            paddingRight: 1,
          }}
        >
          <input
            placeholder="my-server"
            value={name}
            onInput={setName}
            onSubmit={handleSubmit}
            focused={focusedField === "name"}
            style={{
              paddingLeft: 1,
              paddingRight: 1,
            }}
          />
        </box>
        {/* Gateway URL Preview */}
        <box
          style={{
            flexDirection: "column",
          }}
        >
          <text fg={theme.foregroundMuted}>Forward traffic from:</text>
          <text fg={theme.accent}>{gatewayUrl}</text>
          <text fg={theme.foregroundMuted}>&#x2192;</text>
          <text fg={theme.accent}>
            {url || (
              <em style={{ fg: theme.foregroundSubtle }}>
                http://localhost:3000/mcp
              </em>
            )}
          </text>
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
