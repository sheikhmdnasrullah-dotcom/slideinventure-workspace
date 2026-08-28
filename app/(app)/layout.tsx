import { CopilotKit } from "@copilotkit/react-core";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandMenu } from "@/components/system/command-menu";
import { PageTransition } from "@/components/system/motion";
import { DashboardPreferencesProvider } from "@/components/dashboard/preferences/preferences-provider";
import { getDashboardPreferencesForUser } from "@/lib/dashboard/preferences.server";
import { requireUser } from "@/lib/supabase/server";
import { SmoothScroll } from "@/components/providers/smooth-scroll";
import { EventStreamProvider } from "@/components/providers/event-stream";
import { QueryProvider } from "@/components/providers/query-provider";
import { AgentCopilot } from "@/components/copilot/agent-copilot";

export default async function AppLayout({
  children,
}: LayoutProps<"/">) {
  const user = await requireUser();
  const preferences = await getDashboardPreferencesForUser(user.email);

  return (
    <NuqsAdapter>
      <QueryProvider>
        <CopilotKit runtimeUrl="/api/copilot">
          <TooltipProvider>
            <DashboardPreferencesProvider
              userEmail={user.email ?? "unknown"}
              initialPreferences={preferences}
            >
              <EventStreamProvider>
                <SmoothScroll>
                  <SidebarProvider
                    style={
                      {
                        "--sidebar-width": "calc(var(--spacing) * 64)",
                        "--header-height": "calc(var(--spacing) * 12 + 1px)",
                      } as React.CSSProperties
                    }
                  >
                    {/*
                      Persistent shell. Everything below stays mounted across
                      section switches; only `children` inside PageTransition
                      swaps, so the sidebar never re-renders or reflows.
                    */}
                    <AppSidebar userEmail={user.email ?? "unknown"} />
                    <SidebarInset>
                      <PageTransition>{children}</PageTransition>
                    </SidebarInset>
                    <Toaster />
                    <CommandMenu />
                    <AgentCopilot />
                  </SidebarProvider>
                </SmoothScroll>
              </EventStreamProvider>
            </DashboardPreferencesProvider>
          </TooltipProvider>
        </CopilotKit>
      </QueryProvider>
    </NuqsAdapter>
  );
}
