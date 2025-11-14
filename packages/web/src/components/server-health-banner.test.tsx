/// <reference lib="dom" />

/**
 * Tests for ServerHealthBanner component
 */

import { afterEach, describe, expect, test, vi } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { McpServer } from "@fiberplane/mcp-gateway-types";
import type React from "react";
import { TestApiProvider } from "../test-utils/test-providers";
import { ServerHealthBanner } from "./server-health-banner";

// Mock useTimeAgo hook
vi.mock("../hooks/use-time-ago", () => ({
  useTimeAgo: (timestamp?: number) => {
    if (!timestamp) return "";
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(seconds / 3600);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(seconds / 86400);
    return `${days}d ago`;
  },
}));

// Mock useServerModal hook
vi.mock("../contexts/ServerModalContext", () => ({
  useServerModal: () => ({
    openEditServerModal: vi.fn(),
    openAddServerModal: vi.fn(),
    isModalOpen: false,
    modalState: null,
  }),
}));

describe("ServerHealthBanner", () => {
  afterEach(() => {
    cleanup();
  });

  const createOfflineServer = (overrides?: Partial<McpServer>): McpServer => ({
    name: "test-server",
    url: "http://localhost:3000",
    type: "http",
    headers: {},
    health: "down",
    lastHealthCheck: new Date().toISOString(),
    lastCheckTime: Date.now() - 30000, // 30 seconds ago
    lastErrorTime: Date.now() - 30000,
    errorCode: "ECONNREFUSED",
    errorMessage: "Connection refused",
    ...overrides,
  });

  // Helper to render with ApiProvider
  const renderWithProvider = (component: React.ReactElement) =>
    render(<TestApiProvider>{component}</TestApiProvider>);

  test("does not render when server is online", () => {
    const server: McpServer = {
      ...createOfflineServer(),
      health: "up",
    };

    const { container } = renderWithProvider(
      <ServerHealthBanner
        server={server}
        onRetry={() => {}}
        isRetrying={false}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  test("renders banner when server is offline", () => {
    const server = createOfflineServer();

    renderWithProvider(
      <ServerHealthBanner
        server={server}
        onRetry={() => {}}
        isRetrying={false}
      />,
    );

    expect(
      screen.getByText('Server "test-server" has never responded'),
    ).toBeInTheDocument();
  });

  test("displays error message for ECONNREFUSED", () => {
    const server = createOfflineServer({
      errorCode: "ECONNREFUSED",
      errorMessage: "Connection refused",
    });

    renderWithProvider(
      <ServerHealthBanner
        server={server}
        onRetry={() => {}}
        isRetrying={false}
      />,
    );

    expect(screen.getByText("Connection refused")).toBeInTheDocument();
  });

  test("displays error message for TIMEOUT", () => {
    const server = createOfflineServer({
      errorCode: "TIMEOUT",
      errorMessage: "Request timed out",
    });

    renderWithProvider(
      <ServerHealthBanner
        server={server}
        onRetry={() => {}}
        isRetrying={false}
      />,
    );

    expect(screen.getByText("Request timed out")).toBeInTheDocument();
  });

  test("displays error message for HTTP_ERROR", () => {
    const server = createOfflineServer({
      errorCode: "HTTP_ERROR",
      errorMessage: "HTTP 500: Internal Server Error",
    });

    renderWithProvider(
      <ServerHealthBanner
        server={server}
        onRetry={() => {}}
        isRetrying={false}
      />,
    );

    expect(screen.getByText("Server error")).toBeInTheDocument();
  });

  test("displays last checked time", () => {
    const server = createOfflineServer({
      lastCheckTime: Date.now() - 30000, // 30 seconds ago
    });

    renderWithProvider(
      <ServerHealthBanner
        server={server}
        onRetry={() => {}}
        isRetrying={false}
      />,
    );

    expect(screen.getByText(/Last checked:/)).toBeInTheDocument();
    expect(screen.getByText(/30s ago/)).toBeInTheDocument();
  });

  test("displays last online time when available", () => {
    const server = createOfflineServer({
      lastHealthyTime: Date.now() - 120000, // 2 minutes ago
    });

    renderWithProvider(
      <ServerHealthBanner
        server={server}
        onRetry={() => {}}
        isRetrying={false}
      />,
    );

    expect(screen.getByText(/Was online:/)).toBeInTheDocument();
    expect(screen.getByText(/2m ago/)).toBeInTheDocument();
  });

  test("does not display was online time when not available", () => {
    const server = createOfflineServer({
      lastHealthyTime: undefined,
    });

    renderWithProvider(
      <ServerHealthBanner
        server={server}
        onRetry={() => {}}
        isRetrying={false}
      />,
    );

    expect(screen.queryByText(/Was online:/)).not.toBeInTheDocument();
  });

  test("calls onRetry when health check button is clicked", () => {
    const onRetry = vi.fn();
    const server = createOfflineServer();

    renderWithProvider(
      <ServerHealthBanner
        server={server}
        onRetry={onRetry}
        isRetrying={false}
      />,
    );

    const retryButton = screen.getByRole("button", { name: /Check Health/i });
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("disables retry button when isRetrying is true", () => {
    const server = createOfflineServer();

    renderWithProvider(
      <ServerHealthBanner
        server={server}
        onRetry={() => {}}
        isRetrying={true}
      />,
    );

    const retryButton = screen.getByRole("button", { name: /Checking/i });
    expect(retryButton).toBeDisabled();
  });

  test("shows 'Checking...' text when isRetrying is true", () => {
    const server = createOfflineServer();

    renderWithProvider(
      <ServerHealthBanner
        server={server}
        onRetry={() => {}}
        isRetrying={true}
      />,
    );

    expect(screen.getByText("Checking...")).toBeInTheDocument();
  });

  test("shows 'Check Health' text when not retrying", () => {
    const server = createOfflineServer();

    renderWithProvider(
      <ServerHealthBanner
        server={server}
        onRetry={() => {}}
        isRetrying={false}
      />,
    );

    expect(screen.getByText("Check Health")).toBeInTheDocument();
  });

  test("renders edit button", () => {
    const server = createOfflineServer();

    renderWithProvider(
      <ServerHealthBanner
        server={server}
        onRetry={() => {}}
        isRetrying={false}
      />,
    );

    expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
  });

  test("handles unknown error code gracefully", () => {
    const server = createOfflineServer({
      errorCode: undefined,
      errorMessage: "Some custom error",
    });

    renderWithProvider(
      <ServerHealthBanner
        server={server}
        onRetry={() => {}}
        isRetrying={false}
      />,
    );

    expect(screen.getByText("Some custom error")).toBeInTheDocument();
  });

  test("shows 'Unknown error' when no error message or code", () => {
    const server = createOfflineServer({
      errorCode: undefined,
      errorMessage: undefined,
    });

    renderWithProvider(
      <ServerHealthBanner
        server={server}
        onRetry={() => {}}
        isRetrying={false}
      />,
    );

    expect(screen.getByText("Unknown error")).toBeInTheDocument();
  });
});
