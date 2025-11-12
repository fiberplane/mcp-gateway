/**
 * Test wrapper providers for React components
 */

import type { ReactNode } from "react";
import { ApiProvider } from "../contexts/ApiContext";
import { createMockApiClient } from "./mocks";

/**
 * Wrapper that provides ApiContext for testing
 * Use this when testing components that use hooks depending on useApi()
 */
export function TestApiProvider({ children }: { children: ReactNode }) {
  const mockApi = createMockApiClient();
  return <ApiProvider value={mockApi}>{children}</ApiProvider>;
}
