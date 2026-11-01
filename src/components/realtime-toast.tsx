"use client"

import { XIcon } from "lucide-react"
import { toast } from "sonner"

import { UserAvatar } from "@/components/user-avatar"

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
    <div className="flex w-[var(--width)] max-w-full items-start rounded-xl border bg-popover text-popover-foreground shadow-lg">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-3 rounded-l-xl p-4 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
            <span className="line-clamp-3 block text-sm wrap-break-word text-muted-foreground">
              {description}
            </span>
          ) : null}
          <span className="block text-xs font-medium text-primary">Xem</span>
        </span>
      </button>
      <button
        type="button"
        aria-label="Đóng thông báo"
        className="m-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => toast.dismiss(id)}
      >
        <XIcon className="size-4" />
      </button>
    </div>
  )
}

export function showRealtimeToast(props: RealtimeToastProps) {
  return toast.custom((id) => <RealtimeToast {...props} id={id} />, {
    id: props.id,
    duration: 6000,
  })
}
