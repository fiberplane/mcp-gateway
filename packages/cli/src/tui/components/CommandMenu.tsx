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

type CommandGroup = {
  id: string;
  title?: string;
  commands: CommandItem[];
};

export function CommandMenu() {
  const theme = useTheme();
  const closeCommandMenu = useAppStore((state) => state.closeCommandMenu);
  const setViewMode = useAppStore((state) => state.setViewMode);
  const openModal = useAppStore((state) => state.openModal);
  const clearLogs = useAppStore((state) => state.clearLogs);
  const servers = useAppStore((state) => state.servers);
  const logs = useAppStore((state) => state.logs);
  const viewMode = useAppStore((state) => state.viewMode);

  // Calculate status information
  const serverCount = servers.length;
  const upCount = servers.filter((s) => s.health === "up").length;
  const downCount = servers.filter((s) => s.health === "down").length;
  const serverStatus = `${serverCount} servers • ${upCount} up, ${downCount} down`;

  const logCount = logs.length;
  const logStatus = `${logCount} entries${viewMode === "activity-log" ? " • Following" : ""}`;

  // Define command groups
  const commandGroups: CommandGroup[] = [
    {
      id: "Servers",
      title: "Servers",
      commands: [
        {
          id: "server-management",
          label: commandShortcuts.serverManagement.description,
          shortcut: commandShortcuts.serverManagement.key,
          statusInfo: serverStatus,
          action: () => {
            setViewMode("server-management");
            closeCommandMenu();
          },
        },
        {
          id: "add-server",
          label: commandShortcuts.addServer.description,
          shortcut: commandShortcuts.addServer.key,
          action: () => {
            openModal("add-server");
            closeCommandMenu();
          },
        },
      ],
    },
    {
      id: "Activity",
      title: "Activity",
      commands: [
        {
          id: "activity-logs",
          label: commandShortcuts.activityLog.description,
          shortcut: commandShortcuts.activityLog.key,
          statusInfo: logStatus,
          action: () => {
            setViewMode("activity-log");
            closeCommandMenu();
          },
        },
        {
          id: "clear-logs",
          label: commandShortcuts.clearLogs.description,
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
      ],
    },
    {
      id: "other",
      commands: [
        {
          id: "mcp-instructions",
          label: "Help",
          shortcut: commandShortcuts.help.key,
          action: () => {
            openModal("mcp-instructions");
            closeCommandMenu();
          },
        },
      ],
    },
  ];

  // Flatten commands for keyboard navigation
  const allCommands = commandGroups.flatMap((group) => group.commands);

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Keyboard navigation
  useKeyboard((key) => {
    if (key.name === "escape") {
      closeCommandMenu();
      return;
    }

    if (key.name === "up") {
      setSelectedIndex((prev) => {
        // Find previous non-disabled item
        let newIndex = prev - 1;
        while (newIndex >= 0 && allCommands[newIndex]?.disabled) {
          newIndex--;
        }
        return newIndex >= 0 ? newIndex : prev;
      });
      return;
    }

    if (key.name === "down") {
      setSelectedIndex((prev) => {
        // Find next non-disabled item
        let newIndex = prev + 1;
        while (
          newIndex < allCommands.length &&
          allCommands[newIndex]?.disabled
        ) {
          newIndex++;
        }
        return newIndex < allCommands.length ? newIndex : prev;
      });
      return;
    }

    if (key.name === "return") {
      const command = allCommands[selectedIndex];
      if (command && !command.disabled) {
        command.action();
      }
      return;
    }

    // Shortcut key selection
    const command = allCommands.find((cmd) => cmd.shortcut === key.name);
    if (command && !command.disabled) {
      command.action();
      return;
    }
  });

  // Calculate global command index for selection
  let globalCommandIndex = 0;

  return (
    <Modal
      title="Commands"
      onClose={closeCommandMenu}
      size="medium"
      scrollable={false}
    >
      <box style={{ flexDirection: "column", gap: 1 }}>
        {commandGroups.map((group, groupIndex) => (
          <box key={group.id} style={{ flexDirection: "column" }}>
            {/* Group header */}
            {group.title && (
              <text
                fg={theme.foregroundMuted}
                style={{ marginTop: groupIndex > 0 ? 1 : 0 }}
              >
                {group.title}
              </text>
            )}

            {/* Group commands */}
            {group.commands.map((command) => {
              const commandIndex = globalCommandIndex++;
              const isSelected = commandIndex === selectedIndex;
              const isDisabled = command.disabled;

              return (
                <box
                  key={command.id}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    backgroundColor: isSelected ? theme.emphasis : undefined,
                    paddingLeft: group.title ? 1 : 0,
                  }}
                >
                  {/* Left side: Shortcut + Label */}
                  <box style={{ flexDirection: "row", gap: 1 }}>
                    <text
                      fg={
                        isDisabled
                          ? theme.foregroundMuted
                          : isSelected
                            ? theme.brand
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
                            ? theme.brand
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
          </box>
        ))}
      </box>
    </Modal>
  );
}
