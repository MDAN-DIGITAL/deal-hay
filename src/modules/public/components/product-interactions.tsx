"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  BadgeCheckIcon,
  CirclePlayIcon,
  HeartIcon,
  PackageCheckIcon,
  PaperclipIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  ShoppingBagIcon,
  TicketPercentIcon,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { cn } from "cn"

import { FormSelect } from "@/components/form-select"
import { FormSubmitButton } from "@/components/form-submit-button"
import { SelectedFilePreview } from "@/components/selected-file-preview"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Surface } from "@/components/ui/surface"
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar } from "@/components/user-avatar"
import {
  appendOptionalFile,
  applyServerErrors,
  runUploadAction,
} from "@/lib/form-utils"
import { IMAGE_UPLOAD_ACCEPT } from "@/lib/validation"
import { ImageUploadProgress } from "@/components/image-upload-progress"
import { useImageUpload } from "@/hooks/use-image-upload"
import { formatCurrency } from "@/lib/format"
import {
  deleteReviewAction,
  reactShopAction,
  reviewProductAction,
  toggleFollowAction,
} from "@/modules/public/actions"
import {
  reviewProductSchema,
  type ReviewProductValues,
} from "@/modules/public/schemas/reviews"
import {
  defaultProductVariant,
  selectProductVariant,
  variantHasOption,
} from "@/modules/public/lib/variant-selection"
import {
  productCheckoutHref,
  productOfferHref,
} from "@/modules/public/lib/product-checkout"
import { productPricing } from "@/modules/public/lib/product-pricing"
import type { PublicProduct, PublicShop } from "@/types/catalog"

