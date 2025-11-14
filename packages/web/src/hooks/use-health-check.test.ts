import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { ApiProvider } from "../contexts/ApiContext";
import { createMockApiClient } from "../test-utils/mocks";
import { useHealthCheck } from "./use-health-check";

describe("useHealthCheck", () => {
  let queryClient: QueryClient;
  let mockApi: ReturnType<typeof createMockApiClient>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockApi = createMockApiClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApiProvider, { value: mockApi }, children),
    );

  test("should trigger health check for server", async () => {
    mockApi.checkServerHealth.mockResolvedValue({
      server: {
        name: "test-server",
        url: "http://localhost:3000",
        type: "http",
        headers: {},
        health: "up",
      },
    });

    const { result } = renderHook(() => useHealthCheck(), { wrapper });

    result.current.mutate("test-server");

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApi.checkServerHealth).toHaveBeenCalledWith("test-server");
    expect(mockApi.checkServerHealth).toHaveBeenCalledTimes(1);
  });

  test("should invalidate server-configs query on success", async () => {
    mockApi.checkServerHealth.mockResolvedValue({
      server: {
        name: "test-server",
        url: "http://localhost:3000",
        type: "http",
        headers: {},
        health: "up",
      },
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useHealthCheck(), { wrapper });

    result.current.mutate("test-server");

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["server-configs"],
    });
  });

  test("should invalidate servers query on success", async () => {
    mockApi.checkServerHealth.mockResolvedValue({
      server: {
        name: "test-server",
        url: "http://localhost:3000",
        type: "http",
        headers: {},
        health: "up",
      },
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useHealthCheck(), { wrapper });

    result.current.mutate("test-server");

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["servers"],
    });
  });

  test("should handle health check errors", async () => {
    const mockError = new Error("Server not found");
    mockApi.checkServerHealth.mockRejectedValue(mockError);

    const { result } = renderHook(() => useHealthCheck(), { wrapper });

    result.current.mutate("non-existent-server");

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(mockError);
  });

  test("should track isPending state correctly", async () => {
    mockApi.checkServerHealth.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                server: {
                  name: "test-server",
                  url: "http://localhost:3000",
                  type: "http",
                  headers: {},
                  health: "up",
                },
              }),
            100,
          ),
        ),
    );

    const { result } = renderHook(() => useHealthCheck(), { wrapper });

    expect(result.current.isPending).toBe(false);

    result.current.mutate("test-server");

    // Wait for isPending to become true
    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    // Wait for mutation to complete
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.isPending).toBe(false);
  });

  test("should not invalidate queries on error", async () => {
    mockApi.checkServerHealth.mockRejectedValue(new Error("Connection failed"));

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useHealthCheck(), { wrapper });

    result.current.mutate("test-server");

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Should not have been called since mutation failed
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });

  test("should handle multiple consecutive health checks", async () => {
    mockApi.checkServerHealth.mockResolvedValue({
      server: {
        name: "test-server",
        url: "http://localhost:3000",
        type: "http",
        headers: {},
        health: "up",
      },
    });

    const { result } = renderHook(() => useHealthCheck(), { wrapper });

    // First check
    result.current.mutate("server-1");
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Second check
    result.current.mutate("server-2");
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApi.checkServerHealth).toHaveBeenCalledTimes(2);
    expect(mockApi.checkServerHealth).toHaveBeenNthCalledWith(1, "server-1");
    expect(mockApi.checkServerHealth).toHaveBeenNthCalledWith(2, "server-2");
  });
});
