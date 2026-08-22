"use client"

import * as React from "react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  subMonths,
} from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"]

interface CalendarProps {
  month?: Date
  onMonthChange?: (date: Date) => void
  selected?: Date
  onSelect?: (date: Date) => void
  hasEvent?: (date: Date) => boolean
  className?: string
}

function Calendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  hasEvent,
  className,
}: CalendarProps) {
  const [internalMonth, setInternalMonth] = React.useState(
    () => month ?? selected ?? new Date()
  )
  const viewMonth = month ?? internalMonth

  const setMonth = (next: Date) => {
    onMonthChange?.(next)
    if (!month) setInternalMonth(next)
  }

  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const gridStart = new Date(monthStart)
  gridStart.setDate(gridStart.getDate() - monthStart.getDay())
  const gridEnd = new Date(monthEnd)
  gridEnd.setDate(gridEnd.getDate() + (6 - monthEnd.getDay()))
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium">{format(viewMonth, "MMMM yyyy")}</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setMonth(subMonths(viewMonth, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setMonth(addMonths(viewMonth, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day, i) => (
          <div
            key={`${day}-${i}`}
            className="flex h-7 items-center justify-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewMonth)
          const isSelected = selected && isSameDay(day, selected)
          const isCurrentDay = isToday(day)
          const marked = hasEvent?.(day)

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect?.(day)}
              className={cn(
                "relative flex h-8 w-full items-center justify-center rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                !inMonth && "text-muted-foreground/50",
                isCurrentDay && !isSelected && "bg-accent/40 font-medium",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
              )}
            >
              {format(day, "d")}
              {marked && (
                <span
                  className={cn(
                    "absolute bottom-1 right-1.5 size-1.5 rounded-full bg-primary",
                    isSelected && "bg-primary-foreground"
                  )}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { Calendar }
