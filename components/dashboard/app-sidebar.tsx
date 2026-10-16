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
import { motion, useReducedMotion } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"

import { GlossTile } from "@/components/system/gloss-tile"
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
import { LogoWordmark } from "@/components/system"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getOrderedSections, NAVIGATION_HANDLE_ICON } from "@/lib/dashboard/navigation"
import { NAV_PREFETCH } from "@/lib/dashboard/queries"
import { useDock, undockAssistant } from "@/lib/ui/assistant-dock"
import { DeployAgentPalette } from "@/components/dashboard/agents/deploy-agent-palette"
import { useDeployedAgent, deployAgent } from "@/lib/agents/deployed-agent-store"

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
  const deployed = useDeployedAgent()
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
              <GlossTile size={36} float={false}>
                <span className="font-sans text-[13px] font-semibold text-ink-strong">SI</span>
              </GlossTile>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <LogoWordmark size="15px" qualifier="OS" />
                <span className="truncate text-xs text-ink-muted mt-0.5">Acquisition Engine</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="[mask-image:linear-gradient(to_bottom,transparent,black_12px,black_calc(100%-12px),transparent)]">
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
            <div className="px-3 pb-2 pt-1">
              <button
                type="button"
                onClick={() => undockAssistant()}
                title="Bring the assistant back to the screen"
                className="flex h-10 w-full items-center gap-3 rounded-[12px] border border-rule bg-transparent px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-hover-tint hover:text-ink-strong"
              >
                <Bot className="size-[18px] shrink-0" />
                <span>Assistant</span>
                <span className="ml-auto text-xs text-ink-faint">tap to open</span>
              </button>
            </div>
          )}
          <div className="px-3 pb-2 pt-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (deployed.agent && !deployed.isOpen) {
                    deployAgent(deployed.agent)
                  } else {
                    setDeployOpen(true)
                  }
                }}
                title={deployed.agent && !deployed.isOpen ? `Summon ${deployed.agent.name}` : "Deploy an agent as a floating circle"}
                className="flex h-10 flex-1 items-center gap-3 rounded-[12px] border border-rule bg-transparent px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-hover-tint hover:text-ink-strong cursor-pointer min-w-0"
              >
                {deployed.agent ? (
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full text-xs"
                    style={{ backgroundColor: `${deployed.agent.color || "#6366f1"}25` }}
                  >
                    {deployed.agent.emoji || "🤖"}
                  </span>
                ) : (
                  <Rocket className="size-[18px] shrink-0" />
                )}
                <span className="truncate">{deployed.agent && !deployed.isOpen ? `Summon ${deployed.agent.name}` : "Deploy Agent"}</span>
                <span className="ml-auto shrink-0 text-xs text-ink-faint">
                  {deployed.agent && !deployed.isOpen ? "docked" : "circle"}
                </span>
              </button>
              {deployed.agent && (
                <button
                  type="button"
                  onClick={() => setDeployOpen(true)}
                  title="Pick or deploy another agent"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-rule bg-transparent text-ink-muted hover:text-ink-strong hover:bg-hover-tint transition-colors cursor-pointer"
                >
                  <Rocket className="size-[18px]" />
                </button>
              )}
            </div>
          </div>
      </SidebarContent>

      <SidebarFooter>
        <div className="border-t border-rule px-2 pt-3 text-xs text-ink-faint group-data-[collapsible=icon]:hidden">
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
      <DeployAgentPalette open={deployOpen} onOpenChange={setDeployOpen} />
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
      <div className={cn("rounded-[12px]", isDragging && "bg-hover-tint shadow-contact")}>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="shrink-0 cursor-grab text-ink-faint opacity-0 transition-opacity duration-[120ms] hover:text-ink-strong hover:opacity-100! group-hover/menu-item:opacity-40 focus-visible:opacity-100 group-data-[collapsible=icon]:hidden"
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
              <ActiveSelection active={isActive} />
              <section.icon className="relative" />
              <span className="relative">{section.label}</span>
              {isActive && (
                <span aria-hidden className="relative ml-auto size-1.5 shrink-0 rounded-full bg-sidebar-primary" />
              )}
            </SidebarMenuButton>
          </div>
        </div>
      </div>
    </SidebarMenuItem>
  )
}

/**
 * The active-page indicator: one shared wash element (layoutId) that slides
 * between rows on navigation over 220ms, plus the 6px dot rendered by the
 * row itself. Renders only inside the currently-active row; Framer Motion
 * animates the position delta whenever it remounts at a different row.
 * Static under reduced motion.
 */
function ActiveSelection({ active }: { active: boolean }) {
  const reduce = useReducedMotion()
  if (!active) return null
  if (reduce) {
    return (
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[12px] bg-sidebar-accent"
      />
    )
  }
  return (
    <motion.span
      layoutId="sidebarActiveWash"
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[12px] bg-sidebar-accent"
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    />
  )
}

function isSectionActive(route: string, pathname: string, childRoutes?: string[]) {
  if (pathname === route) return true
  if (route !== "/dashboard" && pathname.startsWith(`${route}/`)) return true
  return childRoutes?.some((childRoute) => pathname === childRoute) ?? false
}
