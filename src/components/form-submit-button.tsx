"use client"

import type { ReactNode } from "react"
import { useFormStatus } from "react-dom"
import { SaveIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

type FormSubmitButtonProps = {
  idleText: string
  pendingText?: string
  variant?:
    "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
  className?: string
  pending?: boolean
  disabled?: boolean
  startIcon?: ReactNode
}

export function FormSubmitButton({
  idleText,
  pendingText,
  variant,
  className,
  pending,
  disabled,
  startIcon = <SaveIcon />,
}: FormSubmitButtonProps) {
  const { pending: nativePending } = useFormStatus()
  const isPending = pending ?? nativePending

  return (
    <Button
      type="submit"
      variant={variant}
      disabled={disabled || isPending}
      className={className}
      aria-busy={isPending}
      startIcon={
        isPending ? (
          <Spinner role={undefined} aria-label={undefined} />
        ) : (
          startIcon
        )
      }
    >
      {isPending ? (pendingText ?? "Đang xử lý...") : idleText}
    </Button>
  )
}
