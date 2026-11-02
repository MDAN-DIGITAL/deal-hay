"use client"

import { useState, type ComponentProps } from "react"
import { EyeIcon, EyeOffIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function PasswordInput({
  className,
  disabled,
  ...props
}: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        {...props}
        className={cn("pr-11", className)}
        disabled={disabled}
        type={visible ? "text" : "password"}
      />
      <Button
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        aria-pressed={visible}
        className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
        type="button"
        size="icon-sm"
        variant="ghost"
      >
        {visible ? (
          <EyeOffIcon className="size-4" />
        ) : (
          <EyeIcon className="size-4" />
        )}
      </Button>
    </div>
  )
}
