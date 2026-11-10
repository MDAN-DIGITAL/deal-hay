import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`

function transpile(path, imports = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }
  )
  return moduleUrl(
    outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, specifier) => {
      assert.ok(imports[specifier], `Unexpected import: ${specifier}`)
      return `from ${quote}${imports[specifier]}${quote}`
    })
  )
}

const variantsUrl = transpile("../src/modules/public/lib/variant-selection.ts")
const navigationUrl = transpile(
  "../src/modules/public/lib/product-checkout.ts",
  {
    "@/modules/public/lib/variant-selection": variantsUrl,
  }
)
const queryUrl = moduleUrl(`
  let result
  export function setResult(next) { result = next }
  export function useApiQuery() { return result }
  export const QueryPlaceholder = "query-placeholder"
`)
const { setResult } = await import(queryUrl)
const uiUrl = moduleUrl(`
  export const EmptyState = "empty-state", PageHeader = "page-header", MediaImage = "image",
    Card = "card", CardContent = "content", CardHeader = "header", CardTitle = "title", Surface = "surface"
  export const buttonVariants = () => "button"
`)
const pricingUrl = transpile("../src/modules/public/lib/product-pricing.ts")
const { ProductOfferPageContainer } = await import(
  transpile(
    "../src/modules/public/containers/product-offer-page-container.tsx",
    {
      "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
      "next/link": moduleUrl('export default "a"'),
      "lucide-react": moduleUrl(
        'export const ArrowLeftIcon = "icon", ArrowRightIcon = "icon", TicketPercentIcon = "icon"'
      ),
      cn: moduleUrl(
        'export const cn = (...values) => values.filter(Boolean).join(" ")'
      ),
      "@/api/catalog/queries": moduleUrl(
        "export function getProduct() { throw new Error('No real API requests in this test') }"
      ),
      "@/components/layout/empty-state": uiUrl,
      "@/components/layout/page-header": uiUrl,
      "@/components/media-image": uiUrl,
      "@/components/ui/button": uiUrl,
      "@/components/ui/card": uiUrl,
      "@/components/ui/surface": uiUrl,
      "@/hooks/use-api-query": queryUrl,
      "@/lib/format": transpile("../src/lib/format.ts"),
      "@/modules/public/components/product-advertisement": moduleUrl(
        'export const ProductAdvertisement = "product-advertisement"'
      ),
      "@/modules/public/lib/product-checkout": navigationUrl,
      "@/modules/public/lib/product-pricing": pricingUrl,
    }
  )
)
const { formatCurrency } = await import(transpile("../src/lib/format.ts"))

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== "object") return []
  return [node, ...elements(node.props?.children)]
}

function textContent(node) {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textContent).join("")
  return node?.props ? textContent(node.props.children) : ""
}

const variant = (id, overrides = {}) => ({
  id,
  price: 120000,
  stock: 2,
  is_active: true,
  is_default: false,
  option_values: { "Màu sắc": "Đỏ" },
  sku: `SKU-${id}`,
  ...overrides,
})

function product(overrides = {}) {
  return {
    id: "product",
    name: "Sản phẩm thử",
    price: 100000,
    old_price: 200000,
    has_variants: false,
    variants: [],
    images: [],
    stock: 3,
    ...overrides,
  }
}

function render(productData, props = {}) {
  setResult({ data: { shop: { name: "Shop thử" }, product: productData } })
  return ProductOfferPageContainer({
    shopUserCode: "SHOP /1",
    productSlug: "áo/thun?new=1",
    ...props,
  })
}

function advertisements(tree) {
  return elements(tree).filter((item) => item.type === "product-advertisement")
}

test("the offer route waits for successful product data before mounting any advertisement", () => {
  for (const result of [{}, { error: "Không thể tải sản phẩm" }]) {
    setResult(result)
    const tree = ProductOfferPageContainer({
      shopUserCode: "shop",
      productSlug: "product",
    })
    assert.equal(tree.type, "query-placeholder")
    assert.equal(tree.props.error, result.error)
    assert.equal(advertisements(tree).length, 0)
  }
})

test("invalid or ambiguous variants never mount an ad or silently choose another purchase", () => {
  const catalog = product({
    has_variants: true,
    variants: [
      variant("preferred", { is_default: true }),
      variant("hidden", { is_active: false }),
    ],
  })
  for (const variantId of [
    "missing",
    "hidden",
    "",
    ["preferred"],
    ["preferred", "hidden"],
  ]) {
    const tree = render(catalog, { variantId })
    assert.equal(tree.type, "empty-state")
    assert.equal(tree.props.title, "Phân loại đã chọn không còn khả dụng")
    assert.equal(advertisements(tree).length, 0)
    const back = new URL(tree.props.action.props.href, "https://deal-hay.local")
    assert.equal(
      back.pathname,
      "/shops/SHOP%20%2F1/products/%C3%A1o%2Fthun%3Fnew%3D1"
    )
    assert.equal(back.searchParams.has("variant_id"), false)
  }
})

test("out-of-stock products and unavailable variant catalogs never mount an advertisement", () => {
  for (const [catalog, props] of [
    [product({ stock: 0 }), {}],
    [product({ stock: 20, has_variants: true, variants: [] }), {}],
    [
      product({
        stock: 20,
        has_variants: true,
        variants: [variant("hidden", { is_active: false })],
      }),
      {},
    ],
    [
      product({
        has_variants: true,
        variants: [variant("sold", { stock: 0 }), variant("available")],
      }),
      { variantId: "sold" },
    ],
  ]) {
    const tree = render(catalog, props)
    assert.equal(tree.type, "empty-state")
    assert.equal(tree.props.title, "Sản phẩm tạm hết hàng")
    assert.equal(advertisements(tree).length, 0)
  }
})

test("a valid variant keeps both codes for checkout and returns to detail without its checkout redirect code", () => {
  const tree = render(
    product({
      has_variants: true,
      variants: [
        variant("default", { is_default: true }),
        variant("chosen /&", { price: 150003 }),
      ],
    }),
    {
      variantId: "chosen /&",
      initialDiscountCode: "DH-A&B +20%",
      initialShopCouponCode: "SHOP-CODE /&",
    }
  )
  assert.equal(advertisements(tree).length, 1)
  assert.ok(textContent(tree).includes(formatCurrency(150003)))
  assert.ok(!textContent(tree).includes(formatCurrency(200000)))
  assert.ok(!textContent(tree).includes("25%"))
  assert.ok(
    textContent(tree).includes("Quảng cáo không tự thay đổi giá sản phẩm.")
  )
  const links = elements(tree).filter((item) => item.type === "a")
  const checkout = links.find((item) =>
    textContent(item).includes("Tiếp tục thanh toán")
  )
  const back = links.find((item) =>
    textContent(item).includes("Quay lại sản phẩm")
  )
  for (const [link, suffix] of [
    [checkout, "/checkout"],
    [back, ""],
  ]) {
    const url = new URL(link.props.href, "https://deal-hay.local")
    assert.equal(
      url.pathname,
      `/shops/SHOP%20%2F1/products/%C3%A1o%2Fthun%3Fnew%3D1${suffix}`
    )
    assert.equal(url.searchParams.get("variant_id"), "chosen /&")
    assert.equal(url.searchParams.get("shop_coupon_code"), "SHOP-CODE /&")
    if (suffix === "/checkout") {
      assert.equal(url.searchParams.get("discount_code"), "DH-A&B +20%")
    } else {
      assert.equal(url.searchParams.has("discount_code"), false)
    }
  }
  assert.equal(
    new URL(checkout.props.href, "https://deal-hay.local").hash,
    "#checkout-discount-title"
  )
})

test("default available variants and simple products can continue without inventing a reward code", () => {
  for (const [catalog, expectedVariant, expectedPrice] of [
    [product(), null, 100000],
    [
      product({
        has_variants: true,
        variants: [
          variant("sold-default", { is_default: true, stock: 0 }),
          variant("available", { price: null }),
        ],
      }),
      "available",
      100000,
    ],
  ]) {
    const tree = render(catalog)
    assert.equal(advertisements(tree).length, 1)
    assert.ok(textContent(tree).includes(formatCurrency(expectedPrice)))
    const checkout = elements(tree).find(
      (item) =>
        item.type === "a" && textContent(item).includes("Tiếp tục thanh toán")
    )
    const url = new URL(checkout.props.href, "https://deal-hay.local")
    assert.equal(url.searchParams.get("variant_id"), expectedVariant)
    assert.equal(url.searchParams.has("discount_code"), false)
    assert.equal(url.searchParams.has("shop_coupon_code"), false)
  }
})
