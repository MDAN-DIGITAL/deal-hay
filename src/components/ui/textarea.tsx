import * as React from "react"
import { cn } from "cn"

function Textarea({
  className,
  startIcon,
  ...props
}: React.ComponentProps<"textarea"> & { startIcon?: React.ReactNode }) {
  const textarea = (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-base leading-6 shadow-xs transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-muted-foreground/85 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-sm",
        startIcon && "pl-9",
        className
      )}
      {...props}
    />
  )

  if (!startIcon) return textarea

  return (
    <div className="relative min-w-0">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-3.5 left-3 z-10 text-muted-foreground [&>svg]:size-4"
      >
        {startIcon}
      </span>
      {textarea}
    </div>
  )
}

export { Textarea }
