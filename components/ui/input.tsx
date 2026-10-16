"use client"

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

const fieldClass =
  "w-full border border-rule-strong bg-surface text-sm text-ink-strong transition-[border-color,box-shadow] duration-[120ms] outline-none file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink-strong placeholder:text-ink-faint hover:border-[var(--input-focus-border)] focus-visible:border-[var(--input-focus-border)] focus-visible:shadow-[0_0_0_4px_var(--input-focus-ring)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-status-danger aria-invalid:focus-visible:shadow-[0_0_0_4px_var(--status-danger-bg)]"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn("h-11 min-w-0 rounded-md px-3.5", fieldClass, className)}
      {...props}
    />
  )
}

export { Input, fieldClass }
