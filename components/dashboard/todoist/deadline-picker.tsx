"use client"

import { useCallback, useRef, useState } from "react"
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

const DIAL_SIZE = 176
const DIAL_CENTER = DIAL_SIZE / 2
const DIAL_RADIUS = 80

// Angle convention: 0 rad points at 12 o'clock, increasing clockwise.
// Matches how a clock face reads, so hour/minute math below stays intuitive.
function pointToAngle(x: number, y: number, cx: number, cy: number): number {
  const angle = Math.atan2(x - cx, -(y - cy))
  return angle < 0 ? angle + Math.PI * 2 : angle
}

function angleToHour12(angle: number): number {
  const hour = Math.round(angle / (Math.PI / 6)) % 12
  return hour === 0 ? 12 : hour
}

function angleToMinute(angle: number): number {
  return Math.round(angle / (Math.PI / 30)) % 60
}

function AnalogDial({
  draft,
  mode,
  onSetHour,
  onSetMinute,
}: {
  draft: Date
  mode: "hour" | "minute"
  onSetHour: (hour12: number) => void
  onSetMinute: (minute: number) => void
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const draggingRef = useRef(false)

  const minutes = draft.getMinutes()
  const hour12 = draft.getHours() % 12 === 0 ? 12 : draft.getHours() % 12
  const minuteAngle = (minutes * 6 * Math.PI) / 180
  const hourAngle = ((hour12 % 12) * 30 + minutes * 0.5) * (Math.PI / 180)

  const applyAtPoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const scale = DIAL_SIZE / rect.width
      const x = (clientX - rect.left) * scale
      const y = (clientY - rect.top) * scale
      const angle = pointToAngle(x, y, DIAL_CENTER, DIAL_CENTER)
      if (mode === "hour") onSetHour(angleToHour12(angle))
      else onSetMinute(angleToMinute(angle))
    },
    [mode, onSetHour, onSetMinute]
  )

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    draggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    applyAtPoint(e.clientX, e.clientY)
  }
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return
    applyAtPoint(e.clientX, e.clientY)
  }
  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    draggingRef.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const activeAngle = mode === "hour" ? hourAngle : minuteAngle
  const handLength = mode === "hour" ? DIAL_RADIUS * 0.52 : DIAL_RADIUS * 0.8
  const handX = DIAL_CENTER + Math.sin(activeAngle) * handLength
  const handY = DIAL_CENTER - Math.cos(activeAngle) * handLength

  const ticks = Array.from({ length: 12 }, (_, i) => i)

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
      width={DIAL_SIZE}
      height={DIAL_SIZE}
      className="touch-none select-none rounded-full"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      role="slider"
      aria-label={mode === "hour" ? "Hour" : "Minute"}
      aria-valuenow={mode === "hour" ? hour12 : minutes}
      aria-valuemin={mode === "hour" ? 1 : 0}
      aria-valuemax={mode === "hour" ? 12 : 59}
    >
      <circle
        cx={DIAL_CENTER}
        cy={DIAL_CENTER}
        r={DIAL_RADIUS}
        className="fill-muted/40 stroke-border"
        strokeWidth={1}
      />
      {ticks.map((i) => {
        const tickAngle = (i * 30 * Math.PI) / 180
        const isMajor = i % 3 === 0
        const outer = DIAL_RADIUS - 4
        const inner = outer - (isMajor ? 8 : 4)
        const labelR = outer - 18
        const x1 = DIAL_CENTER + Math.sin(tickAngle) * outer
        const y1 = DIAL_CENTER - Math.cos(tickAngle) * outer
        const x2 = DIAL_CENTER + Math.sin(tickAngle) * inner
        const y2 = DIAL_CENTER - Math.cos(tickAngle) * inner
        const label = mode === "hour" ? (i === 0 ? 12 : i) : i * 5
        const lx = DIAL_CENTER + Math.sin(tickAngle) * labelR
        const ly = DIAL_CENTER - Math.cos(tickAngle) * labelR
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-foreground/30" strokeWidth={isMajor ? 2 : 1} />
            {isMajor && (
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[10px] font-medium tabular-nums"
              >
                {label}
              </text>
            )}
          </g>
        )
      })}
      <line
        x1={DIAL_CENTER}
        y1={DIAL_CENTER}
        x2={handX}
        y2={handY}
        className="stroke-primary"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle cx={DIAL_CENTER} cy={DIAL_CENTER} r={4} className="fill-primary" />
      <circle cx={handX} cy={handY} r={6} className="fill-primary" />
    </svg>
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

  // Up increases, down decreases. Matches every other stepper in the app.
  function bump(field: "hour" | "minute", delta: number) {
    const next = new Date(draft)
    if (field === "hour") next.setHours(next.getHours() + delta)
    else next.setMinutes(next.getMinutes() + delta)
    setDraft(next)
  }

  function setHour12(hour12: number) {
    const next = new Date(draft)
    const isPm = next.getHours() >= 12
    const hour24 = (hour12 % 12) + (isPm ? 12 : 0)
    next.setHours(hour24)
    setDraft(next)
    setMode("minute")
  }

  function setMinute(minute: number) {
    const next = new Date(draft)
    next.setMinutes(minute)
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

          <div className="flex flex-col items-center gap-3 border-t border-border pt-3">
            <AnalogDial draft={draft} mode={mode} onSetHour={setHour12} onSetMinute={setMinute} />

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-md bg-muted/50 p-1">
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => bump(mode, 1)}>
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
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => bump(mode, -1)}>
                  <ChevronDown className="size-4" />
                </Button>
              </div>

              <div className="flex flex-col items-center gap-1">
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
