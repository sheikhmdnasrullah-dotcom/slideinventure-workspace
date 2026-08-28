"use client"

import { useCallback, useMemo, useState } from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Bot, Rocket } from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"

import { NavUser } from "@/components/dashboard/v3/nav-user"
import { useDashboardPreferences } from "@/components/dashboard/preferences/preferences-provider"
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
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getOrderedSections, NAVIGATION_HANDLE_ICON } from "@/lib/dashboard/navigation"
import { NAV_PREFETCH } from "@/lib/dashboard/queries"
import { useDock, undockAssistant } from "@/lib/ui/assistant-dock"
import { DeployAgentModal } from "@/components/dashboard/research/deploy-agent-modal"

const GripIcon = NAVIGATION_HANDLE_ICON

/**
 * Warm a section's data before the click lands.
 *
 * `<Link prefetch>` only fetches the route payload; the section's own API data
 * would still be fetched on mount. Pairing the two means that by the time the
 * user actually clicks, both halves are usually already in memory.
 * `prefetchQuery` is a no-op when the entry is still fresh, so repeat hovers are
 * free and this never fires a duplicate request.
 */
function useNavPrefetch() {
  const queryClient = useQueryClient()

  return useCallback(
    (route: string) => {
      const query = NAV_PREFETCH[route]
      if (!query) return
      void queryClient.prefetchQuery(query())
    },
    [queryClient]
  )
}

export function AppSidebar({
  userEmail,
  ...props
}: React.ComponentProps<typeof Sidebar> & { userEmail: string }) {
  const pathname = usePathname()
  const { preferences, saveState, setNavigationOrder, retrySave } = useDashboardPreferences()
  const { docked } = useDock()
  const prefetch = useNavPrefetch()
  const [deployOpen, setDeployOpen] = useState(false)

  const orderedSections = useMemo(
    () => getOrderedSections(preferences.navigationOrder, preferences.labels),
    [preferences.navigationOrder, preferences.labels]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = orderedSections.findIndex((section) => section.id === active.id)
    const newIndex = orderedSections.findIndex((section) => section.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    setNavigationOrder(arrayMove(preferences.navigationOrder, oldIndex, newIndex))
  }

  const homeRoute = preferences.defaultLandingPage

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href={homeRoute} prefetch />}
              onMouseEnter={() => prefetch(homeRoute)}
              onFocus={() => prefetch(homeRoute)}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-foreground font-mono text-xs font-semibold text-background">
                SV
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">SlideIn Venture</span>
                <span className="truncate text-xs text-muted-foreground">Ops console</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedSections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
                <SidebarMenu>
                  {orderedSections.map((section) => (
                    <SortableSidebarItem
                      key={section.id}
                      section={section}
                      pathname={pathname}
                      onPrefetch={prefetch}
                    />
                  ))}
                </SidebarMenu>
              </SortableContext>
            </DndContext>
          </SidebarGroupContent>
          </SidebarGroup>
          {docked && (
            <div className="px-2 pb-2 pt-1">
              <button
                type="button"
                onClick={() => undockAssistant()}
                title="Bring the assistant back to the screen"
                className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70"
              >
                <Bot className="size-4 text-primary" />
                <span>Assistant</span>
                <span className="ml-auto text-[10px] text-sidebar-foreground/50">tap to open</span>
              </button>
            </div>
          )}
          <div className="px-2 pb-2 pt-1">
            <button
              type="button"
              onClick={() => setDeployOpen(true)}
              title="Deploy a research agent"
              className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70"
            >
              <Rocket className="size-4 text-primary" />
              <span>Deploy Agent</span>
              <span className="ml-auto text-[10px] text-sidebar-foreground/50">research</span>
            </button>
          </div>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 text-[11px] text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
          {saveState === "saving" ? "Saving workspace" : saveState === "saved" ? "Workspace saved" : saveState === "error" ? (
            <button type="button" onClick={retrySave} className="underline underline-offset-2 hover:text-sidebar-foreground">
              Couldn’t save workspace. Retry.
            </button>
          ) : "Workspace remembers your layout"}
        </div>
        <NavUser
          user={{
            name: userEmail.split("@")[0] || "Founder",
            email: userEmail,
            avatar: "",
          }}
        />
      </SidebarFooter>
      <DeployAgentModal open={deployOpen} onOpenChange={setDeployOpen} />
    </Sidebar>
  )
}

function SortableSidebarItem({
  section,
  pathname,
  onPrefetch,
}: {
  section: ReturnType<typeof getOrderedSections>[number]
  pathname: string
  onPrefetch: (route: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isActive = isSectionActive(section.route, pathname, section.children?.map((child) => child.route))

  return (
    <SidebarMenuItem ref={setNodeRef} style={style} className={cn(isDragging && "z-20 opacity-80")}>
      <div className={cn("rounded-lg", isDragging && "bg-sidebar-accent/60 shadow-sm")}>
        <div className="flex items-start gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="mt-1 shrink-0 cursor-grab text-sidebar-foreground/50 hover:text-sidebar-foreground group-data-[collapsible=icon]:hidden"
            aria-label={`Drag ${section.label}`}
            title={`Drag ${section.label}`}
            data-testid="sidebar-drag-handle"
            {...attributes}
            {...listeners}
          >
            <GripIcon className="size-3.5" />
          </Button>

          <div className="min-w-0 flex-1">
            <SidebarMenuButton
              tooltip={section.label}
              isActive={isActive}
              render={<Link href={section.route} prefetch />}
              onMouseEnter={() => onPrefetch(section.route)}
              onFocus={() => onPrefetch(section.route)}
            >
              <ActiveRail active={isActive} />
              <section.icon />
              <span>{section.label}</span>
            </SidebarMenuButton>
          </div>
        </div>
      </div>
    </SidebarMenuItem>
  )
}

/**
 * The active-page indicator: one shared element (layoutId) that slides
 * between rows on navigation instead of fading in fresh at each new spot.
 * Renders only inside the currently-active row; Framer Motion animates the
 * position delta whenever it remounts at a different row.
 */
function ActiveRail({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <motion.span
      layoutId="sidebarActiveRail"
      className="pointer-events-none absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-full bg-[var(--sidebar-primary,var(--primary))]"
      transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.6 }}
    />
  )
}

function isSectionActive(route: string, pathname: string, childRoutes?: string[]) {
  if (pathname === route) return true
  if (route !== "/dashboard" && pathname.startsWith(`${route}/`)) return true
  return childRoutes?.some((childRoute) => pathname === childRoute) ?? false
}
