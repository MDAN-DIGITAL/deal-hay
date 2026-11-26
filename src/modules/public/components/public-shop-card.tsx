import Link from "next/link"
import {
  ArrowUpRightIcon,
  HeartIcon,
  MapPinIcon,
  PackageIcon,
  ThumbsUpIcon,
  UsersIcon,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Item } from "@/components/ui/item"
import { UserAvatar } from "@/components/user-avatar"
import { cn } from "@/lib/utils"
import type { FeaturedShop } from "@/types/catalog"

function ShopMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HeartIcon
  label: string
  value: number | string
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <Icon aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
      <span className="truncate">
        <span className="font-medium text-foreground">{value}</span> {label}
      </span>
    </span>
  )
}

export function PublicShopCard({
  shop,
  compact = false,
}: {
  shop: FeaturedShop
  compact?: boolean
}) {
  const href = `/shops/${encodeURIComponent(shop.code)}`
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar
          className={cn(compact && "size-9")}
          name={shop.name}
          src={shop.avatar_url}
        />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-medium wrap-anywhere group-hover:text-primary">
            {shop.name}
          </h3>
        </div>
        <ArrowUpRightIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      </div>
      <p
        className={cn(
          "leading-5 wrap-anywhere text-muted-foreground",
          compact ? "line-clamp-1 text-xs" : "line-clamp-2 min-h-10 text-sm"
        )}
      >
        {shop.description?.trim() || "Shop chưa cập nhật mô tả."}
      </p>
      {shop.address ? (
        <p
          className={cn(
            "flex items-start gap-2 text-xs text-muted-foreground",
            compact && "items-center"
          )}
        >
          <MapPinIcon
            aria-hidden="true"
            className={cn("size-3.5 shrink-0", !compact && "mt-0.5")}
          />
          <span
            className={cn(
              "wrap-anywhere",
              compact ? "truncate" : "line-clamp-2"
            )}
          >
            {shop.address}
          </span>
        </p>
      ) : (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <MapPinIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>Shop chưa cập nhật địa chỉ.</span>
        </p>
      )}
      <div
        className={cn(
          "mt-auto grid grid-cols-2 border-t",
          compact ? "gap-x-2 gap-y-1.5 pt-2" : "gap-x-3 gap-y-2 pt-3"
        )}
      >
        <ShopMetric
          icon={PackageIcon}
          label="sản phẩm"
          value={shop.products_count ?? 0}
        />
        <ShopMetric
          icon={UsersIcon}
          label="theo dõi"
          value={shop.followers_count ?? 0}
        />
        <ShopMetric
          icon={HeartIcon}
          label="lượt thích"
          value={shop.likes_count ?? 0}
        />
        <ShopMetric
          icon={ThumbsUpIcon}
          label="hài lòng"
          value={
            shop.satisfaction_rate == null
              ? "Chưa có"
              : `${shop.satisfaction_rate}%`
          }
        />
      </div>
    </>
  )

  if (compact) {
    return (
      <Item
        render={<Link href={href} />}
        size="sm"
        variant="outline"
        className="group flex-col items-stretch gap-2.5 bg-background"
      >
        {content}
      </Item>
    )
  }

  return (
    <Link href={href} className="group block min-w-0">
      <Card size="sm" className="h-full">
        <CardContent className="h-full gap-3">{content}</CardContent>
      </Card>
    </Link>
  )
}
