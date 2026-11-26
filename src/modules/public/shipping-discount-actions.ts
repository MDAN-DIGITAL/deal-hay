import { ApiError, apiFetch } from "@/api/client"
import type { ActionState } from "@/types/forms"
import type { ShippingDiscountCode } from "@/types/shipping-discount-code"

function shippingDiscountCodePath(
  shopCode: string,
  productSlug: string
): string {
  return `/shops/${encodeURIComponent(shopCode)}/products/${encodeURIComponent(productSlug)}/shipping-offer/code`
}

function normalizeError(error: unknown): ActionState {
  if (error instanceof ApiError) {
    return {
      success: false,
      message:
        error.status === 401
          ? "Vui lòng đăng nhập để kiểm tra mã miễn phí vận chuyển."
          : error.message,
      errors: error.errors,
    }
  }
  return {
    success: false,
    message: "Không thể kiểm tra mã vận chuyển. Vui lòng thử lại.",
  }
}

export async function loadShippingDiscountCodeAction(
  shopCode: string,
  productSlug: string
): Promise<ActionState & { data?: ShippingDiscountCode | null }> {
  try {
    const response = await apiFetch<{
      shipping_discount_code: ShippingDiscountCode | null
    }>({
      method: "GET",
      path: shippingDiscountCodePath(shopCode, productSlug),
      cache: "no-store",
    })
    return { success: true, message: "", data: response.shipping_discount_code }
  } catch (error) {
    return normalizeError(error)
  }
}
