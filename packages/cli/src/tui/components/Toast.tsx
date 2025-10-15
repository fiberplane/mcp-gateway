import { useEffect } from "react";
import { useAppStore } from "../store";
import { useTheme } from "../theme-context";

export function Toast() {
  const theme = useTheme();
  const toast = useAppStore((state) => state.toast);
  const clearToast = useAppStore((state) => state.clearToast);

  // Auto-dismiss after 2 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        clearToast();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [toast, clearToast]);

  if (!toast) return null;

  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return "✓";
      case "error":
        return "✗";
      case "info":
        return "ℹ";
      default:
        return "";
    }
  };

  const getColor = () => {
    switch (toast.type) {
      case "success":
        return theme.success;
      case "error":
        return theme.danger;
      case "info":
        return theme.accent;
      default:
        return theme.foreground;
    }
  };

  return (
    <box
      style={{
        position: "absolute",
        top: 2,
        right: 2,
        padding: 1,
        border: true,
        borderColor: getColor(),
        backgroundColor: theme.emphasis,
        minWidth: 30,
      }}
    >
      <box style={{ flexDirection: "row", gap: 1 }}>
        <text fg={getColor()}>{getIcon()}</text>
        <text fg={theme.foreground}>{toast.message}</text>
      </box>
    </box>
  );
}
