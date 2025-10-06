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
  const [focusedField, setFocusedField] = useState<"name" | "url">("name");
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

  return (
    <Modal title="Add MCP Server" onClose={closeModal}>
      <box style={{ flexDirection: "column", gap: 1 }}>
        <box title="Server Name" style={{ border: true, width: 50, height: 3 }}>
          <input
            placeholder="my-server"
            value={name}
            onInput={setName}
            onSubmit={handleSubmit}
            focused={focusedField === "name"}
          />
        </box>

        <box title="Server URL" style={{ border: true, width: 50, height: 3 }}>
          <input
            placeholder="http://localhost:3000/mcp"
            value={url}
            onInput={setUrl}
            onSubmit={handleSubmit}
            focused={focusedField === "url"}
          />
        </box>

        {statusText && (
          <text fg={statusColor} style={{ marginTop: 1 }}>
            {statusText}
          </text>
        )}

        <text fg={theme.foregroundMuted} style={{ marginTop: 1 }}>
          [ENTER] Add Server • [TAB] Switch Field
        </text>
      </box>
    </Modal>
  );
}
