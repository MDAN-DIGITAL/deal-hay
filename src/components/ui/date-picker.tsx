"use client"

import { useId, useState, type ComponentProps } from "react"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatLocalDateTime, parseLocalDateTime } from "@/lib/date-time"
import { cn } from "@/lib/utils"

type DatePickerProps = Pick<
  ComponentProps<typeof Button>,
  | "id"
  | "ref"
  | "aria-label"
  | "aria-labelledby"
  | "aria-describedby"
  | "aria-invalid"
  | "onBlur"
> & {
  name?: string
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  withTime?: boolean
  placeholder?: string
  className?: string
}

const hours = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, "0")
)
const minutes = Array.from({ length: 60 }, (_, minute) =>
  String(minute).padStart(2, "0")
)

/** Form values use local ISO components, never a UTC date sliced from toISOString(). */
export function DatePicker({
  name,
  value,
  defaultValue = "",
  onValueChange,
  disabled = false,
  withTime = false,
  placeholder = withTime ? "Chọn ngày và giờ" : "Chọn ngày",
  className,
  ...triggerProps
}: DatePickerProps) {
  const prefix = useId()
  const [open, setOpen] = useState(false)
  const [internalValue, setInternalValue] = useState(defaultValue)
  const [month, setMonth] = useState<Date>()
  const currentValue = value ?? internalValue
  const selected = parseLocalDateTime(currentValue, withTime)
  const hour = selected ? String(selected.getHours()).padStart(2, "0") : "00"
  const minute = selected
    ? String(selected.getMinutes()).padStart(2, "0")
    : "00"
  const dayValue = selected ? formatLocalDateTime(selected, false) : ""

  const changeValue = (next: string) => {
    if (disabled) return
    if (value === undefined) setInternalValue(next)
    onValueChange?.(next)
  }
  const selectDay = (day: Date | undefined) => {
    if (!day) return
    setMonth(day)
    const localDay = formatLocalDateTime(day, false)
    // If a retained clock time does not exist on a DST transition, start at midnight.
    const next = withTime
      ? parseLocalDateTime(`${localDay}T${hour}:${minute}`)
        ? `${localDay}T${hour}:${minute}`
        : `${localDay}T00:00`
      : localDay
    changeValue(next)
    if (!withTime) setOpen(false)
  }

  return (
    <>
      <input
        type="hidden"
        name={name}
        value={currentValue}
        disabled={disabled}
      />
      <Popover
        open={open && !disabled}
        onOpenChange={(next) => {
          if (next) setMonth(selected ?? new Date())
          setOpen(next)
        }}
      >
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              data-slot="date-picker"
              data-empty={!selected}
              className={cn(
                "w-full min-w-0 justify-start px-3 text-left text-base font-normal data-[empty=true]:text-muted-foreground md:text-sm",
                className
              )}
              {...triggerProps}
            />
          }
        >
          <CalendarIcon className="shrink-0 text-muted-foreground" />
          <span className="truncate">
            {selected
              ? new Intl.DateTimeFormat("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  ...(withTime
                    ? {
                        hour: "2-digit",
                        minute: "2-digit",
                        hourCycle: "h23" as const,
                      }
                    : {}),
                }).format(selected)
              : placeholder}
          </span>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          positionMethod="fixed"
          sticky
          collisionAvoidance={{ side: "shift", align: "shift" }}
          collisionPadding={16}
          aria-label={withTime ? "Chọn ngày và giờ" : "Chọn ngày"}
          className="max-h-[calc(100dvh-2rem)] w-[min(320px,calc(100vw-2rem))] gap-0 overflow-x-hidden overflow-y-auto p-0"
        >
          <Calendar
            mode="single"
            selected={selected}
            month={month}
            onMonthChange={setMonth}
            onSelect={selectDay}
            disabled={disabled}
            autoFocus
            className="w-full [--cell-size:--spacing(9)]"
            classNames={{ root: "w-full" }}
          />
          {withTime ? (
            <div className="grid grid-cols-2 gap-3 border-t px-3 py-3">
              {(
                [
                  {
                    part: "hour",
                    label: "Giờ",
                    options: hours,
                    selected: hour,
                  },
                  {
                    part: "minute",
                    label: "Phút",
                    options: minutes,
                    selected: minute,
                  },
                ] as const
              ).map((time) => (
                <div key={time.part} className="space-y-1.5">
                  <Label htmlFor={`${prefix}-${time.part}`}>{time.label}</Label>
                  <Select
                    value={time.selected}
                    disabled={disabled || !selected}
                    onValueChange={(next) => {
                      if (next && selected)
                        changeValue(
                          `${dayValue}T${time.part === "hour" ? next : hour}:${time.part === "minute" ? next : minute}`
                        )
                    }}
                  >
                    <SelectTrigger
                      id={`${prefix}-${time.part}`}
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      className="max-h-60 min-w-(--anchor-width)"
                      alignItemWithTrigger={false}
                    >
                      <SelectGroup>
                        {time.options.map((option) => (
                          <SelectItem
                            key={option}
                            value={option}
                            disabled={
                              !parseLocalDateTime(
                                `${dayValue}T${time.part === "hour" ? option : hour}:${time.part === "minute" ? option : minute}`
                              )
                            }
                          >
                            {option}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-1 border-t p-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => selectDay(new Date())}
            >
              Hôm nay
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || !selected}
              onClick={() => changeValue("")}
            >
              Xóa
            </Button>
            <Button
              type="button"
              size="sm"
              className="ml-auto"
              onClick={() => setOpen(false)}
            >
              Xong
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}
