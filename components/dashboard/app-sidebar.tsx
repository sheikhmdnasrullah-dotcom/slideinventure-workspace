"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  Cable,
  FileText,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  Send,
  Settings,
  Sparkles,
  Target,
  Terminal,
  Users,
} from "lucide-react";
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
import { NavUser } from "@/components/dashboard/nav-user";
import { commandMenuStore } from "@/lib/command-menu-store";
import { cn } from "@/lib/utils";

/**
 * Active state: segment-match, not exact-match.
 *   /knowledge/x          keeps "Knowledge" active
 *   /prospects/y          keeps "Prospects" active
 * The audit flagged the previous `pathname === url` check as breaking on
 * detail pages; this segment comparison fixes it in one place.
 */
function useIsActive() {
  const pathname = usePathname();
  return (url: string) => {
    if (url === "/") return pathname === "/";
    const seg = url.split("/")[1] ?? "";
    const pathSeg = pathname.split("/")[1] ?? "";
    return seg !== "" && seg === pathSeg;
  };
}

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  external?: boolean;
};

type NavGroup = { label: string; items: NavItem[] };

/**
 * The IA from AUDIT.md §PROPOSED INFORMATION ARCHITECTURE: four groups, ≤10
 * leaves. Routes that don't exist yet are still listed so the structure is
 * discoverable — they render a "coming soon" page (existing pattern) until
 * their data layer lands. The grouping replaces the earlier Overview /
 * Operations / Workspace split with labels that answer the brief's six
 * questions (what's happening / what do we know / what changed / what did AI
 * discover / what needs attention / what next).
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Command",
    items: [
      { title: "Command Center", url: "/", icon: LayoutDashboard },
      { title: "Activity", url: "/activity", icon: Activity },
    ],
  },
  {
    label: "Work",
    items: [
      { title: "Knowledge", url: "/knowledge", icon: BookOpen },
      { title: "Prospects", url: "/prospects", icon: Target },
      { title: "Outreach", url: "/cold-outreach", icon: Send },
      { title: "Leads", url: "/leads", icon: Users },
      { title: "Documents", url: "/documents", icon: FileText },
      { title: "Strategy", url: "/strategy", icon: Sparkles },
    ],
  },
{
        label: "Intelligence",
        items: [
          { title: "Research", url: "/research", icon: BookOpen },
          { title: "Insights", url: "/insights", icon: Lightbulb },
          { title: "Agents", url: "/agents", icon: Terminal },
          { title: "Chat", url: "/chat", icon: MessageSquare },
        ],
      },
  {
    label: "System",
    items: [
      { title: "Integrations", url: "/automations", icon: Cable },
      {
        title: "Admin",
        url: "https://admin.tanim.tech",
        icon: Settings,
        external: true,
      },
    ],
  },
];

export function AppSidebar({
  userEmail,
  ...props
}: React.ComponentProps<typeof Sidebar> & { userEmail: string }) {
  const isActive = useIsActive();
  // Opening the ⌘K menu is a fire-and-forget action on the store, not state
  // the sidebar needs to subscribe to — so call the store method directly
  // rather than reading a snapshot through useCommandMenu.
  const openCommand = commandMenuStore.open;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-brand font-mono text-xs font-semibold text-white">
                SV
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">SlideIn Venture</span>
                <span className="truncate text-xs text-ink-muted">Ops console</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* ⌘K trigger sits inside the rail so it is reachable from both the
            expanded and icon-collapsed states. The widget FAB it replaces
            floated over content; this is part of the chrome instead. */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="sm"
                  onClick={() => openCommand()}
                  tooltip="Command menu  ⌘K"
                >
                  <Sparkles className="size-4 text-flame" />
                  <span className="flex-1 text-left">Ask · Search · Run</span>
                  <kbd className="hidden h-5 items-center rounded-xs border border-rule bg-[var(--surface-2)] px-1 font-mono text-[10px] text-ink-faint group-data-[state=collapsed]:inline-flex xl:inline-flex">
                    ⌘K
                  </kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={isActive(item.url)}
                      className={cn(
                        "data-[active]:bg-[var(--accent-wash)] data-[active]:text-[var(--text-accent)]"
                      )}
                      render={
                        item.external ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${item.title} (opens in a new tab)`}
                          />
                        ) : (
                          <Link href={item.url} />
                        )
                      }
                    >
                      <item.icon className={cn(isActive(item.url) && "text-flame")} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser userEmail={userEmail} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
