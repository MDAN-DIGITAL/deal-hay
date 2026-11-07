"use client"

import { useApiQuery, QueryPlaceholder } from "@/hooks/use-api-query"
import Link from "next/link"
import {
  BadgeCheckIcon,
  HeartIcon,
  MailIcon,
  MapPinIcon,
  PackageIcon,
  PhoneIcon,
  StarIcon,
  UsersIcon,
} from "lucide-react"

import { getShop } from "@/api/catalog/queries"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { StatCard } from "@/components/ui/section"
import { buttonVariants } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { ShopCategoryFilter } from "@/modules/public/components/shop-category-filter"
import { ShopOffers } from "@/modules/public/components/shop-offers"

export function ShopPageContainer({
  shopUserCode,
  category,
  page,
}: {
  shopUserCode: string
  category?: string
  page?: string
}) {
  const { data, error } = useApiQuery(
    JSON.stringify(["shop", shopUserCode, category, page]),
    () => getShop(shopUserCode, category, page)
  )
  if (!data) return <QueryPlaceholder error={error} />

  const shopStats = [
    { icon: PackageIcon, value: data.shop.products_count, label: "Sản phẩm" },
    {
      icon: UsersIcon,
      value: data.shop.followers_count,
      label: "Người theo dõi",
    },
    { icon: HeartIcon, value: data.shop.likes_count, label: "Lượt yêu thích" },
    {
      icon: StarIcon,
      value:
        data.shop.satisfaction_rate === null
          ? "—"
          : `${data.shop.satisfaction_rate}%`,
      label: "Hài lòng",
    },
  ]

  return (
    <div
      className="space-y-10"
      data-catalog-content="ready"
      data-ad-eligible={data.products.length > 0 ? "true" : undefined}
    >
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>
              Trang chủ
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{data.shop.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardContent className="gap-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-4">
              <UserAvatar
                className="size-16 sm:size-20"
                name={data.shop.name}
                size="lg"
                src={data.shop.avatar_url}
              />
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-2xl font-semibold sm:text-3xl">
                    {data.shop.name}
                  </h1>
                  <BadgeCheckIcon className="size-5 text-primary" />
                  <Badge variant="outline">
                    <span
                      className={
                        data.shop.is_online
                          ? "size-1.5 rounded-full bg-emerald-400"
                          : "size-1.5 rounded-full bg-muted-foreground/50"
                      }
                    />
                    {data.shop.is_online ? "Đang hoạt động" : "Ngoại tuyến"}
                  </Badge>
                </div>
                <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted-foreground">
                  <MapPinIcon className="mt-0.5 size-4 shrink-0" />{" "}
                  {data.shop.address || "Cửa hàng chưa cập nhật địa chỉ."}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {shopStats.map((stat) => (
              <StatCard
                key={stat.label}
                icon={<stat.icon />}
                value={stat.value}
                label={stat.label}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              className={buttonVariants({ variant: "outline", size: "sm" })}
              href={`mailto:${data.shop.email}`}
            >
              <MailIcon className="size-4" />
              {data.shop.email}
            </a>
            <a
              className={buttonVariants({ variant: "outline", size: "sm" })}
              href={`tel:${data.shop.phone_number}`}
            >
              <PhoneIcon className="size-4" />
              {data.shop.phone_number}
            </a>
          </div>
        </CardContent>
      </Card>

      <ShopOffers shopCode={shopUserCode} />

      <section className="space-y-5">
        <div>
          <p className="mb-1 text-sm font-medium text-primary">
            Danh mục cửa hàng
          </p>
          <h2 className="font-heading text-2xl font-semibold">
            Sản phẩm đang bán
          </h2>
        </div>
        <ShopCategoryFilter
          categories={data.categories}
          products={data.products}
          shopUserCode={shopUserCode}
        />
      </section>
    </div>
  )
}
