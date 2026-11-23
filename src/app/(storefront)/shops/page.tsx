import type { Metadata } from "next"
import Link from "next/link"

import { getPublicShops, PUBLIC_CATALOG_ERROR } from "@/api/catalog/server"
import { DataPagination } from "@/components/layout/data-pagination"
import { EmptyState } from "@/components/layout/empty-state"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CatalogSearchForm } from "@/modules/public/components/catalog-search-form"
import { PublicShopCard } from "@/modules/public/components/public-shop-card"
import { catalogPage, catalogSearch } from "@/modules/public/lib/catalog-query"

export const metadata: Metadata = {
  title: "Cửa hàng",
  description: "Tìm cửa hàng trên Deal Hay theo tên hoặc mã cửa hàng.",
  alternates: { canonical: "/shops" },
}

export default async function PublicShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>
}) {
  const query = await searchParams
  const requestedSearch = catalogSearch(query.q)
  const page = catalogPage(query.page)
  const result = await getPublicShops(requestedSearch, page)
  if (result.status !== "ready") {
    return (
      <EmptyState
        title="Chưa tải được cửa hàng"
        description={PUBLIC_CATALOG_ERROR}
        action={
          <form action="/shops" method="get">
            {requestedSearch ? (
              <Input type="hidden" name="q" value={requestedSearch} />
            ) : null}
            {page ? <Input type="hidden" name="page" value={page} /> : null}
            <Button type="submit" variant="outline">
              Thử lại
            </Button>
          </form>
        }
      />
    )
  }

  const { shops, filters } = result.data
  const search = filters.q
  const firstPage = search
    ? `/shops?${new URLSearchParams({ q: search })}`
    : "/shops"

  return (
    <div
      id="danh-sach"
      className="min-w-0 scroll-mt-32 space-y-6 md:scroll-mt-20"
    >
      <Card className="gap-4 bg-accent/40">
        <CardHeader>
          <CardTitle as="h1" className="text-2xl sm:text-3xl">
            Cửa hàng
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CatalogSearchForm
            key={JSON.stringify([search, shops.current_page])}
            action="/shops#danh-sach"
            search={search}
            label="Tìm cửa hàng"
            placeholder="Tên hoặc mã cửa hàng"
          />
        </CardContent>
      </Card>
      <section className="space-y-4" aria-label="Danh sách cửa hàng">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {shops.data.length > 0
              ? `Hiển thị ${shops.from ?? 1}–${shops.to ?? shops.data.length} trên ${shops.total} cửa hàng`
              : `${shops.total} cửa hàng phù hợp`}
          </p>
          {search && shops.data.length > 0 ? (
            <Link
              href="/shops"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Xóa tìm kiếm
            </Link>
          ) : null}
        </div>
        {shops.data.length > 0 ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {shops.data.map((shop) => (
                <PublicShopCard key={shop.code} shop={shop} />
              ))}
            </div>
            <DataPagination
              currentPage={shops.current_page}
              lastPage={shops.last_page}
              anchor="danh-sach"
            />
          </>
        ) : (
          <EmptyState
            title={
              shops.total > 0
                ? "Trang này không có cửa hàng"
                : "Chưa tìm thấy cửa hàng"
            }
            description={
              shops.total > 0
                ? "Quay lại trang đầu để xem danh sách cửa hàng."
                : search
                  ? "Thử tên khác hoặc nhập mã cửa hàng."
                  : "Các cửa hàng đang hoạt động sẽ xuất hiện tại đây."
            }
            action={
              shops.total > 0 || search ? (
                <Link
                  href={shops.total > 0 ? firstPage : "/shops"}
                  className={buttonVariants({ variant: "outline" })}
                >
                  {shops.total > 0 ? "Về trang đầu" : "Xóa tìm kiếm"}
                </Link>
              ) : undefined
            }
          />
        )}
      </section>
    </div>
  )
}
