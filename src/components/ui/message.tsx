import * as React from "react"
import { cn } from "cn"

function MessageGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-group"
      className={cn("flex min-w-0 flex-col gap-2", className)}
      {...props}
    />
  )
}

function Message({
  className,
  align = "start",
  ...props
}: React.ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        "group/message relative flex w-full min-w-0 gap-2 text-sm data-[align=end]:flex-row-reverse",
        className
      )}
      {...props}
    />
  )
}

function MessageAvatar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-avatar"
      className={cn(
        "flex w-fit min-w-8 shrink-0 items-center justify-center self-end overflow-hidden rounded-full bg-muted group-has-data-[slot=message-footer]/message:-translate-y-8",
        className
      )}
      {...props}
    />
  )
}

function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        "flex w-full min-w-0 flex-col gap-2.5 wrap-break-word group-data-[align=end]/message:*:data-slot:self-end",
        className
      )}
      {...props}
    />
  )
}

function MessageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-header"
      className={cn(
        "flex max-w-full min-w-0 items-center px-3 text-xs font-medium text-muted-foreground group-has-data-[variant=ghost]/message:px-0",
        className
      )}
      {...props}
    />
  )
}

function MessageFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-footer"
      className={cn(
        "flex max-w-full min-w-0 items-center px-3 text-xs font-medium text-muted-foreground group-has-data-[variant=ghost]/message:px-0 group-data-[align=end]/message:justify-end",
        className
      )}
      {...props}
    />
  )
}

function MessageBubble({
  className,
  align = "start",
  continuesPrevious = false,
  continuesNext = false,
  ...props
}: React.ComponentProps<"div"> & {
  align?: "start" | "end"
  continuesPrevious?: boolean
  continuesNext?: boolean
}) {
  const outgoing = align === "end"
  return (
    <div
      data-slot="message-bubble"
      data-align={align}
      className={cn(
        "max-w-full min-w-0 overflow-hidden rounded-2xl border shadow-xs",
        outgoing
          ? "border-transparent bg-action text-action-foreground"
          : "border-border/70 bg-card text-foreground",
        continuesPrevious && (outgoing ? "rounded-tr-md" : "rounded-tl-md"),
        continuesNext && (outgoing ? "rounded-br-md" : "rounded-bl-md"),
        className
      )}
      {...props}
    />
  )
}

function MessageQuote({
  className,
  variant = "draft",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "draft" | "incoming" | "outgoing"
}) {
  return (
    <div
      data-slot="message-quote"
      className={cn(
        "flex min-w-0 items-start gap-2 border-l-2 p-2",
        variant === "draft"
          ? "max-w-sm rounded-lg border-primary/60 bg-muted/40"
          : variant === "outgoing"
            ? "max-w-full rounded-md border-action-foreground/50 bg-action-foreground/10 text-action-foreground"
            : "max-w-full rounded-md border-primary/40 bg-background/65 text-foreground/80",
        className
      )}
      {...props}
    />
  )
}

export {
  MessageGroup,
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
  MessageBubble,
  MessageQuote,
}
