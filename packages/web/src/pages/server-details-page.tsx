import type { McpServer } from "@fiberplane/mcp-gateway-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  AlertCircle,
  Check,
  Copy,
  Edit,
  RefreshCw,
  Server,
  Trash2,
} from "lucide-react";
import { PageLayout } from "../components/layout/page-layout";
import { ServerStatusBadge } from "../components/server-status-badge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

import { useApi } from "../contexts/ApiContext";
import { useServerModal } from "../contexts/ServerModalContext";
import { useConfirm } from "../hooks/use-confirm";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
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
      navigate({ to: "/servers", search: (prev) => ({ ...prev }) });
    },
  });

  // Restart mutation (stdio only)
  const restartMutation = useMutation({
    mutationFn: (name: string) => api.restartStdioServer(name),
    onSuccess: () => {
      invalidateServerQueries(queryClient);
    },
  });

  // Health check mutation (http only)
  const healthCheckMutation = useMutation({
    mutationFn: (name: string) => api.checkServerHealth(name),
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
        {/* Server Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-medium">{server.name}</h1>
          <Link
            to="/"
            search={(prev) => ({ ...prev, server: server.name })}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            MCP Traffic
          </Link>
        </div>

        {/* Server Details Grid */}
        <div className="grid gap-6">
          {/* Health Info (for HTTP servers) */}
          {server.type === "http" && (
            <ServerHealthSection
              server={server}
              onCheckHealth={() => healthCheckMutation.mutate(server.name)}
              isCheckingHealth={healthCheckMutation.isPending}
            />
          )}

          {/* Process Status (for stdio servers) - combined status, errors, stderr */}
          {server.type === "stdio" && (
            <ProcessStatusSection
              server={server}
              onRestart={handleRestart}
              isRestarting={restartMutation.isPending}
            />
          )}

          {/* Gateway URL - how to connect MCP clients */}
          <GatewayUrlSection serverName={server.name} />

          {/* Configuration Section */}
          <ServerCommandSection
            server={server}
            onEdit={() => openEditServerModal(server)}
          />

          {/* Danger Zone */}
          <DangerZoneSection
            onDelete={handleDelete}
            isDeleting={deleteMutation.isPending}
          />
        </div>
      </PageLayout>
      {ConfirmDialog}
    </>
  );
}

interface GatewayUrlSectionProps {
  serverName: string;
}

function GatewayUrlSection({ serverName }: GatewayUrlSectionProps) {
  const { copy, copied } = useCopyToClipboard();
  const gatewayUrl = `${window.location.origin}/s/${serverName}/mcp`;

  return (
    <div className="border rounded-lg p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Gateway URL</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Use this URL in your MCP client to route traffic through the gateway
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-sm font-mono bg-muted px-3 py-2 rounded break-all">
          {gatewayUrl}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={() => copy(gatewayUrl)}
          className="shrink-0"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-1" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

interface ServerCommandSectionProps {
  server: McpServer;
  onEdit: () => void;
}

function ServerCommandSection({ server, onEdit }: ServerCommandSectionProps) {
  return (
    <div className="border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Configuration</h2>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>
      <div className="space-y-3">
        <div>
          <div className="text-sm font-medium text-muted-foreground mb-1">
            Type
          </div>
          <Badge variant="outline">{server.type}</Badge>
        </div>
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

interface ProcessStatusSectionProps {
  server: McpServer & { type: "stdio" };
  onRestart: () => void;
  isRestarting: boolean;
}

function ProcessStatusSection({
  server,
  onRestart,
  isRestarting,
}: ProcessStatusSectionProps) {
  const { processState } = server;
  const hasError = processState.lastError;
  const hasStderrLogs = processState.stderrLogs.length > 0;

  // Create stable keys by combining index with content hash
  // This is safe because stderr logs are append-only and never reorder
  const logsWithKeys = processState.stderrLogs.map((log, i) => ({
    key: `stderr-${i}-${log.slice(0, 20)}`,
    log,
  }));

  return (
    <div
      className={`border rounded-lg p-6 ${hasError ? "border-destructive/20" : ""}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Process Status</h2>
          <ServerStatusBadge server={server} />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRestart}
          disabled={isRestarting}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isRestarting ? "animate-spin" : ""}`}
          />
          {isRestarting ? "Restarting..." : "Restart Process"}
        </Button>
      </div>

      <div className="space-y-4">
        {/* Error Details */}
        {hasError && processState.lastError && (
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
          </>
        )}

        {/* Stderr Logs */}
        {hasStderrLogs && (
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">
              Standard Error Output
            </div>
            <div className="bg-muted rounded p-4 font-mono text-xs space-y-1 max-h-96 overflow-y-auto">
              {logsWithKeys.map(({ key, log }) => (
                <div
                  key={key}
                  className="text-muted-foreground whitespace-pre-wrap break-all"
                >
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Show message when no errors and no stderr */}
        {!hasError && !hasStderrLogs && (
          <p className="text-sm text-muted-foreground">
            Process is running normally with no errors.
          </p>
        )}
      </div>
    </div>
  );
}

interface DangerZoneSectionProps {
  onDelete: () => void;
  isDeleting: boolean;
}

function DangerZoneSection({ onDelete, isDeleting }: DangerZoneSectionProps) {
  return (
    <div className="border border-destructive/20 rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4 text-destructive">
        Danger Zone
      </h2>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Delete this server</p>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone.
          </p>
        </div>
        <Button variant="destructive" onClick={onDelete} disabled={isDeleting}>
          <Trash2 className="h-4 w-4 mr-2" />
          {isDeleting ? "Deleting..." : "Delete Server"}
        </Button>
      </div>
    </div>
  );
}

interface ServerHealthSectionProps {
  server: McpServer & { type: "http" };
  onCheckHealth: () => void;
  isCheckingHealth: boolean;
}

function ServerHealthSection({
  server,
  onCheckHealth,
  isCheckingHealth,
}: ServerHealthSectionProps) {
  return (
    <div className="border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Health Information</h2>
          <ServerStatusBadge server={server} />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onCheckHealth}
          disabled={isCheckingHealth}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isCheckingHealth ? "animate-spin" : ""}`}
          />
          {isCheckingHealth ? "Checking..." : "Check Health"}
        </Button>
      </div>
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
