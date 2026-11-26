"use client"

import Image from "next/image"
import Link from "next/link"
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CheckIcon,
  ChevronDownIcon,
  LayoutGridIcon,
  ShoppingBagIcon,
  StoreIcon,
  TicketPercentIcon,
} from "lucide-react"

import { getHome } from "@/api/catalog/queries"
import type { HomeResponse } from "@/api/catalog/types"
import { DataPagination } from "@/components/layout/data-pagination"
import { EmptyState } from "@/components/layout/empty-state"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { QueryPlaceholder, useApiQuery } from "@/hooks/use-api-query"
import { cn } from "@/lib/utils"
import { ProductCard } from "@/modules/public/components/product-card"
import type { HomeProduct } from "@/types/catalog"

const shoppingSteps = [
  {
    icon: ShoppingBagIcon,
    title: "Chọn sản phẩm",
    description: "Xem thông tin rồi chọn sản phẩm phù hợp.",
  },
  {
    icon: TicketPercentIcon,
    title: "Chọn ưu đãi từ shop",
    description: "Áp dụng mã giảm giá phù hợp với sản phẩm.",
  },
  {
    icon: BadgeCheckIcon,
    title: "Kiểm tra và đặt hàng",
    description: "Xác nhận giá và thông tin giao hàng.",
  },
]

function catalogHref(search: string, category = "") {
  const params = new URLSearchParams()
  if (search) params.set("q", search)
  if (category) params.set("category", category)
  const query = params.toString()
  return query ? `/?${query}#san-pham` : "/#san-pham"
}

function productHref(product: HomeProduct) {
  return `/shops/${encodeURIComponent(product.shop.code)}/products/${encodeURIComponent(product.slug)}`
}

