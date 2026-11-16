"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { ExternalLinkIcon, EyeIcon, Trash2Icon } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { getAdminShop } from "@/api/admin/queries"
import { FormSubmitButton } from "@/components/form-submit-button"
import { DataPagination } from "@/components/layout/data-pagination"
import { EmptyState } from "@/components/layout/empty-state"
import { MediaImage } from "@/components/media-image"
import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Surface } from "@/components/ui/surface"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { QueryPlaceholder, useApiQuery } from "@/hooks/use-api-query"
import { applyServerErrors } from "@/lib/form-utils"
import { formatCurrency, formatDate } from "@/lib/format"
import { openAuthenticatedTab } from "@/lib/authenticated-tab"
import { deleteShopProductAction } from "@/modules/admin/actions"
import {
  AdminAccountLockButton,
  AdminChatButton,
} from "@/modules/admin/components/admin-account-actions"
import { AdminFilterBar } from "@/modules/admin/components/admin-filter-bar"
import { accountStatusOptions } from "@/modules/admin/lib/admin-navigation"
import {
  deleteShopProductSchema,
  type DeleteShopProductValues,
} from "@/modules/admin/schemas/admin"
import type { AdminShop, AdminShopProduct } from "@/types/admin"
import type { PaginatedResponse } from "@/types/common"

