"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseIcon, UsersRoundIcon } from "lucide-react";

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
  SidebarRail,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { DashboardUserButton } from "./dashboard-user-button";

const navGroups = [
  {
    label: "Dashboard",
    items: [
      { title: "Clients", icon: UsersRoundIcon, href: "/clients" },
      { title: "Workflows", icon: BriefcaseIcon, href: "/workflows" },
    ],
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const activeClass =
    "bg-black! text-white! font-medium! dark:bg-white! dark:text-black!";

  return (
    <Sidebar
      collapsible="icon"
      className="group border-r border-sidebar-border"
      {...props}
    >
      <SidebarHeader className="pt-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href="/dashboard" className="flex items-center gap-2">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-[#fd5200]">
                  <span className="text-[10px] font-black text-white leading-none">P</span>
                </div>
                <span className="font-bold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                  Pressfy
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-2">
            <SidebarGroupLabel className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={isActive(item.href)}
                      className={cn(
                        "text-sm text-sidebar-foreground/80 transition-colors",
                        isActive(item.href) && activeClass,
                      )}
                    >
                      <Link href={item.href}>
                        <item.icon className="size-4 shrink-0" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DashboardUserButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
