import type { McpServer } from "@fiberplane/mcp-gateway-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  Edit,
  RefreshCw,
  Server,
  Trash2,
} from "lucide-react";
import { PageLayout } from "../components/layout/page-layout";
import { ServerStatusBadge } from "../components/server-status-badge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { StatusDot } from "../components/ui/status-dot";
import { useApi } from "../contexts/ApiContext";
import { useServerModal } from "../contexts/ServerModalContext";
import { useConfirm } from "../hooks/use-confirm";
import { invalidateServerQueries, queryKeys } from "../lib/query-keys";

export function ServerDetailsPage() {
  const { serverName } = useParams({ from: "/servers/$serverName" });
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { openEditServerModal } = useServerModal();
  const { confirm, ConfirmDialog } = useConfirm();

  // Fetch server configs
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.serverConfigs,
    queryFn: () => api.getServerConfigs(),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.deleteServer(name),
    onSuccess: () => {
      invalidateServerQueries(queryClient);
      navigate({ to: "/servers", search: (prev) => ({ token: prev.token }) });
    },
  });

  // Restart mutation (stdio only)
  const restartMutation = useMutation({
    mutationFn: (name: string) => api.restartStdioServer(name),
    onSuccess: () => {
      invalidateServerQueries(queryClient);
    },
  });

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: "Delete Server",
      description: `Are you sure you want to delete "${serverName}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });

    if (confirmed) {
      await deleteMutation.mutateAsync(serverName);
    }
  };

  const handleRestart = async () => {
    await restartMutation.mutateAsync(serverName);
  };

  const server = data?.servers.find((s) => s.name === serverName);

  if (isLoading) {
    return (
      <PageLayout icon={<Server className="h-4 w-4" />} breadcrumb="Servers">
        <p className="text-center text-muted-foreground py-12">Loading...</p>
      </PageLayout>
    );
  }

  if (error || !server) {
    return (
      <PageLayout icon={<Server className="h-4 w-4" />} breadcrumb="Servers">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/servers" search={(prev) => ({ token: prev.token })}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Servers
            </Link>
          </Button>
        </div>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Server not found</h2>
          <p className="text-muted-foreground">
            The server "{serverName}" could not be found.
          </p>
        </div>
      </PageLayout>
    );
  }

  return (
    <>
      <PageLayout icon={<Server className="h-4 w-4" />} breadcrumb="Servers">
        {/* Header with back button */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/servers" search={(prev) => ({ token: prev.token })}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Servers
            </Link>
          </Button>
        </div>

        {/* Server Overview */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-medium mb-2">{server.name}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{server.type}</Badge>
                <ServerStatusBadge server={server} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => openEditServerModal(server)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              {server.type === "stdio" && (
                <Button
                  variant="outline"
                  onClick={handleRestart}
                  disabled={restartMutation.isPending}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${restartMutation.isPending ? "animate-spin" : ""}`}
                  />
                  {restartMutation.isPending ? "Restarting..." : "Restart"}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>

        {/* Server Details Grid */}
        <div className="grid gap-6">
          {/* Command/URL Section */}
          <ServerCommandSection server={server} />

          {/* Error Details (if any) */}
          <ServerErrorSection
            server={server}
            onRestart={handleRestart}
            isRestarting={restartMutation.isPending}
          />

          {/* Stderr Logs (for stdio servers) */}
          {server.type === "stdio" &&
            server.processState.stderrLogs.length > 0 && (
              <StderrLogsSection server={server} />
            )}

          {/* Health Info (for HTTP servers) */}
          {server.type === "http" && <ServerHealthSection server={server} />}
        </div>
      </PageLayout>
      {ConfirmDialog}
    </>
  );
}

interface ServerCommandSectionProps {
  server: McpServer;
}

