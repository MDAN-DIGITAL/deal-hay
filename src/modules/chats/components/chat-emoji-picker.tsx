"use client"

import { useState, type RefObject } from "react"
import { SmileIcon } from "lucide-react"

import { InputGroupButton } from "@/components/ui/input-group"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

const EMOJI = [
  ["😀", "Vui vẻ"],
  ["😃", "Cười tươi"],
  ["😄", "Rất vui"],
  ["😁", "Cười rạng rỡ"],
  ["😆", "Cười lớn"],
  ["😂", "Cười ra nước mắt"],
  ["🤣", "Cười lăn lộn"],
  ["😊", "Mỉm cười"],
  ["😉", "Nháy mắt"],
  ["😍", "Yêu thích"],
  ["🥰", "Trìu mến"],
  ["😘", "Gửi nụ hôn"],
  ["😎", "Đeo kính râm"],
  ["🤔", "Suy nghĩ"],
  ["😅", "Cười ngượng"],
  ["🥹", "Xúc động"],
  ["😢", "Buồn"],
  ["😭", "Khóc"],
  ["😮", "Ngạc nhiên"],
  ["😴", "Buồn ngủ"],
  ["👍", "Đồng ý"],
  ["👎", "Không đồng ý"],
  ["👏", "Vỗ tay"],
  ["🙌", "Hoan hô"],
  ["🙏", "Cảm ơn"],
  ["🤝", "Bắt tay"],
  ["👋", "Vẫy tay"],
  ["👌", "Được rồi"],
  ["❤️", "Trái tim"],
  ["💖", "Trái tim lấp lánh"],
  ["💯", "Một trăm điểm"],
  ["🔥", "Ngọn lửa"],
  ["🎉", "Chúc mừng"],
  ["✨", "Lấp lánh"],
  ["✅", "Hoàn thành"],
  ["🌟", "Ngôi sao"],
  ["🎁", "Quà tặng"],
  ["🛍️", "Mua sắm"],
  ["📦", "Kiện hàng"],
  ["🚚", "Giao hàng"],
] as const

export function ChatEmojiPicker({
  disabled,
  focusTarget,
  onSelect,
}: {
  disabled?: boolean
  focusTarget: RefObject<HTMLTextAreaElement | null>
  onSelect: (emoji: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <InputGroupButton
            aria-label="Chọn emoji"
            disabled={disabled}
            size="icon-sm"
            type="button"
          />
        }
      >
        <SmileIcon />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-(--available-height) w-[min(22rem,calc(100vw-2rem))] gap-3 overflow-y-auto p-3"
        finalFocus={focusTarget}
        side="top"
      >
        <PopoverTitle>Emoji</PopoverTitle>
        <div className="grid grid-cols-8 gap-1">
          {EMOJI.map(([emoji, label]) => (
            <Button
              key={emoji}
              variant="ghost"
              size="icon"
              aria-label={label}
              className="aspect-square h-auto w-full min-w-0 p-0 text-2xl"
              disabled={disabled}
              title={label}
              type="button"
              onClick={() => {
                if (disabled) return
                onSelect(emoji)
                setOpen(false)
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  fontFamily:
                    '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
                }}
              >
                {emoji}
              </span>
            </Button>
          ))}
        </div>
        <PopoverDescription className="text-xs">
          Emoji hiển thị theo hệ điều hành. Mở bàn phím emoji hệ thống bằng
          Windows + . hoặc Ctrl + ⌘ + Space trên macOS; điện thoại dùng phím
          emoji trên bàn phím.
        </PopoverDescription>
      </PopoverContent>
    </Popover>
  )
}
