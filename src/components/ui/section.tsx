import type { ReactNode } from "react"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function Section({
  title,
  description,
  icon,
  action,
  children,
  className,
  contentClassName,
  size = "default",
}: {
  title?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  size?: "default" | "sm"
}) {
  return (
    <Card className={className} size={size}>
      {title || description || action ? (
        <CardHeader>
          {title ? (
            <CardTitle className="flex items-center gap-2">
              {icon ? (
                <span className="text-primary [&>svg]:size-4">{icon}</span>
              ) : null}
              {title}
            </CardTitle>
          ) : null}
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
          {action ? <CardAction>{action}</CardAction> : null}
        </CardHeader>
      ) : null}
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}

export function StatCard({
  label,
  value,
  description,
  icon,
  className,
  compact = false,
}: {
  label: string
  value: ReactNode
  description?: ReactNode
  icon?: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <Card
      size="sm"
      className={cn(
        compact &&
          "[--card-spacing:--spacing(3)] sm:[--card-spacing:--spacing(4)]",
        className
      )}
    >
      <CardContent className="gap-2">
        <div className="flex items-center justify-between gap-3">
          <p
            className={cn(
              "text-xs font-medium text-muted-foreground",
              compact && "text-[10px] leading-4 sm:text-xs"
            )}
          >
            {label}
          </p>
          {icon ? (
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&>svg]:size-4",
                compact && "hidden sm:flex"
              )}
            >
              {icon}
            </span>
          ) : null}
        </div>
        <p
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            compact && "text-lg sm:text-2xl"
          )}
        >
          {value}
        </p>
        {description ? (
          <p className="text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
