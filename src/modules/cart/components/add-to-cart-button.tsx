"use client"

import { ShoppingCartIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  type ComponentProps,
  useId,
  useRef,
  useState,
  useTransition,
} from "react"
import { toast } from "sonner"

import { ApiError } from "@/api/client"
import { getCheckoutProduct } from "@/api/catalog/queries"
import type { CheckoutProductResponse } from "@/api/catalog/types"
import { AppSelect } from "@/components/app-select"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { formatCurrency } from "@/lib/format"
import { productPricing } from "@/modules/public/lib/product-pricing"
import { cartAvailability, cartHref, productVariantLabel } from "../lib/cart"
import { addCartItem, useCart } from "../lib/cart-store"

function CartVariantPicker({
  snapshot,
  pending,
  onAdd,
}: {
  snapshot: CheckoutProductResponse
  pending: boolean
  onAdd: (variantId: string) => void
}) {
  const lines = useCart()
  const fieldId = useId()
  const [variantId, setVariantId] = useState("")
  const product = snapshot.product
  const options = product.variants
    .filter((variant) => variant.is_active)
    .map((variant) => {
      const availability = cartAvailability(product, variant.id, lines)
      const remaining = availability?.remaining ?? 0
      return {
        value: variant.id,
        label: `${productVariantLabel(variant)} · ${formatCurrency(productPricing(product, variant).salePrice)} · Có thể thêm ${remaining}`,
        disabled: remaining === 0,
      }
    })
  const selected = variantId
    ? cartAvailability(product, variantId, lines)
    : null

  return (
    <>
      <Field data-disabled={pending}>
        <FieldLabel htmlFor={fieldId}>Phân loại</FieldLabel>
        <AppSelect
          id={fieldId}
          aria-describedby={`${fieldId}-stock`}
          options={options}
          value={variantId}
          onValueChange={setVariantId}
          disabled={pending}
          placeholder="Chọn phân loại"
        />
        <FieldDescription id={`${fieldId}-stock`} aria-live="polite">
          {selected
            ? `Kho còn ${selected.stock} · Có thể thêm ${selected.remaining} sản phẩm`
            : options.every((option) => option.disabled)
              ? "Giỏ hàng đã đạt giới hạn tồn kho hoặc sản phẩm đã hết hàng."
              : "Chọn phân loại để xem số lượng có thể thêm."}
        </FieldDescription>
      </Field>
      <DialogFooter>
        <Button
          type="button"
          startIcon={
            pending ? <Spinner aria-hidden="true" /> : <ShoppingCartIcon />
          }
          disabled={pending || !selected?.remaining}
          onClick={() => onAdd(variantId)}
        >
          {pending ? "Đang kiểm tra tồn kho..." : "Thêm vào giỏ hàng"}
        </Button>
      </DialogFooter>
    </>
  )
}

export function AddToCartButton({
  shopCode,
  productSlug,
  productId,
  variantId,
  disabled,
  className,
  variant = "default",
  size = "sm",
}: {
  shopCode: string
  productSlug: string
  productId: string
  variantId?: string
  disabled?: boolean
  className?: string
  variant?: ComponentProps<typeof Button>["variant"]
  size?: ComponentProps<typeof Button>["size"]
}) {
  const router = useRouter()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [pending, startTransition] = useTransition()
  const [picker, setPicker] = useState<CheckoutProductResponse | null>(null)

  const checkAndAdd = (selectedVariantId?: string) =>
    startTransition(async () => {
      try {
        const snapshot = await getCheckoutProduct(shopCode, productSlug)
        const product = snapshot.product
        if (product.id !== productId)
          throw new Error("Sản phẩm đã thay đổi. Vui lòng tải lại trang.")
        if (
          (product.has_variants || product.variants.length > 0) &&
          !selectedVariantId
        ) {
          if (product.stock < 1) throw new Error("Sản phẩm vừa hết hàng.")
          setPicker(snapshot)
          return
        }
        // Check again when a buyer confirms the variant after the dialog opened.
        if (picker) setPicker(snapshot)
        await addCartItem(snapshot, selectedVariantId ?? null, productId)
        setPicker(null)
        toast.success("Đã thêm vào giỏ hàng.", {
          action: {
            label: "Xem giỏ hàng",
            onClick: () => router.push(cartHref),
          },
        })
      } catch (error) {
        toast.error(
          error instanceof ApiError &&
            (error.status === 404 || error.status === 410)
            ? "Sản phẩm hiện không còn bán."
            : error instanceof TypeError
              ? "Chưa kiểm tra được tồn kho. Vui lòng thử lại."
              : error instanceof Error
                ? error.message
                : "Không thể thêm sản phẩm vào giỏ hàng."
        )
      }
    })

  return (
    <>
      <Button
        ref={triggerRef}
        startIcon={
          pending ? <Spinner aria-hidden="true" /> : <ShoppingCartIcon />
        }
        className={className}
        variant={variant}
        type="button"
        size={size}
        aria-busy={pending}
        disabled={pending || disabled}
        onClick={() => checkAndAdd(variantId)}
      >
        {pending ? "Đang kiểm tra..." : "Thêm vào giỏ hàng"}
      </Button>
      {picker ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setPicker(null)
          }}
        >
          <DialogContent
            finalFocus={triggerRef}
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
          >
            <DialogHeader className="pr-8">
              <DialogTitle>Chọn phân loại</DialogTitle>
              <DialogDescription className="wrap-anywhere">
                {picker.product.name}
              </DialogDescription>
            </DialogHeader>
            <CartVariantPicker
              snapshot={picker}
              pending={pending}
              onAdd={checkAndAdd}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
