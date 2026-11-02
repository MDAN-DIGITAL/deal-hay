"use client"

import { useApiQuery, QueryPlaceholder } from "@/hooks/use-api-query"
import Link from "next/link"
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  MapPinIcon,
  MessageCircleIcon,
  PackageSearchIcon,
  ShoppingBagIcon,
  SparklesIcon,
  StoreIcon,
} from "lucide-react"

import { getHome } from "@/api/catalog/queries"
import { EmptyState } from "@/components/layout/empty-state"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { StatCard } from "@/components/ui/section"
import { UserAvatar } from "@/components/user-avatar"
import { ProductCard } from "@/modules/public/components/product-card"

export function HomePageContainer({ category }: { category?: string }) {
  const { data: data, error } = useApiQuery(
    JSON.stringify(["home", category]),
    () => getHome(category)
  )
  if (!data) return <QueryPlaceholder error={error} />
  const activeCategory = data.filters.category

  return (
    <div className="space-y-10">
      <Card className="py-0">
        <CardContent className="grid gap-8 py-7 sm:py-10 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
          <div className="space-y-6">
            <Badge className="w-fit" variant="secondary">
              <SparklesIcon /> Deal mới được cập nhật mỗi ngày
            </Badge>
            <div className="max-w-3xl space-y-4">
              <h1 className="font-heading text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
                Tìm đúng món đồ.
                <br />
                <span className="text-primary">Chốt đúng deal hay.</span>
              </h1>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                Khám phá sản phẩm từ nhiều gian hàng, xem đánh giá thật và trao
                đổi trực tiếp với người bán trước khi quyết định.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="#san-pham" className={buttonVariants({ size: "lg" })}>
                Khám phá sản phẩm <ArrowRightIcon data-icon="inline-end" />
              </Link>
              <Link
                href="/sell"
                className={buttonVariants({
                  size: "lg",
                  variant: "outline",
                })}
              >
                Bắt đầu bán hàng
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-1">
            {[
              {
                icon: ShoppingBagIcon,
                value: data.products.total,
                label: "Sản phẩm đang bán",
              },
              {
                icon: StoreIcon,
                value: data.featuredShops.length,
                label: "Gian hàng nổi bật",
              },
              {
                icon: MessageCircleIcon,
                value: "Trực tiếp",
                label: "Trao đổi với người bán",
              },
            ].map((item) => (
              <StatCard
                compact
                key={item.label}
                icon={<item.icon />}
                value={item.value}
                label={item.label}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-5" aria-labelledby="category-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-primary">
              Mua sắm theo nhu cầu
            </p>
            <h2
              id="category-heading"
              className="font-heading text-2xl font-semibold tracking-tight"
            >
              Danh mục nổi bật
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Chọn danh mục để thu hẹp kết quả
          </p>
        </div>
        <Card size="sm">
          <CardContent className="flex-row flex-wrap">
            <Link
              href="/"
              className={buttonVariants({
                variant: !activeCategory ? "default" : "outline",
              })}
            >
              <PackageSearchIcon /> Tất cả
            </Link>
            {data.categories.map((item) => (
              <Link
                key={item}
                href={`/?category=${encodeURIComponent(item)}`}
                className={buttonVariants({
                  variant: activeCategory === item ? "default" : "outline",
                })}
              >
                {item}
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-5" aria-labelledby="shops-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-medium text-primary">
              Được cộng đồng quan tâm
            </p>
            <h2
              id="shops-heading"
              className="font-heading text-2xl font-semibold tracking-tight"
            >
              Gian hàng nổi bật
            </h2>
          </div>
          <Badge variant="secondary">
            {data.featuredShops.length} gian hàng
          </Badge>
        </div>

        {data.featuredShops.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.featuredShops.map((shop) => (
              <Link
                key={shop.code}
                className="group"
                href={`/shops/${shop.code}`}
              >
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        className="size-12 ring-2 ring-primary/10"
                        name={shop.name}
                        size="lg"
                        src={shop.avatar_url}
                      />
                      <div className="min-w-0">
                        <CardTitle className="flex items-center gap-1.5 truncate">
                          {shop.name}
                          <BadgeCheckIcon className="size-4 shrink-0 text-primary" />
                        </CardTitle>
                        <CardDescription>
                          {shop.products_count} sản phẩm
                        </CardDescription>
                      </div>
                    </div>
                    <CardAction>
                      <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <Separator />
                    <p className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPinIcon className="mt-0.5 size-4 shrink-0" />
                      {shop.address || "Cửa hàng chưa cập nhật địa chỉ."}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Chưa có gian hàng nổi bật"
            description="Các gian hàng nổi bật sẽ xuất hiện tại đây khi có dữ liệu."
          />
        )}
      </section>

      <section
        id="san-pham"
        className="scroll-mt-28 space-y-5"
        aria-labelledby="products-heading"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-primary">
              {activeCategory || "Gợi ý dành cho bạn"}
            </p>
            <h2
              id="products-heading"
              className="font-heading text-2xl font-semibold tracking-tight"
            >
              Sản phẩm mới lên kệ
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {data.products.total} sản phẩm phù hợp
          </p>
        </div>

        {data.products.data.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {data.products.data.map((product) => (
              <ProductCard
                key={product.id}
                eyebrow={product.shop.name}
                href={`/shops/${product.shop.code}/products/${product.slug}`}
                product={product}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Chưa tìm thấy sản phẩm"
            description="Danh mục này chưa có sản phẩm công khai. Hãy thử chọn một danh mục khác."
            action={
              <Link href="/" className={buttonVariants()}>
                Xem tất cả sản phẩm
              </Link>
            }
          />
        )}
      </section>
    </div>
  )
}
