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
    Badge = "badge", Section = "section", Separator = "separator", Button = "button",
    Breadcrumb = "breadcrumb", BreadcrumbItem = "breadcrumb-item", BreadcrumbLink = "breadcrumb-link",
    BreadcrumbList = "breadcrumb-list", BreadcrumbPage = "breadcrumb-page", BreadcrumbSeparator = "breadcrumb-separator"
  export const buttonVariants = () => "button"
`)
const hookUrl = moduleUrl(`
  export const useState = (initial) => globalThis.__offerScreen.useState(initial)
  export const useEffect = (effect, deps) => globalThis.__offerScreen.useEffect(effect, deps)
  export const loadShopOffersAction = (shop, product) => globalThis.__offerScreen.loadOffers(shop, product)
  export const ShopOfferSelector = "shop-offer-selector"
`)
const pricingUrl = transpile("../src/modules/public/lib/product-pricing.ts")
const { ProductOfferPageContainer } = await import(
  transpile(
    "../src/modules/public/containers/product-offer-page-container.tsx",
    {
      "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
      react: hookUrl,
      "next/link": moduleUrl('export default "a"'),
      "lucide-react": moduleUrl(
        'export const ArrowLeftIcon = "icon", ArrowRightIcon = "icon", CirclePlayIcon = "icon", ShoppingBagIcon = "icon", TicketPercentIcon = "icon"'
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
      "@/components/ui/badge": uiUrl,
      "@/components/ui/breadcrumb": uiUrl,
      "@/components/ui/button": uiUrl,
      "@/components/ui/section": uiUrl,
      "@/components/ui/separator": uiUrl,
      "@/hooks/use-api-query": queryUrl,
      "@/lib/format": transpile("../src/lib/format.ts"),
      "@/modules/public/components/product-advertisement": moduleUrl(
        'export const ProductAdvertisement = "product-advertisement"'
      ),
      "@/modules/public/components/shop-offers": hookUrl,
      "@/modules/public/lib/shop-offers": transpile("../src/modules/public/lib/shop-offers.ts"),
      "@/modules/public/shop-offer-actions": hookUrl,
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

let screens = []
test.beforeEach(() => {
  const intervals = new Map(), events = new Map()
  globalThis.window = {
    intervals, events,
    setInterval(fn) { const id = Symbol("interval"); intervals.set(id, fn); return id },
    clearInterval(id) { intervals.delete(id) },
    addEventListener(event, fn) { events.set(event, fn) },
    removeEventListener(event, fn) { if (events.get(event) === fn) events.delete(event) },
  }
  screens = []
})
test.afterEach(() => {
  for (const screen of screens) screen.dispose()
  delete globalThis.__offerScreen
  delete globalThis.window
})

function mount(productData, props = {}, response = { success: true, data: [] }) {
  setResult({ data: { shop: { name: "Shop thử" }, product: productData } })
  const root = ProductOfferPageContainer({
    shopUserCode: "SHOP /1",
    productSlug: "áo/thun?new=1",
    ...props,
  })
  const slots = []
  let cursor = 0, dirty = false, effects = []
  const screen = {
    root, tree: root, response, requests: [],
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial
      return [slots[index], (next) => {
        const value = typeof next === "function" ? next(slots[index]) : next
        if (!Object.is(value, slots[index])) { slots[index] = value; dirty = true }
      }]
    },
    useEffect(effect, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((value, position) => !Object.is(value, previous.deps[position])))
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: effect() } })
    },
    loadOffers(shop, productId) {
      this.requests.push({ shop, productId })
      return Promise.resolve(this.response)
    },
    render() {
      if (typeof this.root.type !== "function") return this.tree
      globalThis.__offerScreen = this
      let count = 0
      do {
        assert.ok(++count < 20, "offer state must settle")
        cursor = 0; dirty = false; effects = []
        this.tree = this.root.type(this.root.props)
        effects.forEach((effect) => effect())
      } while (dirty)
      return this.tree
    },
    async settle() {
      for (let count = 0; count < 20; count++) {
        await Promise.resolve()
        if (dirty) this.render()
      }
      return this.tree
    },
    select(id) {
      elements(this.tree).find((item) => item.type === "shop-offer-selector").props.onSelect(id)
      this.render()
    },
    reload() {
      elements(this.tree).find((item) => item.type === "shop-offer-selector").props.onReload()
      this.render()
    },
    dispose() { slots.forEach((slot) => slot?.cleanup?.()) },
  }
  screens.push(screen)
  screen.render()
  return screen
}

function render(productData, props = {}) {
  return mount(productData, props).tree
}

function advertisements(tree) {
  return elements(tree).filter((item) => item.type === "product-advertisement")
}

function checkout(tree) {
  return elements(tree).find((item) => item.type === "a" && textContent(item).includes("Tiếp tục thanh toán"))
}
function checkoutUrl(tree) { return new URL(checkout(tree).props.href, "https://deal-hay.local") }
function picker(tree) { return elements(tree).find((item) => item.type === "shop-offer-selector") }
const offer = (overrides = {}) => ({
  id: "shop-offer", code: "SHOP-OFFER", name: "Ưu đãi từ cửa hàng",
  discount_type: "percent", discount_value: 15, minimum_order_amount: 0,
  maximum_discount_amount: null, remaining_uses: 10, starts_at: null, ends_at: null,
  products: [{ id: "product", name: "Sản phẩm thử", slug: "san-pham" }], ...overrides,
})

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

test("a shop coupon applies to the selected sale price and checkout without waiting for any advertisement signal", async () => {
  const screen = mount(product({ has_variants: true, variants: [variant("chosen", { price: 150003 })] }), {
    variantId: "chosen", initialDiscountCode: "SAVED-WALLET-CODE",
  }, { success: true, data: [offer()] })
  assert.equal(checkout(screen.tree).props["aria-disabled"], undefined)
  assert.equal(picker(screen.tree).props.disabled, false)
  await screen.settle()
  screen.select("shop-offer")
  assert.ok(textContent(screen.tree).includes(formatCurrency(22500)))
  assert.ok(textContent(screen.tree).includes(formatCurrency(127503)))
  assert.ok(textContent(screen.tree).includes("Tạm tính chưa gồm mã cá nhân và phí vận chuyển"))
  assert.equal(checkoutUrl(screen.tree).searchParams.get("variant_id"), "chosen")
  assert.equal(checkoutUrl(screen.tree).searchParams.get("shop_coupon_code"), "SHOP-OFFER")
  assert.equal(checkoutUrl(screen.tree).searchParams.get("discount_code"), "SAVED-WALLET-CODE")
  assert.equal(advertisements(screen.tree).length, 1)
})

test("an initial linked shop coupon resolves and respects its maximum discount", async () => {
  const screen = mount(product(), { initialShopCouponCode: "shop-offer" }, { success: true, data: [offer({ maximum_discount_amount: 10000 })] })
  assert.equal(checkoutUrl(screen.tree).searchParams.get("shop_coupon_code"), "shop-offer")
  await screen.settle()
  assert.equal(picker(screen.tree).props.selectedId, "shop-offer")
  assert.ok(textContent(screen.tree).includes(formatCurrency(90000)))
  assert.ok(!textContent(screen.tree).includes("Mã đã chọn chưa được xác nhận"))
})

test("a missing or failed linked coupon is carried to checkout visibly until the customer explicitly removes it", async () => {
  for (const response of [{ success: true, data: [] }, { success: false, message: "Ưu đãi chưa tải được" }]) {
    const screen = mount(product(), { initialShopCouponCode: "MISSING-CODE" }, response)
    await screen.settle()
    assert.ok(textContent(screen.tree).includes("Mã đã chọn chưa được xác nhận"))
    assert.equal(checkoutUrl(screen.tree).searchParams.get("shop_coupon_code"), "MISSING-CODE")
    assert.ok(textContent(screen.tree).includes(formatCurrency(100000)))
    assert.equal(picker(screen.tree).props.disabled, false)
    screen.select("")
    assert.equal(checkoutUrl(screen.tree).searchParams.has("shop_coupon_code"), false)
  }
})

test("explicitly skipping an initial coupon while it loads prevents the fetched response from restoring it", async () => {
  const screen = mount(product(), { initialShopCouponCode: "SHOP-OFFER" }, { success: true, data: [offer()] })
  screen.select("")
  await screen.settle()
  assert.equal(picker(screen.tree).props.selectedId, "")
  assert.equal(checkoutUrl(screen.tree).searchParams.has("shop_coupon_code"), false)
  assert.ok(textContent(screen.tree).includes(formatCurrency(100000)))
})

test("a selected coupon that disappears during refresh loses its estimate but is not silently discarded", async () => {
  const screen = mount(product(), {}, { success: true, data: [offer()] })
  await screen.settle()
  screen.select("shop-offer")
  assert.ok(textContent(screen.tree).includes(formatCurrency(85000)))
  screen.response = { success: true, data: [] }
  screen.reload()
  await screen.settle()
  assert.ok(textContent(screen.tree).includes("Mã đã chọn chưa được xác nhận"))
  assert.ok(textContent(screen.tree).includes(formatCurrency(100000)))
  assert.equal(checkoutUrl(screen.tree).searchParams.get("shop_coupon_code"), "SHOP-OFFER")
})

test("an idle page stops previewing an expired coupon while retaining explicit selection for checkout validation", async (t) => {
  let now = Date.parse("2030-01-01T00:00:00Z")
  t.mock.method(Date, "now", () => now)
  const screen = mount(product(), { initialShopCouponCode: "SHOP-OFFER" }, { success: true, data: [offer({ ends_at: "2030-01-01T00:01:00Z" })] })
  await screen.settle()
  assert.ok(textContent(screen.tree).includes(formatCurrency(85000)))
  now += 61000
  for (const tick of window.intervals.values()) tick()
  screen.render()
  assert.ok(textContent(screen.tree).includes(formatCurrency(100000)))
  assert.ok(textContent(screen.tree).includes("Mã đã chọn chưa được xác nhận"))
  assert.equal(checkoutUrl(screen.tree).searchParams.get("shop_coupon_code"), "SHOP-OFFER")
})
