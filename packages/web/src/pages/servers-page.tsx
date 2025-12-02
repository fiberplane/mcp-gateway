import type { McpServer } from "@fiberplane/mcp-gateway-types";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Server } from "lucide-react";
import { EmptyStateNoServers } from "../components/empty-state-no-servers";
import { PageLayout } from "../components/layout/page-layout";
import { PageHeader } from "../components/page-header";
import { ServerStatusBadge } from "../components/server-status-badge";
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
        <EmptyStateNoServers />
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
        <ServerStatusBadge server={server} />
      </TableCell>
      <TableCell className="max-w-md truncate font-mono text-xs">
        {server.type === "stdio"
          ? `${server.command} ${server.args.join(" ")}`.trim()
          : server.url}
      </TableCell>
    </TableRow>
  );
}
