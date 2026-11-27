"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowUpDownIcon,
  ArrowRightIcon,
  BadgePercentIcon,
  BadgeCheckIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  CircleDollarSignIcon,
  LayoutGridIcon,
  PackageCheckIcon,
  PackageSearchIcon,
  RotateCcwIcon,
  RotateCwIcon,
  ShoppingBagIcon,
  SlidersHorizontalIcon,
  StarIcon,
  StoreIcon,
  TagIcon,
  TicketPercentIcon,
} from "lucide-react"

import { getHome } from "@/api/catalog/queries"
import type {
  CatalogSort,
  HomeCatalogFilters,
  HomeCatalogRequest,
  HomeResponse,
} from "@/api/catalog/types"
import { AppSelect } from "@/components/app-select"
import { EmptyState } from "@/components/layout/empty-state"
import NotFound from "@/components/layout/page-not-found"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { QueryPlaceholder, useApiQuery } from "@/hooks/use-api-query"
import { cn } from "@/lib/utils"
import { ProductCard } from "@/modules/public/components/product-card"
import { PublicShopCard } from "@/modules/public/components/public-shop-card"
import { catalogUrl } from "@/modules/public/lib/catalog-url"
import type { FeaturedShop, HomeProduct } from "@/types/catalog"

const CATEGORY_PREVIEW_COUNT = 4

function CatalogCategoryIcon({ category }: { category: string }) {
  const Icon = category ? TagIcon : LayoutGridIcon

  return <Icon aria-hidden="true" className="size-4 shrink-0" />
}

type CatalogFilterInput = {
  sort: CatalogSort
  minPrice?: number
  maxPrice?: number
  inStock: boolean
  onSale: boolean
  liked: boolean
}

const catalogSortOptions: Array<{ value: CatalogSort; label: string }> = [
  { value: "recommended", label: "Phù hợp nhất" },
  { value: "popular", label: "Phổ biến" },
  { value: "newest", label: "Mới nhất" },
  { value: "best_selling", label: "Bán chạy" },
  { value: "price_asc", label: "Giá thấp đến cao" },
  { value: "price_desc", label: "Giá cao đến thấp" },
]

const pricePresets = [
  { label: "Dưới 100.000đ", minPrice: undefined, maxPrice: 100_000 },
  { label: "100.000đ – 300.000đ", minPrice: 100_000, maxPrice: 300_000 },
  { label: "300.000đ – 500.000đ", minPrice: 300_000, maxPrice: 500_000 },
  { label: "Trên 500.000đ", minPrice: 500_000, maxPrice: undefined },
] satisfies Array<{
  label: string
  minPrice: number | undefined
  maxPrice: number | undefined
}>

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

function filterInput(filters: HomeCatalogFilters): CatalogFilterInput {
  return {
    sort: filters.sort,
    minPrice: filters.min_price ?? undefined,
    maxPrice: filters.max_price ?? undefined,
    inStock: filters.in_stock,
    onSale: filters.on_sale,
    liked: filters.liked,
  }
}

function activeProductFilterCount(filters: CatalogFilterInput) {
  return [
    filters.sort !== "recommended",
    filters.minPrice !== undefined || filters.maxPrice !== undefined,
    filters.inStock,
    filters.onSale,
    filters.liked,
  ].filter(Boolean).length
}

function productHref(product: HomeProduct) {
  return `/shops/${encodeURIComponent(product.shop.code)}/products/${encodeURIComponent(product.slug)}`
}

