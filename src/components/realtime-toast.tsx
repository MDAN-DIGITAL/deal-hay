"use client"

import { XIcon } from "lucide-react"
import { toast } from "sonner"

import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type RealtimeToastProps = {
  id: string | number
  title: string
  description?: string
  avatar: { name: string; src: string | null }
  onOpen: () => void
}

export function RealtimeToast({
  id,
  title,
  description,
  avatar,
  onOpen,
}: RealtimeToastProps) {
  return (
    <Card className="w-[var(--width)] max-w-full flex-row items-start gap-0 py-0">
      <Button
        type="button"
        className="h-auto min-w-0 flex-1 items-start justify-start gap-3 rounded-r-none border-0 p-4 text-left whitespace-normal"
        variant="ghost"
        onClick={() => {
          toast.dismiss(id)
          onOpen()
        }}
      >
        <UserAvatar
          className="size-10 shrink-0"
          name={avatar.name}
          src={avatar.src}
        />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block text-sm font-semibold wrap-break-word">
            {title}
          </span>
          {description ? (
            <span className="line-clamp-3 block text-sm font-normal wrap-break-word text-muted-foreground">
              {description}
            </span>
          ) : null}
          <span className="block text-xs font-medium text-primary">Xem</span>
        </span>
      </Button>
      <Button
        type="button"
        aria-label="Đóng thông báo"
        className="m-1 text-muted-foreground"
        size="icon-sm"
        variant="ghost"
        onClick={() => toast.dismiss(id)}
      >
        <XIcon className="size-4" />
      </Button>
    </Card>
  )
}

export function showRealtimeToast(props: RealtimeToastProps) {
  return toast.custom((id) => <RealtimeToast {...props} id={id} />, {
    id: props.id,
    duration: 6000,
  })
}
