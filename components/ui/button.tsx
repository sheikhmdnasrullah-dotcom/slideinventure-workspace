import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-pill border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[transform,background-color,box-shadow,color,border-color] duration-[120ms] ease-out outline-none select-none hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none disabled:transform-none aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default: "bg-button-primary text-on-button-primary shadow-button",
        outline:
          "border-rule-strong bg-surface text-ink-strong hover:shadow-raised aria-expanded:shadow-raised",
        secondary:
          "border-rule-strong bg-surface text-ink-strong hover:shadow-raised aria-expanded:shadow-raised",
        ghost:
          "text-ink-muted hover:bg-hover-tint hover:text-ink-strong aria-expanded:bg-hover-tint aria-expanded:text-ink-strong",
        destructive:
          "bg-surface text-status-danger hover:bg-status-danger-bg",
        link: "text-ink-strong underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-7 gap-1.5 px-3 text-xs has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-4",
        sm: "h-8 gap-1.5 px-4 text-[13px] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-11 gap-2 px-6 has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-9",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  dot = false,
  loading = false,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** 8px accent dot before the label: the view's single primary action only. */
    dot?: boolean
    /** Replaces the dot with a 14px spinner without changing width. */
    loading?: boolean
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {(dot || loading) && (
        <span
          aria-hidden
          className="flex w-[14px] shrink-0 items-center justify-center"
        >
          {loading ? (
            <span className="size-[14px] animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" />
          ) : (
            <span className="size-2 rounded-full bg-flame-vivid" />
          )}
        </span>
      )}
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
