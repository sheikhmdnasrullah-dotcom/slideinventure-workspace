"use client"

import { useMemo, useState } from "react"
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
import { ChevronRight } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getOrderedSections, NAVIGATION_HANDLE_ICON } from "@/lib/dashboard/navigation"

const GripIcon = NAVIGATION_HANDLE_ICON

export function AppSidebar({
  userEmail,
  ...props
}: React.ComponentProps<typeof Sidebar> & { userEmail: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const { preferences, saveState, setNavigationOrder, retrySave } = useDashboardPreferences()

  const orderedSections = useMemo(
    () => getOrderedSections(preferences.navigationOrder),
    [preferences.navigationOrder]
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
            <SidebarMenuButton size="lg" onClick={() => router.push(homeRoute)}>
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
                    <SortableSidebarItem key={section.id} section={section} pathname={pathname} />
                  ))}
                </SidebarMenu>
              </SortableContext>
            </DndContext>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 text-[11px] text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
          {saveState === "saving" ? "Saving workspace…" : saveState === "saved" ? "Workspace saved" : saveState === "error" ? (
            <button type="button" onClick={retrySave} className="underline underline-offset-2 hover:text-sidebar-foreground">
              Couldn’t save workspace — Retry
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
    </Sidebar>
  )
}

function SortableSidebarItem({
  section,
  pathname,
}: {
  section: ReturnType<typeof getOrderedSections>[number]
  pathname: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(() => isSectionActive(section.route, pathname, section.children?.map((child) => child.route)))
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
    <SidebarMenuItem ref={setNodeRef} style={style} className={cn(isDragging && "z-20 opacity-80") }>
      <div className={cn("rounded-lg", isDragging && "bg-sidebar-accent/60 shadow-sm") }>
        <div className="flex items-start gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="mt-1 shrink-0 cursor-grab text-sidebar-foreground/50 hover:text-sidebar-foreground group-data-[collapsible=icon]:hidden"
            aria-label={`Drag ${section.label}`}
            title={`Drag ${section.label}`}
            {...attributes}
            {...listeners}
          >
            <GripIcon className="size-3.5" />
          </Button>

          <div className="min-w-0 flex-1">
            {section.children?.length ? (
              <Collapsible open={open || isActive} onOpenChange={setOpen} className="group/collapsible">
                <div className="flex items-center gap-1">
                  <SidebarMenuButton tooltip={section.label} isActive={isActive} onClick={() => router.push(section.route)} className="flex-1">
                    <section.icon />
                    <span>{section.label}</span>
                  </SidebarMenuButton>
                  <CollapsibleTrigger
                    aria-label={`Toggle ${section.label} submenu`}
                    className="inline-flex size-6 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <ChevronRight className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {section.children.map((child) => {
                      const activeChild = pathname === child.route
                      return (
                        <SidebarMenuSubItem key={child.id}>
                          <SidebarMenuSubButton
                            isActive={activeChild}
                            render={
                              child.external ? (
                                <a href={child.route} target="_blank" rel="noreferrer noopener" />
                              ) : (
                                <button type="button" />
                              )
                            }
                            onClick={() => {
                              if (!child.external) router.push(child.route)
                            }}
                          >
                            <span>{child.label}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <SidebarMenuButton tooltip={section.label} isActive={isActive} onClick={() => router.push(section.route)}>
                <section.icon />
                <span>{section.label}</span>
              </SidebarMenuButton>
            )}
          </div>
        </div>
      </div>
    </SidebarMenuItem>
  )
}

function isSectionActive(route: string, pathname: string, childRoutes?: string[]) {
  if (pathname === route) return true
  if (route !== "/dashboard" && pathname.startsWith(`${route}/`)) return true
  return childRoutes?.some((childRoute) => pathname === childRoute) ?? false
}
