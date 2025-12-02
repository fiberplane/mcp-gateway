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
import { NavBarItem } from "../ui/nav-bar-item";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "../ui/sidebar";

const workspaceNavItems = [
  { title: "Home", icon: Home, to: "/" },
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
    <Sidebar className="w-[260px]" collapsible="none">
      {/* Header */}
      <SidebarHeader className="px-5 pt-6 pb-2">
        <div className="flex items-center gap-2">
          <FiberplaneLogo className="h-6 w-6" />
          <span className="text-lg font-semibold text-sidebar-foreground">
            Fiberplane
          </span>
        </div>
      </SidebarHeader>

      {/* Main navigation */}
      <SidebarContent className="px-5">
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
                    <NavBarItem asChild isActive={isActive}>
                      <Link
                        to={item.to}
                        search={(prev) => ({ token: prev.token })}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </NavBarItem>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer links */}
      <SidebarFooter className="p-5">
        <div className="flex flex-col gap-1">
          {footerLinks.map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                <Icon className="w-4 h-4" />
                <span>{link.title}</span>
              </a>
            );
          })}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
