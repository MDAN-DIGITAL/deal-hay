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
      <svg
        aria-hidden="true"
        data-slot="brand-mark"
        focusable="false"
        viewBox="0 0 64 64"
        className="size-9 shrink-0"
      >
        <path
          className="fill-primary"
          d="M13 5h27.6c2.1 0 4.2.9 5.7 2.4l10.3 10.3a8 8 0 0 1 2.4 5.7V47a9 9 0 0 1-9 9H31L18 63V56h-5a9 9 0 0 1-9-9V14a9 9 0 0 1 9-9Z"
        />
        <circle
          cx="45.5"
          cy="18.5"
          r="3.5"
          className="fill-primary-foreground opacity-90"
        />
        <path
          className="fill-primary-foreground"
          fillRule="evenodd"
          d="M18 18h9.2C37.7 18 45 23.6 45 32s-7.3 14-17.8 14H18V18Zm7 7v14h2.4C33.7 39 38 36.4 38 32s-4.3-7-10.6-7H25Z"
        />
      </svg>
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
