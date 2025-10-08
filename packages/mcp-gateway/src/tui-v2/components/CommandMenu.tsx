import { useKeyboard } from "@opentui/react";
import { useState } from "react";
import { commandShortcuts } from "../shortcuts";
import { useAppStore } from "../store";
import { useTheme } from "../theme-context";
import { Modal } from "./Modal";

type CommandItem = {
  id: string;
  label: string;
  shortcut: string;
  statusInfo?: string;
  action: () => void;
  disabled?: boolean;
};

export function CommandMenu() {
  const theme = useTheme();
  const closeCommandMenu = useAppStore((state) => state.closeCommandMenu);
  const setViewMode = useAppStore((state) => state.setViewMode);
  const openModal = useAppStore((state) => state.openModal);
  const clearLogs = useAppStore((state) => state.clearLogs);
  const registry = useAppStore((state) => state.registry);
  const logs = useAppStore((state) => state.logs);
  const viewMode = useAppStore((state) => state.viewMode);

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Calculate status information
  const serverCount = registry.servers.length;
  const upCount = registry.servers.filter((s) => s.health === "up").length;
  const downCount = registry.servers.filter((s) => s.health === "down").length;
  const serverStatus = `${serverCount} servers • ${upCount} up, ${downCount} down`;

  const logCount = logs.length;
  const logStatus = `${logCount} entries${viewMode === "activity-log" ? " • Following" : ""}`;

  // Define command items
  const commands: CommandItem[] = [
    {
      id: "server-management",
      label: "Go to Server Management",
      shortcut: commandShortcuts.serverManagement.key,
      statusInfo: serverStatus,
      action: () => {
        setViewMode("server-management");
        closeCommandMenu();
      },
    },
    {
      id: "activity-logs",
      label: "Go to Activity Log",
      shortcut: commandShortcuts.activityLog.key,
      statusInfo: logStatus,
      action: () => {
        setViewMode("activity-log");
        closeCommandMenu();
      },
    },
    {
      id: "add-server",
      label: "Add New Server",
      shortcut: commandShortcuts.addServer.key,
      action: () => {
        openModal("add-server");
        closeCommandMenu();
      },
    },
    {
      id: "clear-logs",
      label: "Clear Logs",
      shortcut: commandShortcuts.clearLogs.key,
      statusInfo: logCount > 0 ? `${logCount} entries` : "(empty)",
      disabled: logCount === 0,
      action: () => {
        if (logCount > 0) {
          clearLogs();
          closeCommandMenu();
        }
      },
    },
    {
      id: "mcp-instructions",
      label: "Help",
      shortcut: commandShortcuts.help.key,
      action: () => {
        openModal("mcp-instructions");
        closeCommandMenu();
      },
    },
  ];

  // Keyboard navigation
  useKeyboard((key) => {
    if (key.name === "escape") {
      closeCommandMenu();
      return;
    }

    if (key.name === "up") {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.name === "down") {
      setSelectedIndex((prev) => Math.min(commands.length - 1, prev + 1));
      return;
    }

    if (key.name === "return") {
      const command = commands[selectedIndex];
      if (command && !command.disabled) {
        command.action();
      }
      return;
    }

    // Shortcut key selection
    const command = commands.find((cmd) => cmd.shortcut === key.name);
    if (command && !command.disabled) {
      command.action();
      return;
    }
  });

  return (
    <Modal
      title="Commands"
      onClose={closeCommandMenu}
      size="medium"
      scrollable={false}
    >
      {/* Command items */}
      {commands.map((command, index) => {
        const isSelected = index === selectedIndex;
        const isDisabled = command.disabled;

        return (
          <box
            key={command.id}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              backgroundColor: isSelected ? theme.emphasis : undefined,
            }}
          >
            {/* Left side: Shortcut + Label */}
            <box style={{ flexDirection: "row", gap: 1 }}>
              <text
                fg={
                  isDisabled
                    ? theme.foregroundMuted
                    : isSelected
                      ? theme.accent
                      : theme.foreground
                }
              >
                [{command.shortcut}]
              </text>
              <text
                fg={
                  isDisabled
                    ? theme.foregroundMuted
                    : isSelected
                      ? theme.accent
                      : theme.foreground
                }
              >
                {command.label}
              </text>
            </box>

            {/* Right side: Status info */}
            {command.statusInfo && (
              <text fg={theme.foregroundMuted}>{command.statusInfo}</text>
            )}
          </box>
        );
      })}
    </Modal>
  );
}
