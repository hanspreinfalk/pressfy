"use client";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import type { CSSProperties, ReactNode } from "react";

const sidebarStyle = {
  "--sidebar-width": "14rem",
  "--sidebar-width-icon": "3rem",
} as CSSProperties;

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider style={sidebarStyle}>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4 md:hidden">
          <SidebarTrigger className="-ml-1" />
        </header>
        <div className="flex min-h-svh flex-1 flex-col md:min-h-screen">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
