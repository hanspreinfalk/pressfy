"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon } from "lucide-react";

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
      { title: "Home", icon: HomeIcon, href: "/dashboard" },
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
    "bg-[#fd5200]! text-white! font-bold! dark:bg-[#fd5200]! dark:text-white!";

  return (
    <Sidebar
      collapsible="icon"
      className="group border-r-2 border-black"
      {...props}
    >
      <SidebarHeader className="border-b-2 border-black bg-black pt-3 text-white">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href="/dashboard" className="flex items-center gap-2">
                <div className="flex size-5 shrink-0 items-center justify-center bg-[#fd5200]">
                  <span className="text-[10px] font-black text-white leading-none">P</span>
                </div>
                <span className="font-bold uppercase tracking-[0.18em] text-white group-data-[collapsible=icon]:hidden">
                  Pressfy
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0 bg-[#F5F0E8] py-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-2">
            <SidebarGroupLabel className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-black/50">
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
                        "rounded-none text-sm font-bold uppercase tracking-[0.14em] text-black transition-colors hover:bg-black hover:text-white",
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

      <SidebarFooter className="border-t-2 border-black bg-black py-3 text-white">
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
