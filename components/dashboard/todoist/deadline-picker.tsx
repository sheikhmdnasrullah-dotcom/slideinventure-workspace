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

const SIZE = 200
const CENTER = SIZE / 2

function angleFromPoint(x: number, y: number): number {
  let angle = (Math.atan2(y - CENTER, x - CENTER) * 180) / Math.PI + 90
  if (angle < 0) angle += 360
  return angle
}

function ClockFace({
  date,
  mode,
  onSet,
}: {
  date: Date
  mode: "hour" | "minute"
  onSet: (value: number) => void
}) {
  const hourAngle = ((date.getHours() % 12) + date.getMinutes() / 60) * 30
  const minuteAngle = date.getMinutes() * 6

  const handlePointer = (clientX: number, clientY: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    const angle = angleFromPoint(
      ((clientX - rect.left) / rect.width) * SIZE,
      ((clientY - rect.top) / rect.height) * SIZE
    )
    if (mode === "hour") {
      const h = Math.round(angle / 30) % 12
      const isPm = date.getHours() >= 12
      onSet(isPm ? (h === 0 ? 12 : h + 12) : h)
    } else {
      onSet(Math.round(angle / 6) % 60)
    }
  }

  return (
    <div
      className="relative mx-auto touch-none select-none"
      style={{ width: SIZE, height: SIZE }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        handlePointer(e.clientX, e.clientY, e.currentTarget)
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) handlePointer(e.clientX, e.clientY, e.currentTarget)
      }}
    >
      <div className="absolute inset-0 rounded-full bg-muted/40 ring-1 ring-foreground/10" />
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 * Math.PI) / 180
        const x = CENTER + Math.sin(angle) * (CENTER - 18) - 7
        const y = CENTER - Math.cos(angle) * (CENTER - 18) - 9
        return (
          <span
            key={i}
            className="absolute text-[11px] font-medium text-muted-foreground"
            style={{ left: x, top: y }}
          >
            {i === 0 ? 12 : i}
          </span>
        )
      })}

      {Array.from({ length: 60 }).map((_, i) => {
        if (i % 5 === 0) return null
        const angle = (i * 6 * Math.PI) / 180
        const x = CENTER + Math.sin(angle) * (CENTER - 6)
        const y = CENTER - Math.cos(angle) * (CENTER - 6)
        return (
          <span
            key={i}
            className="absolute size-[2px] rounded-full bg-muted-foreground/40"
            style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
          />
        )
      })}

      {/* hour hand */}
      <div
        className="absolute left-1/2 top-1/2 h-[52px] w-[3px] -translate-x-1/2 -translate-y-full rounded-full bg-foreground origin-bottom transition-transform"
        style={{ transform: `translate(-50%, -100%) rotate(${hourAngle}deg)` }}
      />
      {/* minute hand */}
      <div
        className={cn(
          "absolute left-1/2 top-1/2 h-[74px] w-[2px] -translate-x-1/2 -translate-y-full rounded-full bg-primary origin-bottom transition-transform",
          mode === "minute" ? "bg-primary" : "bg-foreground/70"
        )}
        style={{ transform: `translate(-50%, -100%) rotate(${minuteAngle}deg)` }}
      />
      <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
    </div>
  )
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

  function setHour(h: number) {
    const next = new Date(draft)
    const isPm = draft.getHours() >= 12
    next.setHours(isPm ? (h === 12 ? 12 : h + 12) % 24 : h === 12 ? 0 : h)
    setDraft(next)
  }

  function setMinute(m: number) {
    const next = new Date(draft)
    next.setMinutes(m)
    setDraft(next)
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
            <ClockFace
              date={draft}
              mode={mode}
              onSet={(v) => (mode === "hour" ? setHour(v) : setMinute(v))}
            />
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
