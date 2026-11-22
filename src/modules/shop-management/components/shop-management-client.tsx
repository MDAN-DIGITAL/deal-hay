"use client"

import { Surface } from "@/components/ui/surface"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  BoxesIcon,
  HashIcon,
  FileTextIcon,
  PackageCheckIcon,
  MessageSquareIcon,
  SendIcon,
  ImageIcon,
  StoreIcon,
  MailIcon,
  ShieldCheckIcon,
  PhoneIcon,
  MapPinIcon,
  EyeOffIcon,
  EyeIcon,
  ArrowRightIcon,
  RotateCcwIcon,
  SaveIcon,
  PackagePlusIcon,
  FilterXIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PackageIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormSelect } from "@/components/form-select"
import { FormSubmitButton } from "@/components/form-submit-button"
import { AddressFields } from "@/components/address-fields"
import { MediaImage } from "@/components/media-image"
import { SelectedFilePreview } from "@/components/selected-file-preview"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination"
import { Textarea } from "@/components/ui/textarea"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ShopManagementOverview } from "@/modules/shop-management/components/shop-management-overview"
import { ShopManagementWorkspace } from "@/modules/shop-management/components/shop-management-workspace"
import {
  filterShopOrders,
  filterShopProducts,
  isLowStock,
  isOpenOrder,
  orderStatusLabels,
  type OrderFilter,
  type ProductFilter,
} from "@/modules/shop-management/lib/management-data"
import {
  managementHref,
  type ManagementTab,
} from "@/modules/shop-management/lib/management-navigation"
import { UserAvatar } from "@/components/user-avatar"
import {
  appendOptionalFile,
  applyServerErrors,
  runUploadAction,
} from "@/lib/form-utils"
import { formatCurrency, formatDate } from "@/lib/format"
import { IMAGE_UPLOAD_ACCEPT } from "@/lib/validation"
import { ImageUploadProgress } from "@/components/image-upload-progress"
import { useImageUpload } from "@/hooks/use-image-upload"
import type { ReactNode } from "react"
import type {
  InventoryMovement,
  ShopCategory,
  ShopCoupon,
  ShopCouponProduct,
  ShopInventoryProduct,
  ShopManagementUser,
  ShopMetrics,
  ShopOrder,
  ShopOrderSummary,
  ShopProduct,
  ShopProductReview,
} from "@/types/shop"
import {
  updateShopAvatarAction,
  updateShopProfileAction,
} from "@/modules/profile/actions"
import {
  avatarSchema,
  updateShopProfileSchema,
  type AvatarValues,
  type UpdateShopProfileValues,
} from "@/modules/profile/schemas/profile"
import {
  adjustInventoryAction,
  deleteProductAction,
  reorderCategoriesAction,
  replyReviewAction,
  toggleProductStatusAction,
  updateOrderStatusAction,
} from "@/modules/shop-management/actions"
import {
  adjustInventorySchema,
  replyReviewSchema,
  type AdjustInventoryValues,
  type ReplyReviewValues,
} from "@/modules/shop-management/schemas/shop-management"
import { CreateProductForm } from "@/modules/shop-management/components/create-product-form"
import { ProductPricingForm } from "@/modules/shop-management/components/product-pricing-form"
import { ShopCouponManager } from "@/modules/shop-management/components/shop-coupon-manager"
import { ShopShippingSettings } from "@/modules/shop-management/components/shop-shipping-settings"

const productFilterOptions: { value: ProductFilter; label: string }[] = [
  { value: "all", label: "Tất cả sản phẩm" },
  { value: "active", label: "Đang bán" },
  { value: "hidden", label: "Đang ẩn" },
  { value: "low-stock", label: "Sắp hết hàng (≤ 5)" },
]

const inventoryFilterOptions: { value: ProductFilter; label: string }[] = [
  { value: "all", label: "Tất cả tồn kho" },
  { value: "low-stock", label: "Sắp hết hàng (≤ 5)" },
]

const orderFilterOptions: { value: OrderFilter; label: string }[] = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "open", label: "Đơn đang mở" },
  ...Object.entries(orderStatusLabels).map(([value, label]) => ({
    value: value as ShopOrder["status"],
    label,
  })),
]

