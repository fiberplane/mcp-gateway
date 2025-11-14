import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../contexts/ApiContext";

/**
 * Hook to manually trigger a server health check
 *
 * Invalidates the server-configs query on success to refresh server list.
 *
 * @example
 * ```tsx
 * const { mutate: checkHealth, isPending } = useHealthCheck();
 *
 * <button onClick={() => checkHealth(serverName)} disabled={isPending}>
 *   {isPending ? "Checking..." : "Retry"}
 * </button>
 * ```
 */
export function useHealthCheck() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serverName: string) => api.checkServerHealth(serverName),
    onSuccess: () => {
      // Invalidate queries to refresh server list
      queryClient.invalidateQueries({ queryKey: ["server-configs"] });
      queryClient.invalidateQueries({ queryKey: ["servers"] });
    },
  });
}
