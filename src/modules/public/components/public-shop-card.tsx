import Link from "next/link"
import { ArrowUpRightIcon, MapPinIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { UserAvatar } from "@/components/user-avatar"
import type { FeaturedShop } from "@/types/catalog"

export function PublicShopCard({ shop }: { shop: FeaturedShop }) {
  return (
    <Link
      href={`/shops/${encodeURIComponent(shop.code)}`}
      className="group block min-w-0"
    >
      <Card size="sm" className="h-full">
        <CardContent className="gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar name={shop.name} src={shop.avatar_url} />
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 font-medium wrap-anywhere group-hover:text-primary">
                {shop.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                {shop.products_count} sản phẩm
              </p>
            </div>
            <ArrowUpRightIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
          </div>
          {shop.address ? (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <MapPinIcon
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0"
              />
              <span className="line-clamp-2 wrap-anywhere">{shop.address}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  )
}
