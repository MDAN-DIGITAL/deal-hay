"use client"

import { ReplyIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { MessageQuote } from "@/components/ui/message"
import { cn } from "@/lib/utils"
import type { ChatReply } from "@/types/chat"

export function chatReplySummary(reply: ChatReply) {
  const parts: string[] = []
  if (reply.body.trim()) parts.push(reply.body.trim())
  if (reply.attachment) {
    const label =
      reply.attachment.type === "image"
        ? "Ảnh"
        : reply.attachment.type === "video"
          ? "Video"
          : "Tệp"
    parts.push(`${label}: ${reply.attachment.name}`)
  }
  if (reply.product) parts.push(`Sản phẩm: ${reply.product.name}`)
  return parts.join(" · ") || "Tin nhắn"
}

export function ChatReplyPreview({
  reply,
  onCancel,
  onJump,
  className,
  variant = "draft",
  outgoing = false,
}: {
  reply: ChatReply
  onCancel?: () => void
  onJump?: () => void
  className?: string
  variant?: "draft" | "message"
  outgoing?: boolean
}) {
  const content = (
    <>
      <span
        className={cn(
          "flex items-center gap-1 text-xs font-medium",
          variant === "draft" ? "text-primary" : "text-inherit"
        )}
      >
        {variant === "draft" ? (
          <ReplyIcon aria-hidden="true" className="size-3.5 shrink-0" />
        ) : null}
        <span className="truncate">
          {variant === "draft" ? "Đang trả lời " : ""}
          {reply.sender.name}
        </span>
      </span>
      <span
        className={cn(
          "line-clamp-2 text-xs leading-relaxed wrap-break-word",
          variant === "message" && outgoing
            ? "text-action-foreground/80"
            : "text-muted-foreground"
        )}
      >
        {chatReplySummary(reply)}
      </span>
    </>
  )

  return (
    <MessageQuote
      variant={
        variant === "draft" ? "draft" : outgoing ? "outgoing" : "incoming"
      }
      className={className}
    >
      {onJump ? (
        <Button
          variant="ghost"
          aria-label={`Xem tin nhắn của ${reply.sender.name}`}
          className="h-auto min-w-0 flex-1 flex-col items-start gap-1 p-0 text-left whitespace-normal text-inherit hover:bg-transparent hover:text-inherit"
          type="button"
          onClick={onJump}
        >
          {content}
        </Button>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-1" role="status">
          {content}
        </div>
      )}
      {onCancel ? (
        <Button
          aria-label="Hủy trả lời"
          className="-mt-1 -mr-1 shrink-0"
          size="icon-sm"
          type="button"
          variant="ghost"
          onClick={onCancel}
        >
          <XIcon />
        </Button>
      ) : null}
    </MessageQuote>
  )
}
