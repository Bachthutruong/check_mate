
"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { UserNav } from "@/components/dashboard/user-nav";
import { Button } from "@/components/ui/button";
import { CheckSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-4">
        <div className="flex w-full flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider className="bg-background font-body antialiased">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-lg bg-primary text-primary-foreground" asChild>
                <a href="/dashboard">
                  <CheckSquare className="h-5 w-5" />
                </a>
              </Button>
              <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                  <span className="text-lg font-semibold tracking-tight">CheckMate</span>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarNav />
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
              <SidebarTrigger className="sm:hidden" />
              <div className="ml-auto">
                <UserNav />
              </div>
          </header>
          <div className="flex-1 overflow-y-auto p-4 sm:px-6 sm:py-6">
              <div className="flex flex-col gap-4 md:gap-8">
                {children}
              </div>
          </div>
        </SidebarInset>
    </SidebarProvider>
  );
}
