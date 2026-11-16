"use client"

import { useState, useTransition } from "react"
import { LockIcon, LockOpenIcon, MessageCircleIcon } from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/api/client"
import { ChatPageLink } from "@/components/chat-page-link"
import { useSession } from "@/components/session-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getAccessToken } from "@/lib/session"
import {
  startAdminChatAction,
  toggleUserLockAction,
} from "@/modules/admin/actions"
import { reserveChatPage } from "@/modules/chats/lib/chat-navigation"

export function adminErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError
    ? Object.values(error.errors ?? {}).flat()[0] || error.message
    : fallback
}

export function AdminChatButton({
  userId,
  name,
}: {
  userId: string
  name: string
}) {
  const { user } = useSession()
  const [pending, startTransition] = useTransition()
  const [chatLink, setChatLink] = useState<{
    ownerId: string
    href: string
  } | null>(null)
  if (!user || userId === user.id) return null
  if (chatLink?.ownerId === user.id)
    return (
      <ChatPageLink
        href={chatLink.href}
        className={buttonVariants({ size: "sm", variant: "outline" })}
      >
        <MessageCircleIcon />
        Mở cuộc trò chuyện
      </ChatPageLink>
    )

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      aria-label={`Nhắn tin với ${name}`}
      onClick={() => {
        const account = getAccessToken()
        const ownerId = user.id
        const reserved = reserveChatPage()
        setChatLink(null)
        startTransition(async () => {
          try {
            const state = await startAdminChatAction(userId)
            if (getAccessToken() !== account) {
              reserved?.close()
              return
            }
            if (state.success && state.conversationSlug) {
              const href = `/chats/${encodeURIComponent(state.conversationSlug)}`
              if (reserved) reserved.navigate(href)
              else setChatLink({ ownerId, href })
            } else {
              reserved?.close()
              toast.error(state.message)
            }
          } catch {
            reserved?.close()
            toast.error("Không thể mở cuộc trò chuyện.")
          }
        })
      }}
    >
      <MessageCircleIcon aria-hidden="true" />
      {pending ? "Đang mở..." : "Nhắn tin"}
    </Button>
  )
}

export function AdminAccountLockButton({
  id,
  name,
  isActive,
  lockReason,
  shop = false,
  disabled = false,
}: {
  id: string
  name: string
  isActive: boolean
  lockReason?: string | null
  shop?: boolean
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const label = isActive ? "Khóa" : "Mở khóa"
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setOpen(value)
          setError("")
          setReason("")
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            size="sm"
            variant={isActive ? "destructive" : "outline"}
            disabled={disabled}
            aria-label={`${label} ${name}`}
          />
        }
      >
        {isActive ? (
          <LockIcon aria-hidden="true" />
        ) : (
          <LockOpenIcon aria-hidden="true" />
        )}
        {label}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {label} {shop ? "gian hàng" : "tài khoản"}
          </DialogTitle>
          <DialogDescription>
            {isActive
              ? `${name} sẽ tạm thời không thể đăng nhập.${shop ? " Gian hàng cũng sẽ được ẩn khỏi trang mua sắm." : ""}`
              : `${name} sẽ có thể đăng nhập và sử dụng tài khoản trở lại.`}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            setError("")
            startTransition(async () => {
              try {
                await toggleUserLockAction(
                  id,
                  isActive ? "lock" : "unlock",
                  isActive ? reason.trim() : undefined
                )
                toast.success("Đã cập nhật trạng thái tài khoản.")
                setOpen(false)
                setReason("")
              } catch (error) {
                setError(
                  adminErrorMessage(
                    error,
                    "Không thể cập nhật trạng thái tài khoản."
                  )
                )
              }
            })
          }}
        >
          {isActive ? (
            <div className="space-y-2">
              <Label htmlFor={`lock-reason-${id}`}>Lý do khóa</Label>
              <Textarea
                id={`lock-reason-${id}`}
                required
                maxLength={500}
                disabled={pending}
                placeholder="Nhập lý do để người dùng biết và khắc phục"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          ) : lockReason ? (
            <p className="text-sm text-muted-foreground">
              Lý do khóa trước đó: {lockReason}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant={isActive ? "destructive" : "default"}
              disabled={pending || (isActive && !reason.trim())}
            >
              {pending
                ? "Đang cập nhật..."
                : `${label} ${shop ? "gian hàng" : "tài khoản"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