function ReviewProductForm({
  shopCode,
  productSlug,
}: {
  shopCode: string
  productSlug: string
}) {
  const [isPending, startTransition] = useTransition()
  const { prepareUploads, uploadProgress } = useImageUpload()
  const form = useForm<ReviewProductValues>({
    resolver: zodResolver(reviewProductSchema),
    defaultValues: { reaction: "like", content: "", image: undefined },
  })

  const onSubmit = form.handleSubmit((values) => {
    const formData = new FormData()
    formData.set("reaction", values.reaction)
    formData.set("content", values.content)
    appendOptionalFile(formData, "image", values.image)

    startTransition(async () => {
      const state = await runUploadAction(async () =>
        reviewProductAction(
          shopCode,
          productSlug,
          await prepareUploads(formData, "review")
        )
      )
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)
      if (state.success) {
        toast.success(state.message)
        form.reset({ reaction: "like", content: "", image: undefined })
      } else if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <Form {...form}>
      <form className="space-y-4" noValidate onSubmit={onSubmit}>
        <FormField
          control={form.control}
          name="reaction"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mức độ hài lòng</FormLabel>
              <FormSelect
                inputRef={field.ref}
                name={field.name}
                options={[
                  { label: "Hài lòng với sản phẩm", value: "like" },
                  { label: "Chưa hài lòng", value: "dislike" },
                ]}
                value={field.value}
                onBlur={field.onBlur}
                onValueChange={field.onChange}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nội dung đánh giá</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Chia sẻ trải nghiệm thực tế của bạn..."
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="image"
          render={({ field: { onChange, value, ...field } }) => (
            <FormItem>
              <FormLabel>Ảnh minh họa (tuỳ chọn)</FormLabel>
              <FormControl>
                <div>
                  {value instanceof File ? (
                    <SelectedFilePreview
                      file={value}
                      onRemove={() => onChange(undefined)}
                    />
                  ) : (
                    <Input
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
          className="w-full"
          idleText="Gửi đánh giá"
          pending={isPending}
          pendingText="Đang gửi..."
        />
      </form>
    </Form>
  )
}

export function ProductInteractions({
  shop,
  product,
  canReview = false,
  hasReview = false,
  initialDiscountCode,
  initialShopCouponCode,
  initialVariantId,
}: {
  shop: PublicShop
  product: PublicProduct
  canReview?: boolean
  hasReview?: boolean
  initialDiscountCode?: string
  initialShopCouponCode?: string
  initialVariantId?: string
}) {
  const [isPending, startTransition] = useTransition()
  const [selectedVariantId, setSelectedVariantId] = useState(
    () =>
      product.variants.find(
        (variant) => variant.id === initialVariantId && variant.is_active
      )?.id ?? defaultProductVariant(product.variants)?.id
  )
  const hasVariants = product.has_variants || product.variants.length > 0
  const selectedVariant = hasVariants
    ? (product.variants.find(
        (variant) => variant.id === selectedVariantId && variant.is_active
      ) ?? defaultProductVariant(product.variants))
    : undefined
  const { salePrice, originalPrice } = productPricing(product, selectedVariant)
  const displayedStock =
    selectedVariant?.stock ?? (hasVariants ? 0 : product.stock)
  const hasOfferPrice = salePrice > 0
  const checkoutHref = productCheckoutHref(shop.code, product.slug, {
    variantId: selectedVariant?.id,
    discountCode: initialDiscountCode,
    shopCouponCode: initialShopCouponCode,
  })
  const offerHref = productOfferHref(shop.code, product.slug, {
    variantId: selectedVariant?.id,
    discountCode: initialDiscountCode,
    shopCouponCode: initialShopCouponCode,
  })
  const checkoutDisabled =
    isPending || displayedStock < 1 || (hasVariants && !selectedVariant)

  const runAction = (
    action: () => Promise<unknown>,
    successMessage: string,
    errorMessage: string
  ) =>
    startTransition(async () => {
      try {
        await action()
        toast.success(successMessage)
      } catch {
        toast.error(errorMessage)
      }
    })

  return (
    <div className="min-w-0 space-y-4 lg:sticky lg:top-28">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{product.category}</Badge>
            {product.label ? (
              <Badge variant="outline">{product.label}</Badge>
            ) : null}
          </div>
          <CardTitle
            as="h1"
            className="font-heading text-2xl leading-tight sm:text-3xl"
          >
            {product.name}
          </CardTitle>
          <CardDescription>
            {selectedVariant ? "SKU biến thể" : "Mã sản phẩm"}:{" "}
            {selectedVariant?.sku || product.sku || "Đang cập nhật"}
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-5">
          <div aria-live="polite" className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Giá mua ngay
              </p>
              <p aria-label="Giá mua ngay" className="text-3xl font-semibold">
                {formatCurrency(salePrice)}
              </p>
              {originalPrice !== null ? (
                <p className="text-sm text-muted-foreground">
                  Giá gốc:{" "}
                  <span className="line-through">
                    {formatCurrency(originalPrice)}
                  </span>
                </p>
              ) : null}
            </div>
            {hasOfferPrice ? (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Ưu đãi khi thanh toán
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Chọn mã giảm giá hợp lệ ở bước thanh toán để xem mức giảm và
                    số tiền cần trả.
                  </p>
                </div>
              </>
            ) : null}
          </div>
          {initialShopCouponCode ? (
            <Surface
              variant="muted"
              padding="sm"
              className="flex items-start gap-3 border-primary/20"
            >
              <TicketPercentIcon
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-primary"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">Đã gắn ưu đãi từ shop</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  Mã{" "}
                  <span className="font-semibold break-all text-foreground">
                    {initialShopCouponCode}
                  </span>{" "}
                  sẽ được kiểm tra và tự động áp dụng khi bạn đặt hàng.
                </p>
              </div>
            </Surface>
          ) : null}
          <Surface
            variant="muted"
            padding="sm"
            className="flex items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2 text-sm">
              <PackageCheckIcon className="size-4 text-primary" /> Tình trạng
            </span>
            <Badge
              aria-live="polite"
              variant={displayedStock > 0 ? "secondary" : "destructive"}
            >
              {displayedStock > 0
                ? `Còn ${displayedStock} sản phẩm`
                : "Tạm hết hàng"}
            </Badge>
          </Surface>

          {hasVariants && product.options.length > 0 ? (
            <div className="space-y-3">
              {product.options.map((option) => (
                <fieldset key={option.id ?? option.name} className="space-y-2">
                  <legend className="text-sm font-medium">{option.name}</legend>
                  <div className="flex flex-wrap gap-2">
                    {option.values.map((value) => {
                      const candidate = selectProductVariant(
                        product.variants,
                        selectedVariant,
                        option.name,
                        value
                      )
                      const isSelected = selectedVariant
                        ? variantHasOption(selectedVariant, option.name, value)
                        : false

                      return (
                        <Button
                          key={value}
                          aria-pressed={isSelected}
                          disabled={!candidate}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => setSelectedVariantId(candidate?.id)}
                        >
                          {value}
                        </Button>
                      )
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          ) : null}

          {hasVariants && product.options.length === 0 ? (
            <div
              aria-label="Biến thể sản phẩm"
              className="flex flex-wrap gap-2"
              role="group"
            >
              {product.variants
                .filter((variant) => variant.is_active)
                .map((variant) => (
                  <Button
                    key={variant.id}
                    aria-pressed={selectedVariant?.id === variant.id}
                    type="button"
                    variant={
                      selectedVariant?.id === variant.id ? "default" : "outline"
                    }
                    onClick={() => setSelectedVariantId(variant.id)}
                  >
                    {variant.variant_label || variant.sku}
                  </Button>
                ))}
            </div>
          ) : null}

          {hasVariants ? (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {selectedVariant
                ? `Đã chọn: ${selectedVariant.variant_label || Object.values(selectedVariant.option_values).join(" · ") || selectedVariant.sku}`
                : "Sản phẩm chưa có biến thể đang bán."}
            </p>
          ) : null}

          {checkoutDisabled ? (
            <div className="space-y-3">
              {hasOfferPrice ? (
                <Button
                  className="h-auto min-h-12 w-full gap-3 py-3 whitespace-normal"
                  disabled
                  size="lg"
                >
                  <CirclePlayIcon />
                  <span className="flex min-w-0 flex-1 flex-col items-start text-left leading-tight">
                    <span>Mua với ưu đãi</span>
                    <span className="text-xs font-normal opacity-80">
                      Chọn mã giảm giá từ cửa hàng
                    </span>
                  </span>
                </Button>
              ) : null}
              <Button
                className="h-auto min-h-12 w-full gap-3 py-3 whitespace-normal"
                disabled
                size="lg"
                variant={hasOfferPrice ? "outline" : "default"}
              >
                <ShoppingBagIcon />
                <span className="flex min-w-0 flex-1 flex-col items-start text-left leading-tight">
                  <span>Mua ngay</span>
                  {hasOfferPrice ? (
                    <span className="text-xs font-normal text-muted-foreground">
                      Thanh toán theo giá đang bán
                    </span>
                  ) : null}
                </span>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {hasOfferPrice ? (
                <Link
                  className={cn(
                    buttonVariants({
                      className:
                        "h-auto min-h-12 w-full gap-3 py-3 whitespace-normal",
                      size: "lg",
                    })
                  )}
                  href={offerHref}
                  prefetch={false}
                >
                  <CirclePlayIcon />
                  <span className="flex min-w-0 flex-1 flex-col items-start text-left leading-tight">
                    <span>Mua với ưu đãi</span>
                    <span className="text-xs font-normal opacity-80">
                      Chọn mã giảm giá từ cửa hàng
                    </span>
                  </span>
                </Link>
              ) : null}
              <Link
                className={cn(
                  buttonVariants({
                    className:
                      "h-auto min-h-12 w-full gap-3 py-3 whitespace-normal",
                    size: "lg",
                    variant: hasOfferPrice ? "outline" : "default",
                  })
                )}
                href={checkoutHref}
              >
                <ShoppingBagIcon />
                <span className="flex min-w-0 flex-1 flex-col items-start text-left leading-tight">
                  <span>Mua ngay</span>
                  {hasOfferPrice ? (
                    <span className="text-xs font-normal text-muted-foreground">
                      Thanh toán theo giá đang bán
                    </span>
                  ) : null}
                </span>
              </Link>
              {hasOfferPrice ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  Ưu đãi từ shop không yêu cầu xem hoặc nhấp quảng cáo.
                </p>
              ) : null}
            </div>
          )}

          <Separator />

          <div className="flex items-center gap-3">
            <UserAvatar
              className="size-11"
              name={shop.name}
              size="lg"
              src={shop.avatar_url}
            />
            <div className="min-w-0 flex-1">
              <Link
                className="flex items-center gap-1.5 font-medium hover:text-primary"
                href={`/shops/${shop.code}`}
              >
                <span className="truncate">{shop.name}</span>
                <BadgeCheckIcon className="size-4 shrink-0 text-primary" />
              </Link>
              <p className="text-xs text-muted-foreground">
                {shop.is_online ? "Đang hoạt động" : "Hiện không trực tuyến"} ·{" "}
                {shop.followers_count} người theo dõi
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              disabled={isPending}
              variant={shop.viewer.is_following ? "secondary" : "outline"}
              onClick={() =>
                runAction(
                  () => toggleFollowAction(shop.code, shop.viewer.is_following),
                  shop.viewer.is_following
                    ? "Đã bỏ theo dõi cửa hàng."
                    : "Đã theo dõi cửa hàng.",
                  "Không thể cập nhật theo dõi."
                )
              }
            >
              <HeartIcon />{" "}
              <span className="hidden sm:inline">
                {shop.viewer.is_following ? "Đang theo dõi" : "Theo dõi"}
              </span>
            </Button>
            <Button
              disabled={isPending}
              variant={
                shop.viewer.reaction === "like" ? "secondary" : "outline"
              }
              onClick={() =>
                runAction(
                  () => reactShopAction(shop.code, "like"),
                  "Đã gửi phản hồi tích cực.",
                  "Không thể gửi phản hồi."
                )
              }
            >
              <ThumbsUpIcon /> <span className="sr-only">Thích cửa hàng</span>
            </Button>
            <Button
              disabled={isPending}
              variant={
                shop.viewer.reaction === "dislike" ? "secondary" : "outline"
              }
              onClick={() =>
                runAction(
                  () => reactShopAction(shop.code, "dislike"),
                  "Đã ghi nhận phản hồi.",
                  "Không thể gửi phản hồi."
                )
              }
            >
              <ThumbsDownIcon />{" "}
              <span className="sr-only">Không thích cửa hàng</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Đánh giá sản phẩm</CardTitle>
          <CardDescription>
            Chia sẻ trải nghiệm để giúp cộng đồng mua sắm tốt hơn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canReview ? (
            <ReviewProductForm
              productSlug={product.slug}
              shopCode={shop.code}
            />
          ) : (
            <Surface
              variant="muted"
              padding="sm"
              render={<p />}
              className="text-muted-foreground"
            >
              Bạn cần đặt sản phẩm này trước khi đánh giá.
            </Surface>
          )}
          <Separator />
          <Button
            className="w-full"
            disabled={isPending || !hasReview}
            type="button"
            variant="ghost"
            onClick={() =>
              runAction(
                () => deleteReviewAction(shop.code, product.slug),
                "Đã xoá đánh giá của bạn.",
                "Không thể xoá đánh giá."
              )
            }
          >
            <PaperclipIcon /> Xoá đánh giá hiện tại
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
