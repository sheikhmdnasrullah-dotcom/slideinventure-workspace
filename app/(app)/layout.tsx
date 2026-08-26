import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandMenu } from "@/components/system/command-menu";
import { PageTransition } from "@/components/system/motion";
import { requireUser } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <TooltipProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 64)",
            "--header-height": "calc(var(--spacing) * 12 + 1px)",
          } as React.CSSProperties
        }
      >
        <AppSidebar userEmail={user.email ?? "unknown"} />
        <SidebarInset>
          <PageTransition>{children}</PageTransition>
        </SidebarInset>
        <Toaster />
        <CommandMenu />
      </SidebarProvider>
    </TooltipProvider>
  );
}