function ServerCommandSection({ server }: ServerCommandSectionProps) {
  return (
    <div className="border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">Configuration</h2>
      <div className="space-y-3">
        {server.type === "stdio" ? (
          <>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">
                Command
              </div>
              <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                {server.command}
              </code>
            </div>
            {server.args.length > 0 && (
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Arguments
                </div>
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded block break-all">
                  {server.args.join(" ")}
                </code>
              </div>
            )}
            {server.sessionMode && (
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Session Mode
                </div>
                <Badge variant="outline">{server.sessionMode}</Badge>
              </div>
            )}
          </>
        ) : (
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-1">
              URL
            </div>
            <code className="text-sm font-mono bg-muted px-2 py-1 rounded block break-all">
              {server.url}
            </code>
          </div>
        )}
      </div>
    </div>
  );
}

interface ServerErrorSectionProps {
  server: McpServer;
  onRestart: () => void;
  isRestarting: boolean;
}

function ServerErrorSection({
  server,
  onRestart,
  isRestarting,
}: ServerErrorSectionProps) {
  const isStdio = server.type === "stdio";
  const processState = isStdio ? server.processState : undefined;
  const hasProcessError = processState?.lastError;
  const hasHealthError =
    server.health === "down" && (server.errorMessage || server.errorCode);

  if (!hasProcessError && !hasHealthError) {
    return null;
  }

  return (
    <div className="border border-destructive/20 rounded-lg p-6 bg-destructive/5">
      <div className="flex items-center gap-2 mb-4">
        <StatusDot variant="error" />
        <h2 className="text-lg font-semibold">Error Details</h2>
      </div>

      <div className="space-y-4">
        {/* Stdio Process Error */}
        {hasProcessError && processState?.lastError && (
          <>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Error Message
              </div>
              <p className="text-sm font-mono bg-muted px-3 py-2 rounded">
                {processState.lastError.message}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Exit Code
                </div>
                <Badge variant="destructive">
                  {processState.lastError.code}
                </Badge>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Timestamp
                </div>
                <p className="text-sm">
                  {new Date(processState.lastError.timestamp).toLocaleString()}
                </p>
              </div>
            </div>

            {isStdio && server.sessionMode === "shared" && (
              <div className="pt-2">
                <Button
                  onClick={onRestart}
                  disabled={isRestarting}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isRestarting ? "animate-spin" : ""}`}
                  />
                  {isRestarting ? "Restarting..." : "Restart Process"}
                </Button>
              </div>
            )}
          </>
        )}

        {/* HTTP Health Error */}
        {hasHealthError && !hasProcessError && (
          <>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Error Message
              </div>
              <p className="text-sm font-mono bg-muted px-3 py-2 rounded">
                {server.errorMessage || "Connection failed"}
              </p>
            </div>

            {server.errorCode && (
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Error Code
                </div>
                <Badge variant="destructive">{server.errorCode}</Badge>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface StderrLogsSectionProps {
  server: McpServer & { type: "stdio" };
}

function StderrLogsSection({ server }: StderrLogsSectionProps) {
  return (
    <div className="border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">Standard Error Output</h2>
      <div className="bg-muted rounded p-4 font-mono text-xs space-y-1 max-h-96 overflow-y-auto">
        {server.processState.stderrLogs.map((log, i) => (
          <div
            key={`stderr-${i}`}
            className="text-muted-foreground whitespace-pre-wrap break-all"
          >
            {log}
          </div>
        ))}
      </div>
    </div>
  );
}

interface ServerHealthSectionProps {
  server: McpServer & { type: "http" };
}

function ServerHealthSection({ server }: ServerHealthSectionProps) {
  return (
    <div className="border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">Health Information</h2>
      <div className="grid grid-cols-2 gap-4">
        {server.lastCheckTime && (
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Last Checked
            </div>
            <p className="text-sm">
              {new Date(server.lastCheckTime).toLocaleString()}
            </p>
          </div>
        )}

        {server.lastHealthyTime && (
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Last Healthy
            </div>
            <p className="text-sm">
              {new Date(server.lastHealthyTime).toLocaleString()}
            </p>
          </div>
        )}

        {server.responseTimeMs && (
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Response Time
            </div>
            <p className="text-sm">{server.responseTimeMs}ms</p>
          </div>
        )}
      </div>
    </div>
  );
}
