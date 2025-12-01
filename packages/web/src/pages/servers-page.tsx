import type { McpServer } from "@fiberplane/mcp-gateway-types";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Pause,
  Plus,
  Server,
} from "lucide-react";
import { PageLayout } from "../components/layout/page-layout";
import { PageHeader } from "../components/page-header";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { useServerModal } from "../contexts/ServerModalContext";
import { useServerConfigs } from "../hooks/use-server-configs";

export function ServersPage() {
  const { openAddServerModal } = useServerModal();
  const { data: serverConfigs, isLoading } = useServerConfigs();

  return (
    <PageLayout icon={<Server className="h-4 w-4" />} breadcrumb="Servers">
      <PageHeader
        title="Your Servers"
        description="Manage your MCP servers and monitor their health"
        actions={
          <Button onClick={() => openAddServerModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Server
          </Button>
        }
      />

      {/* Server Table */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading servers...</p>
        </div>
      ) : !serverConfigs?.servers || serverConfigs.servers.length === 0 ? (
        <EmptyState onAddServer={() => openAddServerModal()} />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Command</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serverConfigs.servers.map((server) => (
                <ServerRow key={server.name} server={server} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageLayout>
  );
}

interface ServerRowProps {
  server: McpServer;
}

function ServerRow({ server }: ServerRowProps) {
  const navigate = useNavigate();

  // Determine health status
  const health = server.health;
  const isHealthy = health === "up";
  const isUnhealthy = health === "down";
  const isStdio = server.type === "stdio";
  const processState = isStdio ? server.processState : undefined;
  const isRunning = processState?.status === "running";
  const isCrashed = processState?.status === "crashed";
  const isStopped = processState?.status === "stopped";

  const handleRowClick = () => {
    navigate({
      to: "/servers/$serverName",
      params: { serverName: server.name },
      search: (prev) => ({ token: prev.token }),
    });
  };

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={handleRowClick}
    >
      <TableCell className="font-medium">{server.name}</TableCell>
      <TableCell>
        <Badge variant="outline">{server.type}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {isHealthy && (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Healthy</span>
            </>
          )}
          {isUnhealthy && (
            <>
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm">Unhealthy</span>
            </>
          )}
          {isCrashed && (
            <>
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm">Crashed</span>
            </>
          )}
          {isStopped && processState?.lastError && (
            <>
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <span className="text-sm">Stopped</span>
            </>
          )}
          {!isHealthy && !isUnhealthy && isStdio && isRunning && (
            <>
              <Activity className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Running</span>
            </>
          )}
          {!isHealthy &&
            !isUnhealthy &&
            isStdio &&
            !isRunning &&
            !isCrashed &&
            !isStopped && (
              <>
                <Pause className="h-4 w-4 text-gray-500" />
                <span className="text-sm">Stopped</span>
              </>
            )}
          {!isHealthy && !isUnhealthy && !isStdio && (
            <>
              <Activity className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Remote</span>
            </>
          )}
        </div>
      </TableCell>
      <TableCell className="max-w-md truncate font-mono text-xs">
        {server.type === "stdio" ? server.command : server.url}
      </TableCell>
    </TableRow>
  );
}

function EmptyState({ onAddServer }: { onAddServer: () => void }) {
  return (
    <div className="border rounded-lg p-12 text-center">
      <div className="mx-auto w-12 h-12 mb-4 rounded-full bg-muted flex items-center justify-center">
        <Activity className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No servers yet</h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        Get started by adding your first MCP server. You can add servers from
        the marketplace or configure custom ones.
      </p>
      <div className="flex gap-3 justify-center">
        <Button onClick={onAddServer}>
          <Plus className="h-4 w-4 mr-2" />
          Add Server
        </Button>
        <Button variant="outline" asChild>
          <Link to="/marketplace" search={(prev) => ({ token: prev.token })}>
            Browse Marketplace
          </Link>
        </Button>
      </div>
    </div>
  );
}
