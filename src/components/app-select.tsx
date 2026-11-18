"use client"

import type { ComponentProps, FocusEventHandler, ReactNode } from "react"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type AppSelectOption = {
  label: string
  value: string
  disabled?: boolean
}

type AppSelectProps = Pick<
  ComponentProps<typeof SelectTrigger>,
  | "id"
  | "ref"
  | "aria-label"
  | "aria-labelledby"
  | "aria-describedby"
  | "aria-invalid"
> & {
  options: readonly AppSelectOption[]
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string) => void
  onBlur?: FocusEventHandler<HTMLElement>
  startIcon?: ReactNode
  name?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  size?: "sm" | "default"
}

export function AppSelect({
  options,
  value,
  defaultValue,
  onValueChange,
  onBlur,
  startIcon,
  name,
  placeholder = "Chọn một tùy chọn",
  disabled,
  required,
  className,
  size,
  ...triggerProps
}: AppSelectProps) {
  return (
    <Select
      disabled={disabled}
      required={required}
      items={options}
      name={name}
      value={value === undefined ? undefined : value || null}
      defaultValue={defaultValue || null}
      onValueChange={(nextValue) => onValueChange?.(nextValue ?? "")}
    >
      <SelectTrigger
        className={cn("w-full min-w-0", className)}
        size={size}
        onBlur={onBlur}
        {...triggerProps}
      >
        {startIcon && (
          <span
            aria-hidden="true"
            className="inline-flex text-muted-foreground"
          >
            {startIcon}
          </span>
        )}
        <SelectValue className="min-w-0" placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              disabled={option.disabled}
              value={option.value}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
