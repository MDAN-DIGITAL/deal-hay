import type { ShopOffer } from "@/types/shop-coupon"

export type LinkedShopOfferStatus =
  | "pending"
  | "applied"
  | "unavailable"
  | "error"
  | "overridden"
  | "skipped"
  | null

export type LinkedShopOfferSelection = {
  selectedId: string
  status: LinkedShopOfferStatus
  userOverridden: boolean
}

export function findShopOfferByCode(
  offers: ShopOffer[],
  code: string
): ShopOffer | undefined {
  const normalized = code.trim().toUpperCase()
  return offers.find((offer) => offer.code.trim().toUpperCase() === normalized)
}

export function createLinkedShopOfferSelection(
  requestedCode?: string
): LinkedShopOfferSelection {
  return {
    selectedId: "",
    status: requestedCode ? "pending" : null,
    userOverridden: false,
  }
}

/** Reconcile every successful refresh until the customer makes a choice. */
export function reconcileLinkedShopOfferSelection(
  current: LinkedShopOfferSelection,
  offers: ShopOffer[],
  requestedCode?: string
): LinkedShopOfferSelection {
  if (!requestedCode || current.userOverridden) return current
  const requestedOffer = findShopOfferByCode(offers, requestedCode)

  return requestedOffer
    ? {
        selectedId: requestedOffer.id,
        status: "applied",
        userOverridden: false,
      }
    : { selectedId: "", status: "unavailable", userOverridden: false }
}

export function overrideLinkedShopOfferSelection(
  current: LinkedShopOfferSelection,
  selectedId: string,
  hasLinkedCode: boolean
): LinkedShopOfferSelection {
  return {
    selectedId,
    status: hasLinkedCode ? (selectedId ? "overridden" : "skipped") : null,
    userOverridden: hasLinkedCode || current.userOverridden,
  }
}

export function linkedShopOfferBlocksOrder(
  status: LinkedShopOfferStatus
): boolean {
  return status === "pending" || status === "error" || status === "unavailable"
}

export function shopOfferDiscount(
  offer: ShopOffer | undefined,
  subtotal: number,
  remaining = subtotal,
  now = Date.now()
): number {
  if (
    !offer ||
    subtotal < offer.minimum_order_amount ||
    remaining <= 0 ||
    offer.remaining_uses === 0 ||
    (offer.starts_at && new Date(offer.starts_at).getTime() > now) ||
    (offer.ends_at && new Date(offer.ends_at).getTime() <= now)
  )
    return 0
  const discount =
    offer.discount_type === "percent"
      ? Math.floor((remaining * offer.discount_value) / 100)
      : offer.discount_value
  return Math.max(
    0,
    Math.min(remaining, discount, offer.maximum_discount_amount ?? discount)
  )
}
