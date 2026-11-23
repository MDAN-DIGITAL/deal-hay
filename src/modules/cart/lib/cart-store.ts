"use client"

import { useSyncExternalStore } from "react"

import type { CheckoutProductResponse } from "@/api/catalog/types"
import {
  cartAvailability,
  cartLineKey,
  productVariantLabel,
  readCartLines,
  type CartLine,
  type CartLineId,
} from "./cart"

const storageKey = "dealhay:cart:v1"
const cartChanged = "dealhay:cart-changed"
const emptyCart: readonly CartLine[] = []
let cachedRaw: string | null = null
let cachedLines: readonly CartLine[] = emptyCart

function linesSnapshot(): readonly CartLine[] {
  if (typeof window === "undefined") return emptyCart
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (cachedRaw !== raw) {
      cachedRaw = raw
      cachedLines = readCartLines(raw)
    }
  } catch {
    // A restricted browser may prevent access to local storage.
  }
  return cachedLines
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) listener()
  }
  window.addEventListener("storage", onStorage)
  window.addEventListener(cartChanged, listener)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(cartChanged, listener)
  }
}

export function useCart() {
  return useSyncExternalStore(subscribe, linesSnapshot, () => emptyCart)
}

async function mutateCart(
  update: (lines: readonly CartLine[]) => readonly CartLine[]
) {
  const commit = () => {
    const current = linesSnapshot()
    const next = update(current)
    if (current === next) return
    const raw = JSON.stringify(next)
    try {
      window.localStorage.setItem(storageKey, raw)
    } catch {
      throw new Error("Trình duyệt chưa cho phép lưu giỏ hàng.")
    }
    cachedLines = next
    cachedRaw = raw
    window.dispatchEvent(new Event(cartChanged))
  }
  if (navigator.locks) await navigator.locks.request(storageKey, commit)
  else commit()
}

export function addCartItem(
  { product, shop }: CheckoutProductResponse,
  variantId: string | null,
  expectedProductId: string
) {
  return mutateCart((lines) => {
    if (product.id !== expectedProductId)
      throw new Error("Sản phẩm đã thay đổi. Vui lòng tải lại trang.")

    const stock = cartAvailability(product, variantId, lines)
    if (!stock) throw new Error("Phân loại đã chọn không còn bán.")
    if (stock.stock <= 0) throw new Error("Sản phẩm vừa hết hàng.")
    if (stock.remaining <= 0)
      throw new Error(
        `Kho còn ${stock.stock} sản phẩm. Giỏ hàng đã đạt số lượng có thể mua.`
      )

    const key = cartLineKey({ productId: product.id, variantId })
    const existing = lines.find((line) => cartLineKey(line) === key)
    const line: CartLine = {
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      shopCode: shop.code,
      shopName: shop.name,
      variantId,
      variantLabel: stock.variant ? productVariantLabel(stock.variant) : "",
      quantity: (existing?.quantity ?? 0) + 1,
    }

    return existing
      ? lines.map((item) => (item === existing ? line : item))
      : [...lines, line]
  })
}

export function removeCartItem(id: CartLineId, quantity?: number) {
  const key = cartLineKey(id)
  return mutateCart((lines) => {
    const existing = lines.find((line) => cartLineKey(line) === key)
    if (!existing) return lines
    if (quantity === undefined || quantity >= existing.quantity)
      return lines.filter((line) => line !== existing)
    return lines.map((line) =>
      line === existing ? { ...line, quantity: line.quantity - quantity } : line
    )
  })
}
