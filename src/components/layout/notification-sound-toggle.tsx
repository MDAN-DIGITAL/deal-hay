"use client"

import {
  PlayIcon,
  BellOffIcon,
  BellIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react"
import type { RefObject } from "react"
import { toast } from "sonner"

import { useRealtime } from "@/components/realtime-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

const settingsTitle = "Âm thanh và thông báo"
const settingsDescription = "Nhận tin nhắn và thông báo mới trên thiết bị này."

export function NotificationSoundToggle() {
  const { notificationSoundEnabled } = useRealtime()

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label="Cài đặt âm thanh và thông báo"
            tooltip="Cài đặt âm thanh và thông báo"
            size="icon"
            title="Cài đặt âm thanh và thông báo"
            variant="ghost"
          />
        }
      >
        {notificationSoundEnabled ? <Volume2Icon /> : <VolumeXIcon />}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[80dvh] w-80 max-w-[calc(100vw-2rem)] gap-3 overflow-y-auto"
      >
        <div className="space-y-1">
          <PopoverTitle>{settingsTitle}</PopoverTitle>
          <PopoverDescription>{settingsDescription}</PopoverDescription>
        </div>
        <NotificationSoundSettings />
      </PopoverContent>
    </Popover>
  )
}

export function NotificationSoundDialog({
  open,
  onOpenChange,
  finalFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  finalFocus: RefObject<HTMLElement | null>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto"
        finalFocus={finalFocus}
      >
        <DialogHeader className="pr-8">
          <DialogTitle>{settingsTitle}</DialogTitle>
          <DialogDescription>{settingsDescription}</DialogDescription>
        </DialogHeader>
        <NotificationSoundSettings />
      </DialogContent>
    </Dialog>
  )
}

function NotificationSoundSettings() {
  const {
    notificationSoundEnabled,
    toggleNotificationSound,
    testNotificationSound,
    soundReady,
    backgroundNotifications: background,
  } = useRealtime()

  return (
    <>
      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Âm báo Deal Hay</span>
          <Button
            startIcon={
              notificationSoundEnabled ? <VolumeXIcon /> : <Volume2Icon />
            }
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={notificationSoundEnabled}
            onClick={toggleNotificationSound}
          >
            {notificationSoundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {notificationSoundEnabled
            ? soundReady
              ? "Âm báo đã sẵn sàng cho tin nhắn và thông báo mới."
              : "Bấm Nghe thử để kích hoạt âm báo trên trình duyệt."
            : "Âm báo Deal Hay đang tắt."}
        </p>
        <Button
          startIcon={<PlayIcon />}
          type="button"
          size="sm"
          variant="secondary"
          disabled={!notificationSoundEnabled}
          onClick={() => {
            void testNotificationSound().then((played) => {
              if (!played)
                toast.info(
                  "Chưa phát được âm báo. Hãy kiểm tra âm lượng thiết bị rồi thử lại."
                )
            })
          }}
        >
          Nghe thử
        </Button>
      </div>
      <div className="space-y-2 border-t pt-3">
        <p className="text-sm font-medium">Thông báo khi rời web</p>
        <p className="text-xs text-muted-foreground">
          {background.installRequired
            ? "Trên iPhone/iPad: Chia sẻ → Thêm vào Màn hình chính, mở Deal Hay từ biểu tượng rồi bật thông báo."
            : !background.supported
              ? "Trình duyệt này chưa hỗ trợ thông báo nền."
              : !background.configured
                ? "Thông báo khi đóng web chưa được máy chủ bật."
                : background.permission === "denied"
                  ? "Quyền thông báo đang bị chặn. Hãy cho phép lại trong cài đặt trình duyệt."
                  : background.enabled
                    ? "Đang bật. Khi đóng tab, thông báo sẽ hiện dưới dạng thẻ im lặng."
                    : "Bấm Bật và chọn Cho phép để nhận khi dùng ứng dụng khác."}
        </p>
        <Button
          startIcon={background.enabled ? <BellOffIcon /> : <BellIcon />}
          type="button"
          size="sm"
          variant={background.enabled ? "outline" : "default"}
          disabled={
            background.loading ||
            (!background.enabled &&
              (!background.supported ||
                background.installRequired ||
                !background.configured ||
                background.permission === "denied"))
          }
          onClick={() => {
            if (background.enabled) void background.disable()
            else void background.enable()
          }}
        >
          {background.loading
            ? "Đang cập nhật..."
            : background.enabled
              ? "Tắt thông báo nền"
              : "Bật thông báo nền"}
        </Button>
        {background.error ? (
          <p className="text-xs text-destructive" role="alert">
            {background.error}
          </p>
        ) : null}
      </div>
    </>
  )
}
