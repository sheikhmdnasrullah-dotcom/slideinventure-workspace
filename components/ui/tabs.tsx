"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { motion, useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"

/** Scopes the sliding pill's layoutId to one tab group. */
const TabsPillContext = React.createContext<string>("tabs-pill")

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center gap-1 rounded-pill bg-status-neutral-bg p-1 text-ink-muted group-data-horizontal/tabs:h-10 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none data-[variant=line]:bg-transparent",
  {
    variants: {
      variant: {
        default: "",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  const pillId = React.useId()
  return (
    <TabsPillContext.Provider value={pillId}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      />
    </TabsPillContext.Provider>
  )
}

function TabsTrigger({
  className,
  children,
  ...props
}: TabsPrimitive.Tab.Props) {
  const pillId = React.useContext(TabsPillContext)
  const reduce = useReducedMotion()
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-pill px-3.5 text-[13px] font-medium whitespace-nowrap text-ink-muted transition-colors duration-[220ms] outline-none group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-ink-strong disabled:pointer-events-none disabled:opacity-50 data-active:text-ink-strong group-data-[variant=line]/tabs-list:data-active:text-ink-strong [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      render={(tabProps, state) => (
        <button {...tabProps}>
          {state.active &&
            (reduce ? (
              <span
                aria-hidden
                className="absolute inset-0 rounded-pill bg-surface shadow-raised group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:shadow-none"
              />
            ) : (
              <motion.span
                aria-hidden
                layoutId={pillId}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 rounded-pill bg-surface shadow-raised group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:shadow-none"
              />
            ))}
          <span className="relative z-10 flex items-center gap-1.5">{children}</span>
        </button>
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
