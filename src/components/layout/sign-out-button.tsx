"use client"

import { LogOutIcon } from "lucide-react"
import { useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { signOutAction } from "@/modules/auth/actions"

export function SignOutButton({
  className,
  inMenu = false,
}: {
  className?: string
  inMenu?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const label = isPending ? "Đang đăng xuất..." : "Đăng xuất"
  const signOut = () =>
    startTransition(async () => {
      try {
        await signOutAction()
      } catch {
        toast.error("Không thể đăng xuất. Vui lòng thử lại.")
      }
    })

  if (inMenu) {
    return (
      <DropdownMenuItem
        className={className}
        closeOnClick={false}
        disabled={isPending}
        onClick={signOut}
      >
        <LogOutIcon aria-hidden="true" /> {label}
      </DropdownMenuItem>
    )
  }

  return (
    <Button
      className={cn(className)}
      aria-label={label}
      tooltip="Đăng xuất"
      disabled={isPending}
      type="button"
      variant="outline"
      onClick={signOut}
    >
      <LogOutIcon aria-hidden="true" /> {label}
    </Button>
  )
}
