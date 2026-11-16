"use client"

import Link from "next/link"
import { useTransition } from "react"
import { HeartIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react"
import { toast } from "sonner"

import { ApiError } from "@/api/client"
import { useSession } from "@/components/session-provider"
import { Button } from "@/components/ui/button"
import { getAuthPageHref } from "@/lib/auth-redirect"
import { reactShopAction, toggleFollowAction } from "@/modules/public/actions"
import type { PublicShop } from "@/types/catalog"

export function ShopEngagement({
  shop,
  returnTo = `/shops/${shop.code}`,
}: {
  shop: PublicShop
  returnTo?: string
}) {
  const [isPending, startTransition] = useTransition()
  const { user, loading } = useSession()
  const disabled = loading || isPending || !shop.viewer.can_interact
  const runAction = (action: () => Promise<void>, message: string) =>
    startTransition(async () => {
      try {
        await action()
        toast.success(message)
      } catch (error) {
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Không thể cập nhật tương tác. Vui lòng thử lại."
        )
      }
    })

  return (
    <div className="min-w-0 space-y-3">
      <div className="grid min-w-0 grid-cols-3 gap-2">
        <Button
          aria-label={`${shop.viewer.is_following ? "Bỏ theo dõi" : "Theo dõi"} cửa hàng, ${shop.followers_count} người theo dõi`}
          aria-pressed={shop.viewer.is_following}
          className="h-auto min-h-12 min-w-0 flex-col gap-1 px-2 py-2 whitespace-normal sm:flex-row"
          disabled={disabled}
          type="button"
          variant={shop.viewer.is_following ? "secondary" : "outline"}
          onClick={() =>
            runAction(
              () => toggleFollowAction(shop.code, shop.viewer.is_following),
              shop.viewer.is_following
                ? "Đã bỏ theo dõi cửa hàng."
                : "Đã theo dõi cửa hàng."
            )
          }
        >
          <HeartIcon />
          <span className="min-w-0 text-xs leading-5">
            {shop.viewer.is_following ? "Đã theo dõi" : "Theo dõi"}{" "}
            <span className="tabular-nums">{shop.followers_count}</span>
          </span>
        </Button>
        {(["like", "dislike"] as const).map((reaction) => {
          const selected = shop.viewer.reaction === reaction
          const positive = reaction === "like"
          const Icon = positive ? ThumbsUpIcon : ThumbsDownIcon
          const count = positive ? shop.likes_count : shop.dislikes_count
          return (
            <Button
              key={reaction}
              aria-label={`${selected ? "Bỏ " : ""}${positive ? "thích" : "không thích"} cửa hàng, ${count} lượt`}
              aria-pressed={selected}
              className="h-auto min-h-12 min-w-0 flex-col gap-1 px-2 py-2 whitespace-normal sm:flex-row"
              disabled={disabled}
              type="button"
              variant={selected ? "secondary" : "outline"}
              onClick={() =>
                runAction(
                  () => reactShopAction(shop.code, selected ? null : reaction),
                  selected ? "Đã bỏ phản hồi của bạn." : "Đã ghi nhận phản hồi."
                )
              }
            >
              <Icon />
              <span className="min-w-0 text-xs leading-5">
                {positive ? "Thích" : "Không thích"}{" "}
                <span className="tabular-nums">{count}</span>
              </span>
            </Button>
          )
        })}
      </div>
      {!loading && !user ? (
        <p className="text-sm leading-6 text-muted-foreground">
          <Link
            className="font-medium text-primary underline-offset-4 hover:underline"
            href={getAuthPageHref("/sign-in", returnTo)}
          >
            Đăng nhập
          </Link>{" "}
          để theo dõi và thích cửa hàng.
        </p>
      ) : null}
      {user?.user_code === shop.code ? (
        <p className="text-sm text-muted-foreground">
          Đây là cửa hàng của bạn.
        </p>
      ) : null}
    </div>
  )
}