function ProductInventoryForm({ product }: { product: ShopInventoryProduct }) {
  const [isPending, startTransition] = useTransition()
  const manageVariantStock = product.has_variants && !product.shared_stock
  const availableVariants = product.variants.filter(
    (variant) => variant.is_active && !variant.retired_at
  )
  const defaultVariantId = manageVariantStock
    ? (availableVariants.find((variant) => variant.is_default)?.id ??
      availableVariants[0]?.id ??
      "")
    : ""
  const form = useForm<AdjustInventoryValues>({
    resolver: zodResolver(adjustInventorySchema),
    defaultValues: {
      quantity_delta: 0,
      note: "",
      shop_product_variant_id: defaultVariantId,
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const state = await adjustInventoryAction(product.id, {
        ...values,
        shop_product_variant_id: manageVariantStock
          ? values.shop_product_variant_id
          : "",
      })
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success) {
        toast.success(state.message)
        form.reset({
          quantity_delta: 0,
          note: "",
          shop_product_variant_id: defaultVariantId,
        })
        return
      }

      if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <Form {...form}>
      <form className="space-y-4" noValidate onSubmit={onSubmit}>
        {manageVariantStock ? (
          <FormField
            control={form.control}
            name="shop_product_variant_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Biến thể sản phẩm</FormLabel>
                <FormSelect
                  startIcon={<BoxesIcon />}
                  disabled={availableVariants.length === 0}
                  ref={field.ref}
                  name={field.name}
                  options={availableVariants.map((variant) => {
                    const optionLabel = Object.values(variant.option_values)
                      .filter(Boolean)
                      .join(" / ")

                    return {
                      label: `${variant.variant_label || optionLabel || variant.sku} — tồn ${variant.stock}`,
                      value: variant.id,
                    }
                  })}
                  placeholder="Không có biến thể đang hoạt động"
                  value={field.value}
                  onBlur={field.onBlur}
                  onValueChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <FormField
            control={form.control}
            name="quantity_delta"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Số lượng +/-</FormLabel>
                <FormControl>
                  <Input
                    startIcon={<HashIcon />}
                    inputMode="numeric"
                    type="number"
                    {...field}
                    value={Number.isFinite(field.value) ? field.value : ""}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === ""
                          ? Number.NaN
                          : Number(event.target.value)
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ghi chú</FormLabel>
                <FormControl>
                  <Input
                    startIcon={<FileTextIcon />}
                    placeholder="Ghi chú điều chỉnh"
                    type="text"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {product.has_variants
              ? "Tổng tồn kho sản phẩm"
              : "Tồn kho hiện tại"}
            : {product.stock}
          </p>
          <FormSubmitButton
            startIcon={<PackageCheckIcon />}
            disabled={product.has_variants && availableVariants.length === 0}
            idleText="Cập nhật tồn kho"
            pending={isPending}
            pendingText="Đang lưu..."
          />
        </div>
      </form>
    </Form>
  )
}

function ReviewReplyForm({ review }: { review: ShopProductReview }) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<ReplyReviewValues>({
    resolver: zodResolver(replyReviewSchema),
    defaultValues: {
      reply: review.shop_reply ?? "",
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const state = await replyReviewAction(review.id, values)
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success) {
        toast.success(state.message)
        return
      }

      if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <AccordionItem
      className="rounded-xl border px-4"
      value={`review-${review.id}`}
    >
      <AccordionTrigger className="items-center py-3 hover:no-underline">
        <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <MediaImage
            alt={review.product.name}
            className="size-12 shrink-0 rounded-md border"
            fallbackLabel="Chưa có ảnh"
            sizes="48px"
            src={review.product.image_url}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              {review.product.name}
            </span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {review.customer.name}: {review.content}
            </span>
          </span>
          <Badge
            className="mr-2"
            variant={review.shop_reply ? "success" : "warning"}
          >
            {review.shop_reply ? "Đã phản hồi" : "Chưa phản hồi"}
          </Badge>
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-4">
        <Surface
          padding="none"
          variant="muted"
          className="flex items-start gap-3 p-3"
        >
          <UserAvatar
            name={review.customer.name}
            size="sm"
            src={review.customer.avatar_url}
          />
          <div>
            <p className="font-medium">{review.customer.name}</p>
            <p className="mt-1 text-muted-foreground">{review.content}</p>
          </div>
        </Surface>
        {review.image_url ? (
          <MediaImage
            alt={`Ảnh đánh giá của ${review.customer.name}`}
            className="aspect-video w-full max-w-md rounded-lg border"
            fallbackLabel="Không thể tải ảnh đánh giá"
            sizes="(max-width: 768px) 100vw, 480px"
            src={review.image_url}
          />
        ) : null}
        <Form {...form}>
          <form className="space-y-3" noValidate onSubmit={onSubmit}>
            <FormField
              control={form.control}
              name="reply"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phản hồi từ shop</FormLabel>
                  <FormControl>
                    <Textarea
                      startIcon={<MessageSquareIcon />}
                      placeholder="Nhập phản hồi..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormSubmitButton
              startIcon={<SendIcon />}
              idleText={
                review.shop_reply ? "Cập nhật phản hồi" : "Gửi phản hồi"
              }
              pending={isPending}
              pendingText="Đang lưu..."
              variant="outline"
            />
          </form>
        </Form>
      </AccordionContent>
    </AccordionItem>
  )
}

function ShopAvatarForm({ user }: { user: ShopManagementUser }) {
  const [isPending, startTransition] = useTransition()
  const { prepareUploads, uploadProgress } = useImageUpload()
  const form = useForm<AvatarValues>({
    resolver: zodResolver(avatarSchema),
    defaultValues: { avatar: undefined },
  })

  const onSubmit = form.handleSubmit((values) => {
    const formData = new FormData()
    appendOptionalFile(formData, "avatar", values.avatar)

    startTransition(async () => {
      const state = await runUploadAction(async () =>
        updateShopAvatarAction(await prepareUploads(formData, "avatar"))
      )
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success) {
        toast.success(state.message)
        form.reset({ avatar: undefined })
        return
      }

      if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
      <UserAvatar
        className="size-20"
        name={user.shop_name ?? user.full_name}
        size="lg"
        src={user.shop_avatar_url}
      />
      <Form {...form}>
        <form className="space-y-3" noValidate onSubmit={onSubmit}>
          <FormField
            control={form.control}
            name="avatar"
            render={({ field: { onChange, value, ...field } }) => (
              <FormItem>
                <FormLabel>Ảnh đại diện shop</FormLabel>
                <FormControl>
                  <div>
                    {value instanceof File ? (
                      <SelectedFilePreview
                        file={value}
                        onRemove={() => onChange(undefined)}
                      />
                    ) : (
                      <Input
                        startIcon={<ImageIcon />}
                        accept={IMAGE_UPLOAD_ACCEPT}
                        name={field.name}
                        ref={field.ref}
                        type="file"
                        onBlur={field.onBlur}
                        onChange={(event) =>
                          onChange(event.target.files?.[0] ?? undefined)
                        }
                      />
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <ImageUploadProgress progress={isPending ? uploadProgress : null} />
          <FormSubmitButton
            startIcon={<ImageIcon />}
            idleText="Cập nhật ảnh shop"
            pending={isPending}
            pendingText="Đang tải lên..."
          />
        </form>
      </Form>
    </div>
  )
}

function ShopProfileForm({ user }: { user: ShopManagementUser }) {
  const [isPending, startTransition] = useTransition()
  const [requiresEmailVerification, setRequiresEmailVerification] =
    useState(false)
  const form = useForm<UpdateShopProfileValues>({
    resolver: zodResolver(updateShopProfileSchema),
    defaultValues: {
      shop_name: user.shop_name ?? "",
      shop_email: user.shop_email ?? "",
      email_change_code: "",
      shop_phone_number: user.shop_phone_number ?? "",
      shop_province: user.shop_province ?? "",
      shop_ward: user.shop_ward ?? "",
      shop_address_detail: user.shop_address_detail ?? "",
    },
  })

  const submitProfile = (
    values: UpdateShopProfileValues,
    resendCode = false
  ) => {
    if (requiresEmailVerification && !resendCode && !values.email_change_code) {
      form.setError("email_change_code", {
        type: "required",
        message: "Vui lòng nhập mã xác thực gồm 6 chữ số.",
      })
      form.setFocus("email_change_code")
      return
    }
    startTransition(async () => {
      const state = await updateShopProfileAction(values)
      if (state.errors?.email_change_code?.length)
        setRequiresEmailVerification(true)
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success) {
        setRequiresEmailVerification(false)
        form.setValue("email_change_code", "")
        form.clearErrors("email_change_code")
        toast.success(state.message)
        return
      }

      if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  }
  const onSubmit = form.handleSubmit((values) => submitProfile(values))
  const resendVerificationCode = () => {
    form.setValue("email_change_code", "")
    form.clearErrors("email_change_code")
    void form.handleSubmit((values) => submitProfile(values, true))()
  }

  return (
    <Form {...form}>
      <form className="space-y-4" noValidate onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="shop_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tên shop</FormLabel>
                <FormControl>
                  <Input startIcon={<StoreIcon />} type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="shop_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email shop</FormLabel>
                <FormControl>
                  <Input
                    startIcon={<MailIcon />}
                    autoComplete="email"
                    inputMode="email"
                    type="text"
                    {...field}
                    disabled={isPending}
                    onChange={(event) => {
                      field.onChange(event)
                      setRequiresEmailVerification(false)
                      form.setValue("email_change_code", "")
                      form.clearErrors("email_change_code")
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {requiresEmailVerification ? (
            <FormField
              control={form.control}
              name="email_change_code"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Mã xác thực đổi email shop</FormLabel>
                  <FormControl>
                    <Input
                      startIcon={<ShieldCheckIcon />}
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Nhập mã gồm 6 chữ số"
                      type="text"
                      {...field}
                      value={field.value ?? ""}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    Nhập mã được gửi đến email shop hiện tại để xác nhận thay
                    đổi.
                  </FormDescription>
                  <FormMessage />
                  <Button
                    startIcon={<MailIcon />}
                    disabled={isPending}
                    onClick={resendVerificationCode}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Gửi lại mã
                  </Button>
                </FormItem>
              )}
            />
          ) : null}
          <FormField
            control={form.control}
            name="shop_phone_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Số điện thoại shop</FormLabel>
                <FormControl>
                  <Input
                    startIcon={<PhoneIcon />}
                    inputMode="tel"
                    type="text"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <AddressFields
            form={form}
            provinceName="shop_province"
            wardName="shop_ward"
          />
          <FormField
            control={form.control}
            name="shop_address_detail"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Địa chỉ chi tiết</FormLabel>
                <FormControl>
                  <Input startIcon={<MapPinIcon />} type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormSubmitButton
          idleText="Lưu thông tin shop"
          pending={isPending}
          pendingText="Đang lưu..."
        />
      </form>
    </Form>
  )
}

const orderActionLabels: Partial<Record<ShopOrder["status"], string>> = {
  confirmed: "Xác nhận đơn",
  processing: "Bắt đầu chuẩn bị",
  shipping: "Bắt đầu giao hàng",
  completed: "Hoàn thành đơn",
}

const orderStatusTransitions: Record<
  ShopOrder["status"],
  ShopOrder["status"][]
> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipping", "cancelled"],
  shipping: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
}

function mutationErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function ProductListItem({ product }: { product: ShopProduct }) {
  const [isPending, startTransition] = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const toggleStatus = () => {
    startTransition(async () => {
      try {
        const state = await toggleProductStatusAction(
          product.id,
          !product.is_active
        )
        if (state.success) {
          toast.success(state.message)
        } else {
          toast.error(state.message)
        }
      } catch (error) {
        toast.error(
          mutationErrorMessage(error, "Không thể cập nhật trạng thái sản phẩm.")
        )
      }
    })
  }

  const deleteProduct = () => {
    startTransition(async () => {
      try {
        const state = await deleteProductAction(product.id)
        if (state.success) {
          setDeleteOpen(false)
          toast.success(state.message)
        } else {
          toast.error(state.message)
        }
      } catch (error) {
        toast.error(mutationErrorMessage(error, "Không thể xoá sản phẩm."))
      }
    })
  }

  return (
    <Surface padding="none" className="grid min-w-0 gap-3 overflow-hidden p-3">
      <div className="flex min-w-0 gap-3">
        <MediaImage
          alt={product.name}
          className="size-16 shrink-0 rounded-lg border"
          fallbackLabel="Chưa có ảnh"
          sizes="64px"
          src={product.image_url}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-start gap-2">
            <p className="line-clamp-2 min-w-0 flex-1 font-medium break-words">
              {product.name}
            </p>
            <Badge
              className="shrink-0"
              variant={product.is_active ? "success" : "secondary"}
            >
              {product.is_active ? "Đang hiển thị" : "Đang ẩn"}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
            <span className="min-w-0 truncate">{product.category}</span>
            <span aria-hidden>•</span>
            <span>{formatCurrency(product.price)}</span>
            <span aria-hidden>•</span>
            <span>
              {product.shared_stock ? "tồn chung" : "tồn"} {product.stock}
            </span>
          </div>
          {product.sku ? (
            <p
              className="mt-1 truncate text-xs text-muted-foreground"
              title={product.sku}
            >
              SKU: {product.sku}
            </p>
          ) : null}
        </div>
      </div>
      <ProductPricingForm product={product} />
      <div className="grid grid-cols-2 gap-2 border-t pt-3">
        <Button
          startIcon={product.is_active ? <EyeOffIcon /> : <EyeIcon />}
          className="w-full"
          disabled={isPending}
          size="sm"
          variant="outline"
          onClick={toggleStatus}
        >
          {product.is_active ? "Ẩn sản phẩm" : "Mở bán lại"}
        </Button>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger
            render={
              <Button
                className="w-full"
                disabled={isPending}
                size="sm"
                variant="destructive"
              />
            }
          >
            <Trash2Icon /> Xoá
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <Trash2Icon />
              </AlertDialogMedia>
              <AlertDialogTitle>Xoá sản phẩm?</AlertDialogTitle>
              <AlertDialogDescription>
                Sản phẩm “{product.name}” sẽ bị xoá khỏi cửa hàng. Sản phẩm đã
                phát sinh đơn hàng có thể không xoá được.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Huỷ</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending}
                variant="destructive"
                onClick={deleteProduct}
              >
                {isPending ? "Đang xoá..." : "Xoá sản phẩm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Surface>
  )
}

const productsPerPage = 5
const inventoryMovementsPerPage = 4

function visiblePages(currentPage: number, totalPages: number) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)
  const visiblePages = pages.filter(
    (page) =>
      page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1
  )

  return visiblePages.flatMap<number | string>((page, index) => {
    const previousPage = visiblePages[index - 1]

    if (previousPage && page - previousPage > 1) {
      return [`ellipsis-${previousPage}-${page}`, page]
    }

    return [page]
  })
}

function ListPagination({
  currentPage,
  label,
  totalPages,
  onPageChange,
}: {
  currentPage: number
  label: string
  totalPages: number
  onPageChange: (page: number) => void
}) {
  const changePage = (page: number) => {
    if (page === currentPage) return
    onPageChange(page)
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }

  return (
    <Pagination aria-label={label}>
      <PaginationContent className="flex-wrap">
        <PaginationItem>
          <Button
            aria-label="Trang trước"
            tooltip="Trang trước"
            disabled={currentPage === 1}
            size="icon-sm"
            variant="outline"
            onClick={() => changePage(currentPage - 1)}
          >
            <ChevronLeftIcon />
          </Button>
        </PaginationItem>
        {visiblePages(currentPage, totalPages).map((page) => (
          <PaginationItem key={page}>
            {typeof page === "number" ? (
              <Button
                aria-current={page === currentPage ? "page" : undefined}
                aria-label={`Trang ${page}`}
                size="icon-sm"
                variant={page === currentPage ? "default" : "ghost"}
                onClick={() => changePage(page)}
              >
                {page}
              </Button>
            ) : (
              <PaginationEllipsis className="size-8" />
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <Button
            aria-label="Trang sau"
            tooltip="Trang sau"
            disabled={currentPage === totalPages}
            size="icon-sm"
            variant="outline"
            onClick={() => changePage(currentPage + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

function ProductList({ products }: { products: ShopProduct[] }) {
  const [selectedPage, setSelectedPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(products.length / productsPerPage))
  const currentPage = Math.min(selectedPage, totalPages)
  const firstProductIndex = (currentPage - 1) * productsPerPage
  const visibleProducts = products.slice(
    firstProductIndex,
    firstProductIndex + productsPerPage
  )

  if (products.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Shop chưa có sản phẩm nào.
      </p>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {visibleProducts.map((product) => (
          <ProductListItem key={product.id} product={product} />
        ))}
      </div>

      {totalPages > 1 ? (
        <div className="space-y-3 border-t pt-4">
          <p className="text-center text-xs text-muted-foreground">
            Hiển thị {firstProductIndex + 1}–
            {Math.min(firstProductIndex + productsPerPage, products.length)}{" "}
            trên {products.length} sản phẩm
          </p>
          <ListPagination
            currentPage={currentPage}
            label="Phân trang danh sách sản phẩm"
            totalPages={totalPages}
            onPageChange={setSelectedPage}
          />
        </div>
      ) : null}
    </>
  )
}

function InventoryMovementList({
  movements,
}: {
  movements: InventoryMovement[]
}) {
  const [selectedPage, setSelectedPage] = useState(1)
  const totalPages = Math.max(
    1,
    Math.ceil(movements.length / inventoryMovementsPerPage)
  )
  const currentPage = Math.min(selectedPage, totalPages)
  const firstMovementIndex = (currentPage - 1) * inventoryMovementsPerPage
  const visibleMovements = movements.slice(
    firstMovementIndex,
    firstMovementIndex + inventoryMovementsPerPage
  )

  if (movements.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Chưa có lịch sử tồn kho.</p>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {visibleMovements.map((movement) => (
          <Surface
            padding="none"
            key={movement.id}
            className="min-w-0 overflow-hidden p-3 text-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="line-clamp-2 min-w-0 flex-1 font-medium break-words">
                {movement.product_name}
              </p>
              <Badge
                className="shrink-0"
                variant={movement.quantity_delta > 0 ? "secondary" : "outline"}
              >
                {movement.quantity_delta > 0 ? "+" : ""}
                {movement.quantity_delta}
              </Badge>
            </div>
            <p className="mt-1 break-words text-muted-foreground">
              {movement.variant_name || "Sản phẩm tiêu chuẩn"} • tồn sau điều
              chỉnh {movement.stock_after}
            </p>
            <p className="mt-1 line-clamp-2 text-xs break-words text-muted-foreground">
              {movement.note ?? "Không có ghi chú"} •{" "}
              {formatDate(movement.created_at)}
            </p>
          </Surface>
        ))}
      </div>

      {totalPages > 1 ? (
        <div className="space-y-3 border-t pt-4">
          <p className="text-center text-xs text-muted-foreground">
            Hiển thị {firstMovementIndex + 1}–
            {Math.min(
              firstMovementIndex + inventoryMovementsPerPage,
              movements.length
            )}{" "}
            trên {movements.length} lần điều chỉnh
          </p>
          <ListPagination
            currentPage={currentPage}
            label="Phân trang lịch sử tồn kho"
            totalPages={totalPages}
            onPageChange={setSelectedPage}
          />
        </div>
      ) : null}
    </>
  )
}

function OrderCard({ order }: { order: ShopOrder }) {
  const [isPending, startTransition] = useTransition()
  const [cancelOpen, setCancelOpen] = useState(false)
  const nextStatuses = orderStatusTransitions[order.status]
  const nextStatus = nextStatuses.find((status) => status !== "cancelled")
  const canCancel = nextStatuses.includes("cancelled")

  const updateStatus = (status: ShopOrder["status"]) => {
    startTransition(async () => {
      try {
        const state = await updateOrderStatusAction(order.id, status)
        if (state.success) {
          if (status === "cancelled") setCancelOpen(false)
          toast.success(state.message)
        } else {
          toast.error(state.message)
        }
      } catch (error) {
        toast.error(
          mutationErrorMessage(error, "Không thể cập nhật trạng thái đơn hàng.")
        )
      }
    })
  }

  return (
    <Surface
      id={`order-${order.id}`}
      padding="none"
      className="scroll-mt-24 p-4"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{order.order_number}</p>
            <Badge
              variant={
                order.status === "cancelled"
                  ? "destructive"
                  : order.status === "completed"
                    ? "success"
                    : "secondary"
              }
            >
              {orderStatusLabels[order.status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.customer_name} • {order.customer_phone}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {order.items.length} sản phẩm • {formatDate(order.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <p className="mr-2 text-base font-semibold">
            {formatCurrency(order.total)}
          </p>
          {nextStatus ? (
            <Button
              startIcon={<ArrowRightIcon />}
              disabled={isPending}
              onClick={() => updateStatus(nextStatus)}
            >
              {orderActionLabels[nextStatus] ?? orderStatusLabels[nextStatus]}
            </Button>
          ) : null}
          {canCancel ? (
            <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <AlertDialogTrigger
                render={<Button disabled={isPending} variant="outline" />}
              >
                Huỷ đơn
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Huỷ đơn hàng?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Đơn {order.order_number} sẽ bị huỷ, tồn kho và lượt sử dụng
                    coupon liên quan sẽ được hoàn lại.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPending}>
                    Quay lại
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isPending}
                    variant="destructive"
                    onClick={() => updateStatus("cancelled")}
                  >
                    {isPending ? "Đang huỷ..." : "Xác nhận huỷ"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </div>

      <Accordion className="mt-3">
        <AccordionItem value={`order-${order.id}`}>
          <AccordionTrigger className="py-3 hover:no-underline">
            Chi tiết giao hàng và sản phẩm
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <Surface padding="none" variant="muted" className="p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Địa chỉ giao hàng
              </p>
              <p className="mt-1">{order.shipping_address}</p>
              {order.note ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Ghi chú: {order.note}
                </p>
              ) : null}
            </Surface>
            <div className="space-y-2">
              {order.items.map((item) => (
                <Surface
                  padding="none"
                  key={item.id}
                  className="flex items-start justify-between gap-4 p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.variant_name || "Sản phẩm tiêu chuẩn"} • SL{" "}
                      {item.quantity} × {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium">
                    {formatCurrency(item.subtotal)}
                  </p>
                </Surface>
              ))}
            </div>
            <Surface
              padding="none"
              render={<dl />}
              className="space-y-2 p-3 text-sm"
            >
              <div className="flex justify-between gap-4">
                <dt>Tiền hàng</dt>
                <dd>{formatCurrency(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Giảm giá tiền hàng</dt>
                <dd>−{formatCurrency(order.discount_amount)}</dd>
              </div>
              {order.shipping_fee !== undefined ? (
                <div className="flex justify-between gap-4">
                  <dt>Phí vận chuyển</dt>
                  <dd>{formatCurrency(order.shipping_fee)}</dd>
                </div>
              ) : null}
              {order.shipping_discount_amount !== undefined ? (
                <div className="flex justify-between gap-4">
                  <dt>Giảm phí vận chuyển</dt>
                  <dd>−{formatCurrency(order.shipping_discount_amount)}</dd>
                </div>
              ) : null}
              {order.shipping_total !== undefined ? (
                <div className="flex justify-between gap-4">
                  <dt>Phí vận chuyển phải trả</dt>
                  <dd>{formatCurrency(order.shipping_total)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t pt-2 font-semibold">
                <dt>Tổng thanh toán</dt>
                <dd>{formatCurrency(order.total)}</dd>
              </div>
            </Surface>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Surface>
  )
}

export function ShopManagementClient({
  user,
  categories,
  products,
  inventoryProducts,
  coupons,
  couponProducts,
  orders,
  recentOrders,
  openOrderCount,
  lowStockCount,
  unansweredReviewCount,
  metrics,
  inventoryMovements,
  productReviews,
  sectionPlaceholder,
  initialTab = "overview",
}: {
  user: ShopManagementUser
  categories: ShopCategory[]
  products: ShopProduct[]
  inventoryProducts: ShopInventoryProduct[]
  coupons: ShopCoupon[]
  couponProducts: ShopCouponProduct[]
  orders: ShopOrder[]
  recentOrders?: ShopOrderSummary[]
  openOrderCount?: number
  lowStockCount?: number
  unansweredReviewCount?: number
  metrics?: ShopMetrics
  inventoryMovements: InventoryMovement[]
  productReviews: ShopProductReview[]
  sectionPlaceholder?: ReactNode
  initialTab?: ManagementTab
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const activeTab = initialTab
  const [createProductOpen, setCreateProductOpen] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const [productStatus, setProductStatus] = useState<ProductFilter>("all")
  const [inventorySearch, setInventorySearch] = useState("")
  const [inventoryStatus, setInventoryStatus] = useState<ProductFilter>("all")
  const [orderSearch, setOrderSearch] = useState("")
  const [orderStatus, setOrderStatus] = useState<OrderFilter>("all")
  const [reviewStatus, setReviewStatus] = useState("all")
  const openOrders =
    openOrderCount ??
    metrics?.open_orders_count ??
    orders.filter(isOpenOrder).length
  const lowStock = lowStockCount ?? products.filter(isLowStock).length
  const unansweredReviews =
    unansweredReviewCount ??
    productReviews.filter((review) => !review.shop_reply).length
  const reviewFilterOptions = [
    { value: "all", label: "Tất cả đánh giá" },
    { value: "unanswered", label: `Chưa phản hồi (${unansweredReviews})` },
  ]
  const visibleProducts = filterShopProducts(
    products,
    productSearch,
    productStatus
  )
  const visibleInventoryProducts = filterShopProducts(
    inventoryProducts,
    inventorySearch,
    inventoryStatus
  )
  const visibleOrders = filterShopOrders(orders, orderSearch, orderStatus)
  const visibleReviews =
    reviewStatus === "unanswered"
      ? productReviews.filter((review) => !review.shop_reply)
      : productReviews
  const setActiveTab = (tab: ManagementTab) => router.push(managementHref(tab))
  const openTask = (tab: "orders" | "inventory" | "reviews") => {
    if (tab === "orders") {
      setOrderSearch("")
      setOrderStatus("open")
    } else if (tab === "inventory") {
      setInventorySearch("")
      setInventoryStatus("low-stock")
    } else {
      setReviewStatus("unanswered")
    }
    setActiveTab(tab)
  }
  const [orderedCategories, setOrderedCategories] = useState(
    categories.map((category) => category.id)
  )
  const categoryOrderHasChanged =
    orderedCategories.length !== categories.length ||
    orderedCategories.some(
      (categoryId, index) => categoryId !== categories[index]?.id
    )
  const moveCategory = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= orderedCategories.length) return
    const next = [...orderedCategories]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    setOrderedCategories(next)
  }

  return (
    <ShopManagementWorkspace
      user={user}
      activeTab={activeTab}
      openOrders={openOrders}
      unansweredReviews={unansweredReviews}
      onCreateProduct={() => setCreateProductOpen(true)}
    >
      {sectionPlaceholder}
      {!sectionPlaceholder && activeTab === "overview" ? (
        <ShopManagementOverview
          products={products}
          orders={recentOrders ?? orders}
          metrics={metrics}
          openOrders={openOrders}
          lowStock={lowStock}
          unansweredReviews={unansweredReviews}
          onNavigate={(tab) => {
            if (tab === "orders") {
              setOrderSearch("")
              setOrderStatus("all")
            }
            setActiveTab(tab)
          }}
          onTask={openTask}
        />
      ) : null}

      {activeTab === "settings" ? (
        <div className="space-y-6">
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Thông tin cửa hàng</CardTitle>
                <CardDescription>
                  Cập nhật ảnh đại diện và thông tin hiển thị công khai.
                </CardDescription>
              </CardHeader>
              <CardContent className="gap-8">
                <ShopAvatarForm user={user} />
                <ShopProfileForm user={user} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Trưng bày danh mục</CardTitle>
                <CardDescription>
                  Sắp xếp thứ tự danh mục trên trang cửa hàng.
                </CardDescription>
                {categoryOrderHasChanged ? (
                  <CardAction>
                    <Badge variant="secondary">Chưa lưu</Badge>
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent className="gap-2">
                {orderedCategories.map((categoryId, index) => {
                  const category = categories.find(
                    (item) => item.id === categoryId
                  )
                  if (!category) return null
                  return (
                    <Surface
                      padding="none"
                      key={category.id}
                      className="flex items-center gap-3 p-2.5"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                        {index + 1}
                      </span>
                      <p className="min-w-0 flex-1 truncate font-medium">
                        {category.name}
                      </p>
                      <ButtonGroup>
                        <Button
                          aria-label={`Đưa ${category.name} lên trên`}
                          tooltip={`Đưa ${category.name} lên trên`}
                          disabled={pending || index === 0}
                          size="icon-sm"
                          variant="outline"
                          onClick={() => moveCategory(index, -1)}
                        >
                          <ArrowUpIcon />
                        </Button>
                        <Button
                          aria-label={`Đưa ${category.name} xuống dưới`}
                          tooltip={`Đưa ${category.name} xuống dưới`}
                          disabled={
                            pending || index === orderedCategories.length - 1
                          }
                          size="icon-sm"
                          variant="outline"
                          onClick={() => moveCategory(index, 1)}
                        >
                          <ArrowDownIcon />
                        </Button>
                      </ButtonGroup>
                    </Surface>
                  )
                })}
                {orderedCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Chưa có danh mục hoạt động.
                  </p>
                ) : null}
              </CardContent>
              <CardFooter className="justify-end gap-2 border-t pt-4">
                <Button
                  startIcon={<RotateCcwIcon />}
                  disabled={pending || !categoryOrderHasChanged}
                  variant="outline"
                  onClick={() =>
                    setOrderedCategories(
                      categories.map((category) => category.id)
                    )
                  }
                >
                  Đặt lại
                </Button>
                <Button
                  startIcon={<SaveIcon />}
                  disabled={
                    pending ||
                    !categoryOrderHasChanged ||
                    orderedCategories.length === 0
                  }
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        const state =
                          await reorderCategoriesAction(orderedCategories)
                        if (state.success) {
                          toast.success(state.message)
                        } else {
                          toast.error(state.message)
                        }
                      } catch (error) {
                        toast.error(
                          mutationErrorMessage(
                            error,
                            "Không thể sắp xếp danh mục."
                          )
                        )
                      }
                    })
                  }
                >
                  {pending ? "Đang lưu..." : "Lưu thứ tự"}
                </Button>
              </CardFooter>
            </Card>
          </div>
          <ShopShippingSettings />
        </div>
      ) : null}

      {!sectionPlaceholder && activeTab === "products" ? (
        <div className="space-y-6">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Danh sách sản phẩm</CardTitle>
              <CardDescription>
                Quản lý trạng thái và thông tin cơ bản của sản phẩm.
              </CardDescription>
              <CardAction>
                <Badge variant="secondary">{products.length} sản phẩm</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="gap-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <InputGroup className="flex-1">
                  <InputGroupAddon>
                    <SearchIcon aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    aria-label="Tìm sản phẩm"
                    placeholder="Tìm theo tên, mã SKU, danh mục..."
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                  />
                </InputGroup>
                <Select
                  items={productFilterOptions}
                  value={productStatus}
                  onValueChange={(value) => setProductStatus(value ?? "all")}
                >
                  <SelectTrigger
                    aria-label="Trạng thái sản phẩm"
                    className="w-full sm:w-52"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {productFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground" role="status">
                {visibleProducts.length} / {products.length} sản phẩm
              </p>
              {visibleProducts.length > 0 ? (
                <ProductList
                  key={`${productSearch}:${productStatus}`}
                  products={visibleProducts}
                />
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <PackageIcon />
                    </EmptyMedia>
                    <EmptyTitle>
                      {products.length === 0
                        ? "Đăng sản phẩm đầu tiên"
                        : "Không tìm thấy sản phẩm"}
                    </EmptyTitle>
                    <EmptyDescription>
                      {products.length === 0
                        ? "Thêm ảnh, giá bán và tồn kho để bắt đầu bán hàng."
                        : "Thử tên, mã SKU hoặc trạng thái khác."}
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      startIcon={
                        products.length === 0 ? (
                          <PackagePlusIcon />
                        ) : (
                          <FilterXIcon />
                        )
                      }
                      variant="outline"
                      onClick={() => {
                        if (products.length === 0) setCreateProductOpen(true)
                        else {
                          setProductSearch("")
                          setProductStatus("all")
                        }
                      }}
                    >
                      {products.length === 0 ? "Đăng sản phẩm" : "Xóa bộ lọc"}
                    </Button>
                  </EmptyContent>
                </Empty>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {!sectionPlaceholder && activeTab === "inventory" ? (
        <div className="space-y-6">
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Điều chỉnh tồn kho</CardTitle>
                <CardDescription>
                  Chọn sản phẩm hoặc biến thể cần nhập thêm hay xuất bớt.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <InputGroup className="flex-1">
                    <InputGroupAddon>
                      <SearchIcon aria-hidden="true" />
                    </InputGroupAddon>
                    <InputGroupInput
                      aria-label="Tìm sản phẩm trong kho"
                      placeholder="Tìm tên hoặc mã SKU..."
                      value={inventorySearch}
                      onChange={(event) =>
                        setInventorySearch(event.target.value)
                      }
                    />
                  </InputGroup>
                  <Select
                    items={inventoryFilterOptions}
                    value={inventoryStatus}
                    onValueChange={(value) =>
                      setInventoryStatus(value ?? "all")
                    }
                  >
                    <SelectTrigger
                      aria-label="Lọc tồn kho"
                      className="w-full sm:w-48"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {inventoryFilterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground" role="status">
                  {visibleInventoryProducts.length} / {inventoryProducts.length}{" "}
                  sản phẩm
                </p>
                <Accordion className="gap-3" multiple>
                  {visibleInventoryProducts.map((product) => (
                    <AccordionItem
                      key={product.id}
                      className="rounded-xl border px-4"
                      value={`inventory-${product.id}`}
                    >
                      <AccordionTrigger className="min-w-0 items-center gap-2 py-3 hover:no-underline">
                        <span className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden pr-1 text-left">
                          <MediaImage
                            alt={product.name}
                            className="size-12 shrink-0 rounded-md border"
                            fallbackLabel="Chưa có ảnh"
                            sizes="48px"
                            src={product.image_url}
                          />
                          <span className="min-w-0 flex-1 overflow-hidden">
                            <span className="line-clamp-2 block font-medium break-words">
                              {product.name}
                            </span>
                            <span className="block truncate text-xs font-normal text-muted-foreground">
                              {product.shared_stock
                                ? `Tồn kho chung: ${product.stock}`
                                : `Tồn hiện tại: ${product.stock}`}
                              {product.has_variants && !product.shared_stock
                                ? " • Có biến thể"
                                : ""}
                            </span>
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ProductInventoryForm product={product} />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
                {visibleInventoryProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Không có sản phẩm phù hợp để điều chỉnh tồn kho.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Lịch sử gần đây</CardTitle>
                <CardDescription>
                  Theo dõi tối đa 100 lần điều chỉnh mới nhất.
                </CardDescription>
              </CardHeader>
              <CardContent className="gap-4">
                <InventoryMovementList movements={inventoryMovements} />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {!sectionPlaceholder && activeTab === "promotions" ? (
        <div className="space-y-6">
          <ShopCouponManager coupons={coupons} products={couponProducts} />
        </div>
      ) : null}

      {!sectionPlaceholder && activeTab === "reviews" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Đánh giá sản phẩm</CardTitle>
              <CardDescription>
                Hiển thị tối đa 100 đánh giá gần nhất. Mở từng đánh giá để phản
                hồi hoặc cập nhật câu trả lời.
              </CardDescription>
              <CardAction>
                <Badge variant="secondary">
                  {productReviews.filter((review) => !review.shop_reply).length}{" "}
                  chưa phản hồi
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <Select
                items={reviewFilterOptions}
                value={reviewStatus}
                onValueChange={(value) => setReviewStatus(value ?? "all")}
              >
                <SelectTrigger
                  aria-label="Lọc đánh giá"
                  className="w-full sm:w-60"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reviewFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Accordion className="gap-3" multiple>
                {visibleReviews.map((review) => (
                  <ReviewReplyForm key={review.id} review={review} />
                ))}
              </Accordion>
              {visibleReviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {reviewStatus === "unanswered"
                    ? "Không có đánh giá nào đang chờ phản hồi."
                    : "Cửa hàng chưa có đánh giá sản phẩm."}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {!sectionPlaceholder && activeTab === "orders" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Đơn hàng</CardTitle>
              <CardDescription>
                Hiển thị tối đa 100 đơn gần nhất; mỗi đơn chỉ có các bước xử lý
                hợp lệ tiếp theo.
              </CardDescription>
              <CardAction>
                <Badge variant="secondary">{orders.length} đơn</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="gap-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <InputGroup className="flex-1">
                  <InputGroupAddon>
                    <SearchIcon aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    aria-label="Tìm đơn hàng"
                    placeholder="Mã đơn, tên khách, số điện thoại, sản phẩm..."
                    value={orderSearch}
                    onChange={(event) => setOrderSearch(event.target.value)}
                  />
                </InputGroup>
                <Select
                  items={orderFilterOptions}
                  value={orderStatus}
                  onValueChange={(value) => setOrderStatus(value ?? "all")}
                >
                  <SelectTrigger
                    aria-label="Trạng thái đơn hàng"
                    className="w-full sm:w-52"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {orderFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground" role="status">
                {visibleOrders.length} / {orders.length} đơn hàng gần đây
              </p>
              {visibleOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
              {visibleOrders.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>
                      {orders.length === 0
                        ? "Chưa có đơn hàng"
                        : "Không có đơn hàng phù hợp"}
                    </EmptyTitle>
                    <EmptyDescription>
                      {orders.length === 0
                        ? "Đơn hàng mới sẽ xuất hiện tại đây."
                        : "Thử thay đổi từ khóa hoặc trạng thái đơn hàng."}
                    </EmptyDescription>
                  </EmptyHeader>
                  {orders.length > 0 ? (
                    <EmptyContent>
                      <Button
                        startIcon={<FilterXIcon />}
                        variant="outline"
                        onClick={() => {
                          setOrderSearch("")
                          setOrderStatus("all")
                        }}
                      >
                        Xóa bộ lọc
                      </Button>
                    </EmptyContent>
                  ) : null}
                </Empty>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
      <Sheet open={createProductOpen} onOpenChange={setCreateProductOpen}>
        <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Đăng sản phẩm mới</SheetTitle>
            <SheetDescription>
              Tải ảnh và nhập thông tin để đưa sản phẩm lên cửa hàng.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <CreateProductForm categories={categories} />
          </div>
        </SheetContent>
      </Sheet>
    </ShopManagementWorkspace>
  )
}
