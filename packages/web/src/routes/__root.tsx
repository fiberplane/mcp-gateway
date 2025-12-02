import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { useMemo } from "react";
import { z } from "zod";
import { InvalidTokenState } from "../components/invalid-token-state";
import { AppLayout } from "../components/layout/app-layout";
import { NoTokenState } from "../components/no-token-state";
import { ServerModalManager } from "../components/ServerModalManager";
import { TooltipProvider } from "../components/ui/tooltip";
import { ApiProvider } from "../contexts/ApiContext";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { createApiClient } from "../lib/api";
import { createQueryClient } from "../lib/query-client";

// Search params schema - token is preserved across all routes
// Use passthrough to allow other query params (server, search, client, method, session, etc.)
const searchSchema = z
  .object({
    token: z.string().optional(),
  })
  .passthrough();

/**
 * Inner component that provides API + QueryClient contexts
 * Must be wrapped in AuthProvider to access auth state
 */
function RootWithProviders() {
  const { token, hasAuthError, setHasAuthError } = useAuth();

  // Create API client with token provider
  const api = useMemo(() => createApiClient(() => token), [token]);

  // Create QueryClient with global error handler
  const queryClient = useMemo(
    () => createQueryClient(() => setHasAuthError(true)),
    [setHasAuthError],
  );

  // Show error state if auth failed
  if (hasAuthError) {
    return <InvalidTokenState />;
  }

  // Show no-token state if token is missing
  if (!token) {
    return <NoTokenState />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <TooltipProvider>
          <ServerModalManager>
            <AppLayout />
          </ServerModalManager>
        </TooltipProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

export const Route = createRootRoute({
  validateSearch: searchSchema,
  component: () => (
    <AuthProvider>
      <RootWithProviders />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </AuthProvider>
  ),
});
