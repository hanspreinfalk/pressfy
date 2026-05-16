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
      <SidebarInset className="bg-[#F5F0E8]">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b-2 border-black bg-black px-4 text-white md:hidden">
          <SidebarTrigger className="-ml-1 rounded-none text-white hover:bg-white/10 hover:text-white" />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">
            Pressfy
          </span>
        </header>
        <div className="flex min-h-svh flex-1 flex-col md:min-h-screen">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
