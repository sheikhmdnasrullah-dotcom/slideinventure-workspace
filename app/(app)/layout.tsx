import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandMenu } from "@/components/system/command-menu";
import { requireUser } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar userEmail={user.email ?? "unknown"} />
        {children}
        <Toaster />
        {/* ⌘K global surface. Replaces the floating KnowledgeChatWidget FAB —
            one command surface for navigation, search, ask, and actions,
            reachable from the sidebar trigger, the header, or ⌘K anywhere. */}
        <CommandMenu />
      </SidebarProvider>
    </TooltipProvider>
  );
}
