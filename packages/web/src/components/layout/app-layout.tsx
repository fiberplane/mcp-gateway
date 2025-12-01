import { Outlet } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "../ui/sidebar";
import { AppSidebar } from "./app-sidebar";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col min-w-0 bg-background">
          <Outlet />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
