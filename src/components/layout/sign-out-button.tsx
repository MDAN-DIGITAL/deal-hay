"use client"

import { LogOutIcon } from "lucide-react"
import { useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { signOutAction } from "@/modules/auth/actions"

export function SignOutButton({ className }: { className?: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      className={cn(className)}
      aria-label={isPending ? "Đang đăng xuất..." : "Đăng xuất"}
      tooltip="Đăng xuất"
      disabled={isPending}
      type="button"
      variant="outline"
      onClick={() =>
        startTransition(async () => {
          try {
            await signOutAction()
          } catch {
            toast.error("Không thể đăng xuất. Vui lòng thử lại.")
          }
        })
      }
    >
      <LogOutIcon /> {isPending ? "Đang đăng xuất..." : "Đăng xuất"}
    </Button>
  )
}
