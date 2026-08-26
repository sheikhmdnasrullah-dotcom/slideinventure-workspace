"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Calendar as CalendarIcon, Check, X, ChevronUp, ChevronDown } from "lucide-react"
import { formatToTodoistDueDate, parseTodoistDueDate } from "@/lib/todoist/date"

interface DeadlinePickerProps {
  value: string
  onChange: (value: string) => void
  id?: string
  className?: string
}

export function DeadlinePicker({ value, onChange, id, className }: DeadlinePickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Date>(() => parseTodoistDueDate(value) ?? startOfNextHour())
  const [mode, setMode] = useState<"hour" | "minute">("hour")

  function startOfNextHour(): Date {
    const d = new Date()
    d.setMinutes(0, 0, 0)
    d.setHours(d.getHours() + 1)
    return d
  }

  function openPicker() {
    setDraft(parseTodoistDueDate(value) ?? startOfNextHour())
    setMode("hour")
    setOpen(true)
  }

  function apply() {
    onChange(formatToTodoistDueDate(draft))
    setOpen(false)
  }

  function cancel() {
    setOpen(false)
  }

  function bump(field: "hour" | "minute", delta: number) {
    const next = new Date(draft)
    if (field === "hour") next.setHours(next.getHours() + delta)
    else next.setMinutes(next.getMinutes() + delta)
    setDraft(next)
  }

  function toggleAmPm() {
    const next = new Date(draft)
    next.setHours((next.getHours() + 12) % 24)
    setDraft(next)
  }

  const displayDate = parseTodoistDueDate(value)
  const hour12 = draft.getHours() % 12 === 0 ? 12 : draft.getHours() % 12
  const isPm = draft.getHours() >= 12

  return (
    <Popover open={open} onOpenChange={(o) => (o ? openPicker() : setOpen(false))}>
      <PopoverTrigger
        render={
          <button
            type="button"
            id={id}
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
              !displayDate && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="size-4 shrink-0 opacity-70" />
            <span className="flex-1 truncate">
              {displayDate
                ? format(displayDate, "EEE, MMM d · h:mm a")
                : "Set deadline (date & time)"}
            </span>
            {displayDate && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange("")
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </span>
            )}
          </button>
        }
      />
      <PopoverContent className="w-[320px] max-w-[92vw] p-3" align="start">
        <div className="flex flex-col gap-3">
          <Calendar
            selected={draft}
            onSelect={(d) => {
              if (!d) return
              const next = new Date(draft)
              next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate())
              setDraft(next)
            }}
          />

          <div className="flex items-center justify-center gap-4">
            <div className="flex h-[156px] w-[156px] flex-col items-center justify-center rounded-full border border-foreground/10 bg-muted/40 text-center">
              <span className="text-4xl font-semibold tabular-nums leading-none text-foreground">
                {String(hour12).padStart(2, "0")}:{String(draft.getMinutes()).padStart(2, "0")}
              </span>
              <span className="mt-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {isPm ? "PM" : "AM"}
              </span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 rounded-md bg-muted/50 p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => bump(mode, -1)}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <div className="flex items-center gap-1 text-2xl font-semibold tabular-nums">
                  <button
                    type="button"
                    onClick={() => setMode("hour")}
                    className={cn(
                      "rounded px-1.5 py-0.5 transition-colors",
                      mode === "hour" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    )}
                  >
                    {String(hour12).padStart(2, "0")}
                  </button>
                  <span className="opacity-50">:</span>
                  <button
                    type="button"
                    onClick={() => setMode("minute")}
                    className={cn(
                      "rounded px-1.5 py-0.5 transition-colors",
                      mode === "minute" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    )}
                  >
                    {String(draft.getMinutes()).padStart(2, "0")}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => bump(mode, 1)}
                >
                  <ChevronDown className="size-4" />
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant={!isPm ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 w-12"
                  onClick={() => {
                    if (isPm) toggleAmPm()
                  }}
                >
                  AM
                </Button>
                <Button
                  type="button"
                  variant={isPm ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 w-12"
                  onClick={() => {
                    if (!isPm) toggleAmPm()
                  }}
                >
                  PM
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">
              {format(draft, "EEE, MMM d yyyy")}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={cancel}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={apply}>
                <Check className="mr-1 size-3.5" />
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
