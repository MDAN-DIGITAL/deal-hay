"use client"

import { Volume2Icon, VolumeXIcon } from "lucide-react"
import { toast } from "sonner"

import { useRealtime } from "@/components/realtime-provider"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

export function NotificationSoundToggle() {
  const {
    notificationSoundEnabled,
    toggleNotificationSound,
    testNotificationSound,
    soundReady,
    backgroundNotifications,
  } = useRealtime()
  const background = backgroundNotifications

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label="Cài đặt âm thanh và thông báo"
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
          <PopoverTitle>Âm thanh và thông báo</PopoverTitle>
          <PopoverDescription>
            Nhận tin nhắn và thông báo mới trên thiết bị này.
          </PopoverDescription>
        </div>
        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Âm thanh trên web</span>
            <Button
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
                ? "Âm thanh đã sẵn sàng."
                : "Bấm Nghe thử để trình duyệt cho phép phát âm thanh."
              : "Bạn đã tắt tiếng tin nhắn và thông báo trong web."}
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              void testNotificationSound().then((played) => {
                if (!played)
                  toast.info(
                    "Chưa phát được âm thanh. Hãy bật âm thanh và kiểm tra âm lượng thiết bị rồi thử lại."
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
                      ? "Đang nhận thông báo khi chuyển ứng dụng hoặc đóng tab."
                      : "Bấm Bật và chọn Cho phép để nhận khi dùng ứng dụng khác."}
          </p>
          <Button
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
          <p className="text-xs text-muted-foreground">
            Khi bật thông báo nền, âm báo tin mới dùng âm thanh hệ thống, phụ
            thuộc âm lượng và chế độ Im lặng/Không làm phiền của thiết bị.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
