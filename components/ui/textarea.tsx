import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldClass } from "@/components/ui/input"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-[88px] rounded-md px-3.5 py-3 leading-relaxed",
        fieldClass,
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