function CatalogCategories({
  categories,
  category,
  search,
}: {
  categories: string[]
  category: string
  search: string
}) {
  const options = ["", ...categories]

  return (
    <nav aria-label="Danh mục sản phẩm" className="min-w-0">
      <Card size="sm" className="gap-3 py-2.5 lg:py-4">
        <CardHeader className="hidden lg:grid">
          <CardTitle as="h2" className="flex items-center gap-2">
            <LayoutGridIcon
              aria-hidden="true"
              className="size-4 text-primary"
            />
            Danh mục
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-row flex-wrap items-center justify-between gap-2 px-2.5 lg:flex-col lg:items-stretch">
          <div className="hidden max-h-96 flex-col gap-1 overflow-y-auto p-0.5 lg:flex">
            {options.map((item) => (
              <Link
                key={item}
                href={catalogHref(search, item)}
                prefetch={false}
                aria-current={item === category ? "true" : undefined}
                className={buttonVariants({
                  size: "sm",
                  variant: item === category ? "secondary" : "ghost",
                  className: "min-w-0 justify-start",
                })}
              >
                <span className="truncate">{item || "Tất cả sản phẩm"}</span>
              </Link>
            ))}
          </div>
          <div className="max-w-full min-w-0 lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="sm"
                    variant={category ? "secondary" : "outline"}
                    className="max-w-full min-w-0 max-sm:px-2"
                    aria-label={
                      category ? `Danh mục hiện tại: ${category}` : "Danh mục"
                    }
                  />
                }
              >
                <span className="truncate">{category || "Danh mục"}</span>
                <ChevronDownIcon aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 max-w-[calc(100vw-2rem)]">
                {options.map((item) => (
                  <DropdownMenuItem
                    key={item}
                    render={
                      <Link
                        href={catalogHref(search, item)}
                        aria-current={item === category ? "true" : undefined}
                        prefetch={false}
                      />
                    }
                  >
                    <span className="min-w-0 flex-1 wrap-anywhere">
                      {item || "Tất cả sản phẩm"}
                    </span>
                    {item === category ? (
                      <CheckIcon aria-hidden="true" />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Separator className="hidden lg:block" />
          <Link
            href="/shops"
            className={buttonVariants({
              size: "sm",
              variant: "outline",
              className: "justify-start max-sm:px-2",
            })}
          >
            <StoreIcon aria-hidden="true" />
            Xem toàn bộ shop
            <ArrowRightIcon
              aria-hidden="true"
              className="ml-auto hidden lg:block"
            />
          </Link>
        </CardContent>
      </Card>
    </nav>
  )
}

export function HomePageContainer({
  category,
  page,
  search,
  initialData,
  initialError,
}: {
  category?: string
  page?: string
  search?: string
  initialData?: HomeResponse
  initialError?: string
}) {
  const canPersonalize = !category && !search
  const query = useApiQuery(
    JSON.stringify(["home", category, page, search]),
    () => getHome(category, page, search),
    {
      initialData,
      initialError,
      revalidateOnMount: canPersonalize ? "authenticated" : false,
      sessionSensitive: canPersonalize,
    }
  )

  const data = query.data ?? initialData
  if (!data) return <QueryPlaceholder error={query.error} />

  const activeCategory = data.filters.category
  const activeSearch = data.filters.q ?? search ?? ""
  const filtered = Boolean(activeCategory || activeSearch)
  const products = data.products
  const isFirstBrowsePage = !filtered && products.current_page === 1
  const singleProduct = products.total === 1

  return (
    <div
      className="min-w-0 space-y-6 sm:space-y-8"
      data-catalog-content="ready"
    >
      {isFirstBrowsePage ? (
        <Card
          role="region"
          aria-labelledby="home-banner-title"
          className="border-primary/15 bg-accent/60 py-0"
        >
          <CardContent className="grid items-center p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.55fr)] sm:gap-6 sm:px-7 sm:py-3 lg:px-9">
            <div className="space-y-3">
              <CardHeader className="gap-1.5 px-0">
                <CardTitle
                  as="h1"
                  id="home-banner-title"
                  className="text-xl leading-tight sm:text-2xl lg:text-3xl"
                >
                  Mua sắm thông minh, tiết kiệm hơn
                </CardTitle>
                <CardDescription className="max-w-md leading-relaxed sm:text-base">
                  Chọn sản phẩm và áp dụng ưu đãi do cửa hàng cung cấp.
                </CardDescription>
              </CardHeader>
              <Link href="#san-pham" className={buttonVariants({ size: "sm" })}>
                Khám phá sản phẩm
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </div>
            <Image
              src="/dealhay-home-banner.webp"
              alt=""
              width={768}
              height={384}
              loading="eager"
              unoptimized
              className="hidden h-auto w-full max-w-88 justify-self-end sm:block"
            />
          </CardContent>
        </Card>
      ) : null}

      <div
        id="san-pham"
        className="grid min-w-0 scroll-mt-32 items-start gap-4 sm:scroll-mt-20 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6"
      >
        <CatalogCategories
          categories={data.categories}
          category={activeCategory}
          search={activeSearch}
        />
        <section
          className="min-w-0 space-y-4"
          aria-labelledby="products-heading"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div className="min-w-0 space-y-1">
              <CardTitle
                as={isFirstBrowsePage ? "h2" : "h1"}
                id="products-heading"
                className="font-heading text-xl font-semibold tracking-tight wrap-anywhere sm:text-2xl"
              >
                {activeSearch
                  ? `Kết quả cho “${activeSearch}”`
                  : activeCategory ||
                    (data.personalized
                      ? "Sản phẩm dành cho bạn"
                      : "Tất cả sản phẩm")}
              </CardTitle>
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {products.from && products.to && products.last_page > 1
                  ? `${products.from}–${products.to} trong ${products.total} sản phẩm`
                  : `${products.total} sản phẩm`}
              </p>
            </div>
            {filtered ? (
              <Link
                href="/#san-pham"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Xóa bộ lọc
              </Link>
            ) : null}
          </div>

          {products.data.length > 0 ? (
            <>
              <div
                className={cn(
                  "grid gap-3 sm:gap-4",
                  !singleProduct && "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4"
                )}
              >
                {products.data.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    cartShopCode={product.shop.code}
                    layout={singleProduct ? "single" : "grid"}
                    eyebrow={product.shop.name}
                    href={productHref(product)}
                    priorityImage={index === 0}
                    product={product}
                  />
                ))}
              </div>
              <DataPagination
                currentPage={products.current_page}
                lastPage={products.last_page}
                anchor="san-pham"
              />
            </>
          ) : (
            <EmptyState
              title={
                products.total > 0
                  ? "Trang này không có sản phẩm"
                  : filtered
                    ? "Chưa tìm thấy sản phẩm"
                    : "Chưa có sản phẩm"
              }
              description={
                products.total > 0
                  ? "Quay lại trang đầu để xem các sản phẩm phù hợp."
                  : filtered
                    ? "Thử từ khóa ngắn hơn hoặc chọn danh mục khác."
                    : "Các sản phẩm đang bán sẽ xuất hiện tại đây."
              }
              action={
                products.total > 0 ? (
                  <Link
                    href={catalogHref(activeSearch, activeCategory)}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Về trang đầu
                  </Link>
                ) : undefined
              }
            />
          )}
        </section>
      </div>

      {isFirstBrowsePage ? (
        <Accordion
          id="cach-thuc-hoat-dong"
          className="scroll-mt-32 border-t sm:scroll-mt-20"
        >
          <AccordionItem value="shopping-guide">
            <AccordionTrigger>Cách mua hàng</AccordionTrigger>
            <AccordionContent>
              <p className="text-muted-foreground">
                Chọn sản phẩm và áp dụng ưu đãi do cửa hàng cung cấp.
              </p>
              <ItemGroup className="grid gap-2 md:grid-cols-3">
                {shoppingSteps.map(({ icon: Icon, title, description }) => (
                  <Item
                    key={title}
                    size="sm"
                    className="flex-nowrap items-start"
                  >
                    <ItemMedia variant="icon" className="text-primary">
                      <Icon aria-hidden="true" />
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle>{title}</ItemTitle>
                      <ItemDescription>{description}</ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </div>
  )
}