function ShopProductDeleteForm({
  shopId,
  product,
}: {
  shopId: string
  product: AdminShopProduct
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const form = useForm<DeleteShopProductValues>({
    resolver: zodResolver(deleteShopProductSchema),
    defaultValues: { reason: "" },
  })
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setOpen(value)
          form.reset()
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="destructive"
            size="sm"
            aria-label={`Xóa sản phẩm ${product.name}`}
          />
        }
      >
        <Trash2Icon />
        Xóa
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xóa sản phẩm</DialogTitle>
          <DialogDescription>
            {product.name} sẽ được xóa khỏi cửa hàng. Lý do sẽ được gửi đến chủ
            cửa hàng.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            noValidate
            onSubmit={form.handleSubmit((values) =>
              startTransition(async () => {
                const state = await deleteShopProductAction(
                  shopId,
                  product.id,
                  values
                )
                const fieldErrors = applyServerErrors(
                  state.errors,
                  form.setError
                )
                if (state.success) {
                  toast.success(state.message)
                  setOpen(false)
                  form.reset()
                } else if (!fieldErrors) toast.error(state.message)
              })
            )}
          >
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lý do xóa sản phẩm</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      maxLength={1000}
                      disabled={pending}
                      placeholder="Nhập lý do cụ thể, ít nhất 5 ký tự"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Hủy
              </Button>
              <FormSubmitButton
                idleText="Xóa sản phẩm"
                pendingText="Đang xóa..."
                pending={pending}
                variant="destructive"
              />
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function ShopDetails({ shopId }: { shopId: string }) {
  const { data, error } = useApiQuery(`admin-shop:${shopId}`, () =>
    getAdminShop(shopId)
  )
  if (!data) return <QueryPlaceholder error={error} />
  const shop = data.selectedShop
  if (!shop)
    return (
      <EmptyState
        title="Không tìm thấy cửa hàng"
        description="Cửa hàng có thể đã bị xóa hoặc bạn không còn quyền truy cập."
      />
    )
  const details = [
    ["Chủ cửa hàng", shop.full_name],
    ["Mã cửa hàng", shop.user_code],
    ["Email cửa hàng", shop.shop_email || shop.email],
    ["Điện thoại cửa hàng", shop.shop_phone_number || shop.phone_number],
    ["Địa chỉ cửa hàng", shop.shop_address],
    ["Email tài khoản", shop.email],
    ["Điện thoại tài khoản", shop.phone_number],
    ["Địa chỉ cá nhân", shop.personal_address],
    ["Ngày tạo", formatDate(shop.created_at)],
    ["Cập nhật gần nhất", formatDate(shop.updated_at)],
  ]
  return (
    <div className="space-y-5 px-4 pb-6">
      <div className="flex flex-wrap items-center gap-3">
        <UserAvatar
          name={shop.shop_name || shop.full_name}
          src={shop.shop_avatar_url || shop.avatar_url}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold wrap-anywhere">
            {shop.shop_name || shop.full_name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {shop.online_status.label}
          </p>
        </div>
        <Badge variant={shop.is_active ? "success" : "destructive"}>
          {shop.is_active ? "Hoạt động" : "Đã khóa"}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <Link
              href={`/shops/${encodeURIComponent(shop.user_code)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={openAuthenticatedTab}
              onAuxClick={openAuthenticatedTab}
            />
          }
        >
          <ExternalLinkIcon />
          Xem cửa hàng
        </Button>
        <AdminChatButton userId={shop.id} name={shop.full_name} />
        <AdminAccountLockButton
          id={shop.id}
          name={shop.shop_name || shop.full_name}
          isActive={shop.is_active}
          lockReason={shop.lock_reason}
          shop
        />
      </div>
      {shop.lock_reason && !shop.is_active ? (
        <Surface variant="danger">
          <p className="text-sm">Lý do khóa: {shop.lock_reason}</p>
        </Surface>
      ) : null}
      <Tabs defaultValue="profile" className="gap-4">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="profile">Hồ sơ</TabsTrigger>
            <TabsTrigger value="products">
              Sản phẩm ({shop.products?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="categories">Danh mục</TabsTrigger>
            <TabsTrigger value="history">
              Lịch sử ({shop.change_logs_count})
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="profile">
          <Surface render={<dl />} className="grid gap-4 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-sm wrap-anywhere">
                  {value || "Chưa cập nhật"}
                </dd>
              </div>
            ))}
          </Surface>
        </TabsContent>
        <TabsContent value="products">
          {shop.products?.length ? (
            <Table className="min-w-150">
              <TableHeader>
                <TableRow>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead>Giá / Tồn kho</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shop.products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <MediaImage
                          alt={product.name}
                          src={product.image_url}
                          className="size-12 shrink-0 rounded-lg border object-cover"
                          sizes="48px"
                        />
                        <div className="min-w-0">
                          <p className="max-w-64 truncate font-medium">
                            {product.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {product.category}
                          </p>
                          <p className="max-w-64 truncate text-xs text-muted-foreground">
                            {product.description}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(product.price)}
                      <p className="text-xs text-muted-foreground">
                        Tồn: {product.stock}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={product.is_active ? "success" : "secondary"}
                      >
                        {product.is_active ? "Đang bán" : "Đang ẩn"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <ShopProductDeleteForm
                        shopId={shop.id}
                        product={product}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="Chưa có sản phẩm"
              description="Sản phẩm của cửa hàng sẽ xuất hiện tại đây."
            />
          )}
        </TabsContent>
        <TabsContent value="categories">
          {shop.categories?.length ? (
            <Surface render={<ol />} className="space-y-3">
              {shop.categories.map((category) => (
                <li key={category.id} className="flex items-center gap-3">
                  <Badge variant="secondary">{category.display_order}</Badge>
                  <span className="min-w-0 flex-1 wrap-anywhere">
                    {category.name}
                  </span>
                  <Badge variant={category.is_active ? "success" : "secondary"}>
                    {category.is_active ? "Hiển thị" : "Ẩn"}
                  </Badge>
                </li>
              ))}
            </Surface>
          ) : (
            <EmptyState
              title="Chưa có danh mục"
              description="Danh mục trưng bày sẽ xuất hiện tại đây."
            />
          )}
        </TabsContent>
        <TabsContent value="history">
          <div className="space-y-3">
            {shop.change_logs?.length ? (
              shop.change_logs.map((log) => (
                <Surface key={log.id}>
                  <h3 className="mb-3 text-sm font-medium">
                    {formatDate(log.created_at)}
                  </h3>
                  <dl className="space-y-3">
                    {Object.entries(log.changes).map(([key, change]) => (
                      <div key={key}>
                        <dt className="text-xs text-muted-foreground">
                          {change.label}
                        </dt>
                        <dd className="mt-1 grid gap-1 text-sm wrap-anywhere">
                          <span className="text-muted-foreground">
                            Trước: {String(change.old ?? "Chưa cập nhật")}
                          </span>
                          <span>
                            Sau: {String(change.new ?? "Chưa cập nhật")}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Surface>
              ))
            ) : (
              <EmptyState
                title="Chưa có lịch sử thay đổi"
                description="Thay đổi hồ sơ cửa hàng sẽ được ghi nhận tại đây."
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function AdminShopsClient({
  shops,
}: {
  shops: PaginatedResponse<AdminShop>
}) {
  const query = useSearchParams()
  const router = useRouter()
  const selectedId = query.get("shop")
  const select = (id: string | null) => {
    const params = new URLSearchParams(query.toString())
    if (id) params.set("shop", id)
    else params.delete("shop")
    const href = params.size ? `/admin/shops?${params}` : "/admin/shops"
    if (id) router.push(href, { scroll: false })
    else router.replace(href, { scroll: false })
  }
  return (
    <div className="space-y-6">
      <AdminFilterBar
        searchPlaceholder="Tìm tên cửa hàng, chủ shop, email, số điện thoại hoặc mã shop"
        fields={[
          {
            key: "status",
            label: "Trạng thái cửa hàng",
            options: accountStatusOptions,
          },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Danh sách cửa hàng</CardTitle>
          <CardDescription>
            {shops.total} cửa hàng phù hợp · Trang {shops.current_page ?? 1}/
            {shops.last_page ?? 1}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {shops.data.length ? (
            <Table className="min-w-200">
              <TableHeader>
                <TableRow>
                  <TableHead>Cửa hàng</TableHead>
                  <TableHead>Chủ cửa hàng</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shops.data.map((shop) => (
                  <TableRow key={shop.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          name={shop.shop_name || shop.full_name}
                          src={shop.shop_avatar_url || shop.avatar_url}
                        />
                        <div>
                          <p className="max-w-56 truncate font-medium">
                            {shop.shop_name || shop.full_name}
                          </p>
                          <p className="max-w-56 truncate text-xs text-muted-foreground">
                            {shop.shop_email || shop.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {shop.user_code}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {shop.full_name}
                      <p className="text-xs text-muted-foreground">
                        {shop.online_status.label}
                      </p>
                    </TableCell>
                    <TableCell>{shop.products_count}</TableCell>
                    <TableCell>
                      <Badge
                        variant={shop.is_active ? "success" : "destructive"}
                      >
                        {shop.is_active ? "Hoạt động" : "Đã khóa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => select(shop.id)}
                          aria-label={`Xem chi tiết ${shop.shop_name || shop.full_name}`}
                        >
                          <EyeIcon />
                          Chi tiết
                        </Button>
                        <AdminAccountLockButton
                          id={shop.id}
                          name={shop.shop_name || shop.full_name}
                          isActive={shop.is_active}
                          lockReason={shop.lock_reason}
                          shop
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="Không tìm thấy cửa hàng"
              description="Thử thay đổi từ khóa hoặc bộ lọc để xem thêm cửa hàng."
            />
          )}
          <DataPagination
            currentPage={shops.current_page}
            lastPage={shops.last_page}
          />
        </CardContent>
      </Card>
      <Sheet
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) select(null)
        }}
      >
        <SheetContent className="w-full overflow-y-auto data-[side=right]:w-full sm:data-[side=right]:max-w-3xl">
          <SheetHeader className="border-b pr-12">
            <SheetTitle>Chi tiết cửa hàng</SheetTitle>
            <SheetDescription>
              Hồ sơ, sản phẩm, danh mục và lịch sử thay đổi.
            </SheetDescription>
          </SheetHeader>
          {selectedId ? (
            <ShopDetails key={selectedId} shopId={selectedId} />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
