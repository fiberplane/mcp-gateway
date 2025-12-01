import type { McpServerConfig } from "@fiberplane/mcp-gateway-types";
import { createContext, useContext } from "react";

interface ServerModalContextValue {
  openAddServerModal: (initialData?: Partial<McpServerConfig>) => void;
  openEditServerModal: (server: McpServerConfig) => void;
}

export const ServerModalContext = createContext<
  ServerModalContextValue | undefined
>(undefined);

export function useServerModal() {
  const context = useContext(ServerModalContext);
  if (!context) {
    throw new Error("useServerModal must be used within ServerModalProvider");
  }
  return context;
}
