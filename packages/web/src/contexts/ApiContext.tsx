/**
 * API Context for dependency injection
 *
 * Provides API client instance throughout the component tree without prop drilling.
 * Components access the client via useApi() hook.
 */

import { createContext, useContext } from "react";
import type { IApiClient } from "../lib/api";

/**
 * Context holding the API client instance
 */
const ApiContext = createContext<IApiClient | null>(null);

/**
 * Provider component that supplies API client to the component tree
 *
 * @example
 * ```tsx
 * const api = createApiClient(() => token);
 *
 * <ApiProvider value={api}>
 *   <App />
 * </ApiProvider>
 * ```
 */
export const ApiProvider = ApiContext.Provider;

/**
 * Hook to access the API client from context
 *
 * @throws Error if used outside ApiProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const api = useApi();
 *   const { data } = useQuery({
 *     queryKey: ['servers'],
 *     queryFn: () => api.getServers()
 *   });
 * }
 * ```
 */
export function useApi(): IApiClient {
  const context = useContext(ApiContext);

  if (!context) {
    throw new Error("useApi must be used within an ApiProvider");
  }

  return context;
}
