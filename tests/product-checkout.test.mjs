import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

function transpile(relativePath, imports = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }
  )
  const source = outputText.replace(
    /from (["'])([^"']+)\1/g,
    (_, quote, specifier) => {
      assert.ok(imports[specifier], `Unexpected import: ${specifier}`)
      return `from ${quote}${imports[specifier]}${quote}`
    }
  )
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
}

const variantsUrl = transpile("../src/modules/public/lib/variant-selection.ts")
const {
  normalizeShopCouponCode,
  productCheckoutHref,
  productDetailHref,
  productOfferHref,
  resolveCheckoutVariant,
} = await import(
  transpile("../src/modules/public/lib/product-checkout.ts", {
    "@/modules/public/lib/variant-selection": variantsUrl,
  })
)

const variant = (id, overrides = {}) => ({
  id,
  sku: id,
  option_values: { "Màu sắc": "Đỏ" },
  price: 125000,
  stock: 5,
  is_active: true,
  is_default: false,
  ...overrides,
})

test("advertising offer links preserve the selected variant and existing codes across the extra step", () => {
  const options = { variantId: "variant/&", discountCode: "CODE&A", shopCouponCode: "SHOP+CODE" }
  const offer = new URL(productOfferHref("SHOP 1", "áo/thun", options), "https://dealhay.test")
  assert.equal(offer.pathname, "/shops/SHOP%201/products/%C3%A1o%2Fthun/offer")
  const checkout = new URL(productCheckoutHref("SHOP 1", "áo/thun", options), "https://dealhay.test")
  assert.deepEqual([...checkout.searchParams], [...offer.searchParams])
  assert.equal(productOfferHref("SHOP", "product"), "/shops/SHOP/products/product/offer")
})

test("checkout links open a dedicated route and encode each product segment", () => {
  assert.equal(
    productCheckoutHref("SHOP 1", "áo/thun?new=1"),
    "/shops/SHOP%201/products/%C3%A1o%2Fthun%3Fnew%3D1/checkout"
  )
})

test("checkout links preserve the exact selected variant and coupon without query injection", () => {
  const href = productCheckoutHref("SHOP-1", "ao-thun", {
    variantId: "variant /&other=1",
    discountCode: "DH-A&B + 20%",
  })
  const url = new URL(href, "https://deal-hay.local")
  assert.equal(url.pathname, "/shops/SHOP-1/products/ao-thun/checkout")
  assert.deepEqual(
    [...url.searchParams],
    [
      ["variant_id", "variant /&other=1"],
      ["discount_code", "DH-A&B + 20%"],
    ]
  )
})

test("shop offers open product detail and remain separate from saved discount codes", () => {
  const detail = new URL(
    productDetailHref("SHOP 1", "áo/thun?new=1", {
      variantId: "variant /&other=1",
      shopCouponCode: "SHOP-A&B + 20%",
    }),
    "https://deal-hay.local"
  )
  assert.equal(
    detail.pathname,
    "/shops/SHOP%201/products/%C3%A1o%2Fthun%3Fnew%3D1"
  )
  assert.deepEqual(
    [...detail.searchParams],
    [
      ["variant_id", "variant /&other=1"],
      ["shop_coupon_code", "SHOP-A&B + 20%"],
    ]
  )

  const checkout = new URL(
    productCheckoutHref("SHOP 1", "áo/thun?new=1", {
      discountCode: "PERSONAL-CODE",
      shopCouponCode: "SHOP-CODE",
    }),
    "https://deal-hay.local"
  )
  assert.equal(checkout.pathname.endsWith("/checkout"), true)
  assert.equal(checkout.searchParams.get("discount_code"), "PERSONAL-CODE")
  assert.equal(checkout.searchParams.get("shop_coupon_code"), "SHOP-CODE")
})

test("shop offer query codes are normalized and bounded independently", () => {
  assert.equal(normalizeShopCouponCode("  shop-mixed-01  "), "SHOP-MIXED-01")
  assert.equal(normalizeShopCouponCode("   "), undefined)
  assert.equal(normalizeShopCouponCode(["SHOP-ONE", "SHOP-TWO"]), undefined)
  assert.equal(normalizeShopCouponCode("A".repeat(40)), "A".repeat(40))
  assert.equal(normalizeShopCouponCode("A".repeat(41)), undefined)
})

test("legacy links retain repeated variant parameters so checkout can reject ambiguous choices", () => {
  const url = new URL(
    productCheckoutHref("SHOP-1", "ao-thun", {
      variantId: ["variant-one", "variant-two"],
      discountCode: "DH-COUPON",
    }),
    "https://deal-hay.local"
  )
  assert.deepEqual(url.searchParams.getAll("variant_id"), [
    "variant-one",
    "variant-two",
  ])
  assert.equal(url.searchParams.get("discount_code"), "DH-COUPON")
})

test("opening checkout without a variant selects the available catalog default", () => {
  const regular = variant("regular")
  const preferred = variant("preferred", { is_default: true })
  assert.deepEqual(
    resolveCheckoutVariant({
      has_variants: true,
      variants: [regular, preferred],
    }),
    { variant: preferred, invalidVariant: false }
  )
  assert.deepEqual(
    resolveCheckoutVariant({
      has_variants: true,
      variants: [regular, { ...preferred, stock: 0 }],
    }),
    { variant: regular, invalidVariant: false }
  )
})

test("explicit active selections retain their own stock and price even when another variant is default", () => {
  const selected = variant("chosen", { stock: 0, price: 175000 })
  const preferred = variant("preferred", { is_default: true })
  assert.deepEqual(
    resolveCheckoutVariant(
      { has_variants: true, variants: [selected, preferred] },
      selected.id
    ),
    { variant: selected, invalidVariant: false }
  )
})

test("invalid, hidden, and repeated explicit selections cannot silently order a different variant", () => {
  const preferred = variant("preferred", { is_default: true })
  const hidden = variant("hidden", { is_active: false })
  for (const value of [
    "missing",
    "hidden",
    "",
    ["preferred"],
    ["preferred", "hidden"],
  ]) {
    const result = resolveCheckoutVariant(
      { has_variants: true, variants: [preferred, hidden] },
      value
    )
    assert.equal(result.invalidVariant, true, JSON.stringify(value))
    assert.equal(result.variant, undefined, JSON.stringify(value))
  }
})

test("products without variants can checkout normally and reject stale variant identifiers", () => {
  const product = { has_variants: false, variants: [] }
  assert.deepEqual(resolveCheckoutVariant(product), {
    variant: undefined,
    invalidVariant: false,
  })
  assert.equal(
    resolveCheckoutVariant(product, "old-variant").invalidVariant,
    true
  )
})

test("products declaring variants have no selected variant when no active choice exists", () => {
  for (const variants of [[], [variant("hidden", { is_active: false })]]) {
    const result = resolveCheckoutVariant({ has_variants: true, variants })
    assert.equal(result.variant, undefined)
    assert.equal(result.invalidVariant, false)
  }
})