function CatalogCategories({
  categories,
  category,
  search,
  filters,
}: {
  categories: string[]
  category: string
  search: string
  filters: CatalogFilterInput
}) {
  const options = ["", ...categories]
  const previewOptions = options.slice(0, CATEGORY_PREVIEW_COUNT)
  const collapsedOptions =
    category && !previewOptions.includes(category)
      ? [...previewOptions.slice(0, -1), category]
      : previewOptions
  const hiddenOptions = options.filter(
    (item) => !collapsedOptions.includes(item)
  )
  const desktopCategoryOptions = collapsedOptions.map((item) => (
    <Button
      key={item}
      nativeButton={false}
      render={
        <Link
          href={catalogUrl({ category: item, search, filters })}
          prefetch={false}
          aria-current={item === category ? "page" : undefined}
        />
      }
      size="sm"
      variant={item === category ? "secondary" : "ghost"}
      className="w-full min-w-0 justify-start"
    >
      <CatalogCategoryIcon category={item} />
      <span className="truncate">{item || "Tất cả sản phẩm"}</span>
      {item === category ? (
        <CheckIcon aria-hidden="true" className="ml-auto" />
      ) : null}
    </Button>
  ))

  return (
    <nav aria-label="Danh mục sản phẩm" className="min-w-0">
      <Card size="sm" className="gap-3 py-2.5 lg:py-4">
        <CardHeader className="hidden border-b lg:grid">
          <CardTitle as="h2" className="flex items-center gap-2">
            <LayoutGridIcon
              aria-hidden="true"
              className="size-4 text-primary"
            />
            Danh mục
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-row flex-wrap items-center justify-between gap-2 lg:flex-col lg:items-stretch">
          <div className="hidden min-w-0 flex-col gap-1 lg:flex">
            {desktopCategoryOptions}
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
                <CatalogCategoryIcon category={category} />
                <span className="truncate">{category || "Danh mục"}</span>
                <ChevronDownIcon aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 max-w-[calc(100vw-2rem)]">
                {options.map((item) => (
                  <DropdownMenuItem
                    key={item}
                    render={
                      <Link
                        href={catalogUrl({ category: item, search, filters })}
                        aria-current={item === category ? "true" : undefined}
                        prefetch={false}
                      />
                    }
                  >
                    <CatalogCategoryIcon category={item} />
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
        </CardContent>
        {hiddenOptions.length > 0 ? (
          <CardFooter className="hidden border-t lg:flex">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    className="w-full justify-between"
                    size="sm"
                    type="button"
                    variant="ghost"
                  />
                }
              >
                Xem thêm ({hiddenOptions.length})
                <ArrowRightIcon aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="right"
                sideOffset={8}
                className="w-72 max-w-[calc(100vw-2rem)]"
              >
                {hiddenOptions.map((item) => (
                  <DropdownMenuItem
                    key={item}
                    render={
                      <Link
                        href={catalogUrl({ category: item, search, filters })}
                        prefetch={false}
                      />
                    }
                  >
                    <CatalogCategoryIcon category={item} />
                    <span className="min-w-0 flex-1 truncate">{item}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardFooter>
        ) : null}
      </Card>
    </nav>
  )
}

function priceValue(value: string): number | undefined {
  const normalized = value.trim()
  if (!normalized) return
  if (!/^\d+$/.test(normalized)) return Number.NaN
  const price = Number(normalized)
  return Number.isSafeInteger(price) && price <= 1_000_000_000
    ? price
    : Number.NaN
}

function CatalogFiltersCard({
  category,
  search,
  filters,
}: {
  category: string
  search: string
  filters: HomeCatalogFilters
}) {
  const router = useRouter()
  const current = filterInput(filters)
  const currentCount = activeProductFilterCount(current)
  const [draft, setDraft] = useState(current)
  const [minPrice, setMinPrice] = useState(
    current.minPrice === undefined ? "" : String(current.minPrice)
  )
  const [maxPrice, setMaxPrice] = useState(
    current.maxPrice === undefined ? "" : String(current.maxPrice)
  )
  const [priceError, setPriceError] = useState("")
  const [mobileOpen, setMobileOpen] = useState(currentCount > 0)
  const [isPending, startTransition] = useTransition()

  const navigate = (next: CatalogFilterInput) => {
    startTransition(() => {
      router.push(catalogUrl({ search, category, filters: next }))
    })
  }

  const apply = () => {
    const nextMin = priceValue(minPrice)
    const nextMax = priceValue(maxPrice)
    if (Number.isNaN(nextMin) || Number.isNaN(nextMax)) {
      setPriceError("Giá phải là số nguyên từ 0 đến 1 tỷ đồng.")
      return
    }
    if (nextMin !== undefined && nextMax !== undefined && nextMin > nextMax) {
      setPriceError("Giá tối thiểu không được lớn hơn giá tối đa.")
      return
    }
    setPriceError("")
    navigate({ ...draft, minPrice: nextMin, maxPrice: nextMax })
  }

  const reset = () => {
    const next: CatalogFilterInput = {
      sort: "recommended",
      inStock: false,
      onSale: false,
      liked: false,
    }
    setDraft(next)
    setMinPrice("")
    setMaxPrice("")
    setPriceError("")
    navigate(next)
  }

  return (
    <form
      aria-label="Bộ lọc sản phẩm"
      onSubmit={(event) => {
        event.preventDefault()
        apply()
      }}
    >
      <Card size="sm" className="gap-3 py-4">
        <CardHeader className="border-b">
          <CardTitle as="h2" className="flex items-center gap-2">
            <SlidersHorizontalIcon
              aria-hidden="true"
              className="size-4 text-primary"
            />
            Bộ lọc
            {currentCount > 0 ? (
              <Badge variant="secondary">{currentCount}</Badge>
            ) : null}
          </CardTitle>
          <CardAction className="lg:hidden">
            <Button
              size="xs"
              type="button"
              variant="ghost"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((value) => !value)}
            >
              {mobileOpen ? "Thu gọn" : "Mở bộ lọc"}
              <ChevronDownIcon
                aria-hidden="true"
                className={cn(
                  "transition-transform",
                  mobileOpen && "rotate-180"
                )}
              />
            </Button>
          </CardAction>
        </CardHeader>
        <div className={cn("contents", !mobileOpen && "max-lg:hidden")}>
          <CardContent>
            <FieldGroup className="gap-4">
              <Field className="gap-2">
                <FieldLabel htmlFor="catalog-sort">Sắp xếp theo</FieldLabel>
                <AppSelect
                  id="catalog-sort"
                  options={catalogSortOptions}
                  placeholder="Chọn cách sắp xếp"
                  size="sm"
                  startIcon={<ArrowUpDownIcon />}
                  value={draft.sort}
                  onValueChange={(sort) =>
                    setDraft((value) => ({
                      ...value,
                      sort: sort as CatalogSort,
                    }))
                  }
                />
              </Field>

              <Field className="gap-2" data-invalid={Boolean(priceError)}>
                <FieldTitle>
                  <CircleDollarSignIcon
                    aria-hidden="true"
                    className="size-4 text-primary"
                  />
                  Khoảng giá
                </FieldTitle>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                  <Input
                    aria-label="Giá tối thiểu"
                    aria-invalid={Boolean(priceError)}
                    className="h-9 px-2 text-xs"
                    inputMode="numeric"
                    min={0}
                    placeholder="Từ ₫"
                    type="number"
                    value={minPrice}
                    onChange={(event) => setMinPrice(event.target.value)}
                  />
                  <span aria-hidden="true" className="text-muted-foreground">
                    –
                  </span>
                  <Input
                    aria-label="Giá tối đa"
                    aria-invalid={Boolean(priceError)}
                    className="h-9 px-2 text-xs"
                    inputMode="numeric"
                    min={0}
                    placeholder="Đến ₫"
                    type="number"
                    value={maxPrice}
                    onChange={(event) => setMaxPrice(event.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pricePresets.map((preset) => {
                    const selected =
                      minPrice ===
                        (preset.minPrice === undefined
                          ? ""
                          : String(preset.minPrice)) &&
                      maxPrice ===
                        (preset.maxPrice === undefined
                          ? ""
                          : String(preset.maxPrice))
                    return (
                      <Button
                        key={preset.label}
                        className="h-auto min-h-7 px-2 py-1 text-[11px] whitespace-normal"
                        size="xs"
                        type="button"
                        variant={selected ? "secondary" : "outline"}
                        onClick={() => {
                          setMinPrice(
                            preset.minPrice === undefined
                              ? ""
                              : String(preset.minPrice)
                          )
                          setMaxPrice(
                            preset.maxPrice === undefined
                              ? ""
                              : String(preset.maxPrice)
                          )
                          setPriceError("")
                        }}
                      >
                        {preset.label}
                      </Button>
                    )
                  })}
                </div>
                <FieldError className="text-xs">{priceError}</FieldError>
              </Field>

              <FieldSet className="gap-3 border-t pt-3">
                <FieldLegend className="sr-only" variant="label">
                  Tình trạng sản phẩm
                </FieldLegend>
                {[
                  {
                    id: "catalog-in-stock",
                    label: "Còn hàng",
                    icon: PackageCheckIcon,
                    checked: draft.inStock,
                    update: (checked: boolean) =>
                      setDraft((value) => ({ ...value, inStock: checked })),
                  },
                  {
                    id: "catalog-on-sale",
                    label: "Đang giảm giá",
                    icon: BadgePercentIcon,
                    checked: draft.onSale,
                    update: (checked: boolean) =>
                      setDraft((value) => ({ ...value, onSale: checked })),
                  },
                  {
                    id: "catalog-liked",
                    label: "Được đánh giá tốt",
                    icon: StarIcon,
                    checked: draft.liked,
                    update: (checked: boolean) =>
                      setDraft((value) => ({ ...value, liked: checked })),
                  },
                ].map((option) => (
                  <Field key={option.id} orientation="horizontal">
                    <Checkbox
                      id={option.id}
                      checked={option.checked}
                      onCheckedChange={(checked) =>
                        option.update(Boolean(checked))
                      }
                    />
                    <FieldLabel
                      htmlFor={option.id}
                      className="cursor-pointer font-normal"
                    >
                      <option.icon
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      {option.label}
                    </FieldLabel>
                  </Field>
                ))}
              </FieldSet>
            </FieldGroup>
          </CardContent>
          <CardFooter className="grid grid-cols-2 gap-2 border-t">
            <Button
              disabled={isPending}
              size="sm"
              type="button"
              variant="ghost"
              onClick={reset}
              startIcon={<RotateCcwIcon />}
            >
              Xóa lọc
            </Button>
            <Button disabled={isPending} size="sm" type="submit">
              {isPending ? (
                <Spinner aria-label="Đang áp dụng" />
              ) : (
                <CheckIcon aria-hidden="true" />
              )}
              Áp dụng
            </Button>
          </CardFooter>
        </div>
      </Card>
    </form>
  )
}

function FeaturedShopsCard({ shops }: { shops: FeaturedShop[] }) {
  return (
    <aside aria-labelledby="featured-shops-heading" className="min-w-0">
      <Card size="sm" className="lg:h-[42rem] lg:max-h-[calc(100svh-7rem)]">
        <CardHeader className="border-b">
          <CardTitle
            as="h2"
            id="featured-shops-heading"
            className="flex items-center gap-2"
          >
            <StoreIcon aria-hidden="true" className="size-4 text-primary" />
            Shop nổi bật
          </CardTitle>
          <CardDescription className="text-xs leading-5">
            Các cửa hàng đang có sản phẩm trên Deal Hay
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1">
          <ScrollArea className="-mr-3 min-h-0 flex-1 pr-3">
            <div className="space-y-2">
              {shops.map((shop) => (
                <PublicShopCard key={shop.code} shop={shop} compact />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="border-t">
          <Button
            nativeButton={false}
            render={<Link href="/shops" />}
            size="sm"
            variant="outline"
            className="w-full justify-between"
          >
            Xem thêm shop
            <ArrowRightIcon aria-hidden="true" />
          </Button>
        </CardFooter>
      </Card>
    </aside>
  )
}

function InfiniteProductCatalog({
  initialProducts,
  request,
  title,
  headingAs,
  filtered,
}: {
  initialProducts: HomeResponse["products"]
  request: Omit<HomeCatalogRequest, "page">
  title: string
  headingAs: "h1" | "h2"
  filtered: boolean
}) {
  const [items, setItems] = useState(initialProducts.data)
  const [currentPage, setCurrentPage] = useState(initialProducts.current_page)
  const [lastPage, setLastPage] = useState(initialProducts.last_page)
  const [total, setTotal] = useState(initialProducts.total)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<Error>()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)
  const mountedRef = useRef(true)
  const hasMore = currentPage < lastPage
  const singleProduct = total === 1

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (loadingRef.current || currentPage >= lastPage) return
    loadingRef.current = true
    setLoadingMore(true)
    setLoadError(undefined)
    try {
      const response = await getHome({
        ...request,
        page: String(currentPage + 1),
      })
      if (!mountedRef.current) return
      setItems((current) => {
        const knownIds = new Set(current.map((product) => product.id))
        return [
          ...current,
          ...response.products.data.filter(
            (product) => !knownIds.has(product.id)
          ),
        ]
      })
      setCurrentPage(response.products.current_page)
      setLastPage(response.products.last_page)
      setTotal(response.products.total)
    } catch (error) {
      if (mountedRef.current)
        setLoadError(
          error instanceof Error
            ? error
            : new Error("Không thể tải thêm sản phẩm.")
        )
    } finally {
      loadingRef.current = false
      if (mountedRef.current) setLoadingMore(false)
    }
  }, [currentPage, lastPage, request])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore || loadError) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void loadMore()
      },
      { rootMargin: "600px 0px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadError, loadMore])

  return (
    <section
      className="min-w-0 space-y-4 lg:col-start-2 lg:row-start-1"
      aria-labelledby="products-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="min-w-0 space-y-1">
          <CardTitle
            as={headingAs}
            id="products-heading"
            className="flex items-center gap-2 font-heading text-xl font-semibold tracking-tight wrap-anywhere sm:text-2xl"
          >
            <PackageSearchIcon
              aria-hidden="true"
              className="size-5 shrink-0 text-primary sm:size-6"
            />
            {title}
          </CardTitle>
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {items.length < total
              ? `Đang hiển thị ${items.length} trong ${total} sản phẩm`
              : `${total} sản phẩm`}
          </p>
        </div>
        {filtered ? (
          <Button
            nativeButton={false}
            render={<Link href="/" />}
            variant="ghost"
            size="sm"
            startIcon={<RotateCcwIcon />}
          >
            Xóa tất cả bộ lọc
          </Button>
        ) : null}
      </div>

      {items.length > 0 ? (
        <>
          <div
            className={cn(
              "grid gap-4",
              !singleProduct && "grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3"
            )}
          >
            {items.map((product, index) => (
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
          <div
            ref={sentinelRef}
            className="flex min-h-20 items-center justify-center py-3 text-sm text-muted-foreground"
          >
            {loadingMore ? (
              <span className="inline-flex items-center gap-2" role="status">
                <Spinner aria-hidden="true" />
                Đang tải thêm sản phẩm…
              </span>
            ) : loadError ? (
              <Alert
                variant="destructive"
                className="w-auto justify-items-center text-center"
              >
                <AlertDescription>
                  Không thể tải thêm sản phẩm.
                </AlertDescription>
                <Button
                  size="sm"
                  variant="outline"
                  startIcon={<RotateCwIcon />}
                  onClick={() => void loadMore()}
                >
                  Thử lại
                </Button>
              </Alert>
            ) : hasMore ? (
              <span className="sr-only">Cuộn để tải thêm sản phẩm</span>
            ) : (
              <p className="inline-flex items-center gap-2">
                <CircleCheckIcon
                  aria-hidden="true"
                  className="size-4 text-success"
                />
                Đã hiển thị toàn bộ {total} sản phẩm.
              </p>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          title={filtered ? "Chưa tìm thấy sản phẩm" : "Chưa có sản phẩm"}
          description={
            filtered
              ? "Thử thay đổi khoảng giá, điều kiện lọc hoặc danh mục."
              : "Các sản phẩm đang bán sẽ xuất hiện tại đây."
          }
        />
      )}
    </section>
  )
}

export function HomePageContainer({
  categorySlug,
  search,
  filters,
  initialData,
  initialError,
}: {
  categorySlug?: string
  search?: string
  filters: CatalogFilterInput
  initialData?: HomeResponse
  initialError?: string
}) {
  const canPersonalize =
    !categorySlug && !search && activeProductFilterCount(filters) === 0
  const initialRequest: HomeCatalogRequest = {
    categorySlug,
    page: "1",
    q: search,
    ...filters,
  }
  const query = useApiQuery(
    JSON.stringify(["home", initialRequest]),
    () => getHome(initialRequest),
    {
      initialData,
      initialError,
      revalidateOnMount: canPersonalize ? "authenticated" : false,
      sessionSensitive: canPersonalize,
    }
  )

  const data = query.data ?? initialData
  if (!data) return <QueryPlaceholder error={query.error} />
  if (categorySlug && data.filters.category === "") return <NotFound />

  const activeCategory = data.filters.category
  const activeSearch = data.filters.q ?? search ?? ""
  const activeFilters = filterInput(data.filters)
  const filtered = Boolean(
    activeCategory ||
    activeSearch ||
    activeProductFilterCount(activeFilters) > 0
  )
  const products = data.products
  const isFirstBrowsePage = !filtered
  const request: Omit<HomeCatalogRequest, "page"> = {
    categorySlug,
    q: activeSearch || undefined,
    sort: activeFilters.sort,
    minPrice: activeFilters.minPrice,
    maxPrice: activeFilters.maxPrice,
    inStock: activeFilters.inStock,
    onSale: activeFilters.onSale,
    liked: activeFilters.liked,
  }
  const catalogKey = JSON.stringify(request)
  const productFeedKey = JSON.stringify([
    catalogKey,
    products.data.map((product) => product.id),
  ])
  const productTitle = activeSearch
    ? `Kết quả cho “${activeSearch}”`
    : activeCategory ||
      (data.personalized ? "Sản phẩm dành cho bạn" : "Tất cả sản phẩm")

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
              <Button
                size="sm"
                type="button"
                onClick={() =>
                  document
                    .getElementById("san-pham")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                Khám phá sản phẩm
                <ArrowRightIcon aria-hidden="true" />
              </Button>
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
        className="grid min-w-0 scroll-mt-32 items-start gap-4 sm:scroll-mt-20 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_18rem]"
      >
        <div className="catalog-left-rail min-w-0 space-y-4 lg:col-start-1 lg:row-start-1 lg:self-start">
          <CatalogCategories
            categories={data.categories}
            category={activeCategory}
            search={activeSearch}
            filters={activeFilters}
          />
          <CatalogFiltersCard
            key={catalogKey}
            category={activeCategory}
            search={activeSearch}
            filters={data.filters}
          />
        </div>
        <InfiniteProductCatalog
          key={productFeedKey}
          initialProducts={products}
          request={request}
          title={productTitle}
          headingAs={isFirstBrowsePage ? "h2" : "h1"}
          filtered={filtered}
        />
        <div className="lg:col-span-2 xl:sticky xl:top-24 xl:col-span-1 xl:col-start-3 xl:row-start-1 xl:self-start">
          <FeaturedShopsCard shops={data.featuredShops} />
        </div>
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
