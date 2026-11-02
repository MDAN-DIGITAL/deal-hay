import { cn } from "@/lib/utils"

export function Brand({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  return (
    <span
      data-slot="brand"
      className={cn("inline-flex shrink-0 items-center gap-2.5", className)}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground">
        D
      </span>
      <span
        className={cn(
          "font-heading text-xl font-semibold tracking-tight text-foreground",
          compact && "hidden min-[360px]:inline"
        )}
      >
        Deal<span className="text-primary">Hay</span>
      </span>
    </span>
  )
}
