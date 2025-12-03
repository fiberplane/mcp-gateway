import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Home,
  MessageCircle,
  MessageSquare,
  Server,
  Store,
} from "lucide-react";
import { FiberplaneLogo } from "../fiberplane-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";

const workspaceNavItems = [
  { title: "Logs", icon: Home, to: "/" },
  { title: "Popular MCP Servers", icon: Store, to: "/marketplace" },
  { title: "Manage Servers", icon: Server, to: "/servers" },
] as const;

const footerLinks = [
  {
    title: "Changelog",
    icon: BookOpen,
    href: "https://github.com/fiberplane/mcp-gateway/releases",
  },
  {
    title: "Give feedback",
    icon: MessageSquare,
    href: "https://github.com/fiberplane/mcp-gateway/issues/new",
  },
  {
    title: "Join us on Discord",
    icon: MessageCircle,
    href: "https://discord.com/invite/cqdY6SpfVR",
  },
] as const;

export function AppSidebar() {
  const router = useRouterState();
  const currentPath = router.location.pathname;

  return (
    <Sidebar collapsible="icon">
      {/* Header */}
      <SidebarHeader className="px-3 pt-6 pb-2 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <FiberplaneLogo className="h-6 w-6 shrink-0" />
          <span className="text-lg font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            Fiberplane
          </span>
        </div>
      </SidebarHeader>

      {/* Main navigation */}
      <SidebarContent className="px-3 group-data-[collapsible=icon]:px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-0 text-xs font-medium text-muted-foreground">
            MCP Gateway
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceNavItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  currentPath === item.to ||
                  currentPath.startsWith(`${item.to}/`);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link to={item.to} search={(prev) => ({ ...prev })}>
                        <Icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer links */}
      <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2">
        <div className="flex flex-col gap-1">
          {footerLinks.map((link) => {
            const Icon = link.icon;
            return (
              <SidebarMenuButton
                key={link.href}
                asChild
                tooltip={link.title}
                className="h-auto py-1"
              >
                <a href={link.href} target="_blank" rel="noopener noreferrer">
                  <Icon className="w-4 h-4" />
                  <span>{link.title}</span>
                </a>
              </SidebarMenuButton>
            );
          })}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
