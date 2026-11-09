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

const pricingUrl = transpile("../src/modules/public/lib/product-pricing.ts")
const { productPricing } = await import(pricingUrl)
const variantsUrl = transpile("../src/modules/public/lib/variant-selection.ts")
const navigationUrl = transpile(
  "../src/modules/public/lib/product-checkout.ts",
  {
    "@/modules/public/lib/variant-selection": variantsUrl,
  }
)
const { summarizeDiscountCodes } = await import(
  transpile("../src/modules/discount-codes/lib/discount-codes.ts", {
    "@/modules/public/lib/product-checkout": navigationUrl,
  })
)

test("original, direct sale, and after-ad prices remain three separate amounts", () => {
  assert.deepEqual(productPricing({ price: 100000, old_price: 200000 }), {
    salePrice: 100000,
    originalPrice: 200000,
    adDiscount: 25000,
    afterAdPrice: 75000,
    adDiscountPercent: 25,
  })
  assert.equal(productPricing({ price: 100000 }).afterAdPrice, 75000)
  for (const old_price of [null, 100000, 50000]) {
    assert.equal(
      productPricing({ price: 100000, old_price }).originalPrice,
      null
    )
  }
})

test("selected variant sale prices override the initial catalog price without scaling the reference", () => {
  const product = {
    price: 100000,
    old_price: 200000,
    display_price: 150000,
    display_original_price: 200000,
  }
  assert.equal(productPricing(product).salePrice, 150000)
  assert.deepEqual(productPricing(product, { price: 120000 }), {
    salePrice: 120000,
    originalPrice: 200000,
    adDiscount: 30000,
    afterAdPrice: 90000,
    adDiscountPercent: 25,
  })
  assert.equal(productPricing(product, { price: 250000 }).originalPrice, null)
  assert.equal(productPricing(product, { price: null }).salePrice, 100000)
  assert.equal(productPricing(product, { price: 0 }).salePrice, 0)
  assert.equal(productPricing(product, { price: 0 }).afterAdPrice, 0)
})

test("VND discount previews round the discount half up, including large odd prices", () => {
  for (const [price, afterAdPrice] of [
    [100000, 75000],
    [100001, 75001],
    [100002, 75001],
    [100003, 75002],
    [999999997, 749999998],
    [999999999, 749999999],
    [Number.MAX_SAFE_INTEGER, 6755399441055743],
  ]) {
    assert.equal(
      productPricing({ price }).afterAdPrice,
      afterAdPrice,
      `${price}`
    )
  }
})

const code = (id) => ({
  id,
  code: `AD-${id}`,
  reward_type: "percentage",
  reward_value: 2500,
  original_price: 100002,
  sale_price: 75001,
  is_available: true,
})

test("checkout keeps the sale amount until a verified code is selected and rounds the order subtotal", () => {
  const { salePrice } = productPricing({ price: 100002, old_price: 200004 })
  assert.deepEqual(summarizeDiscountCodes(salePrice, 3, []), {
    subtotal: 300006,
    discount: 0,
    total: 300006,
    appliedCodes: [],
  })
  const selected = [code("one")]
  assert.deepEqual(summarizeDiscountCodes(salePrice, 3, selected), {
    subtotal: 300006,
    discount: 75002,
    total: 225004,
    appliedCodes: selected,
  })
  assert.equal(
    summarizeDiscountCodes(salePrice, 3, [
      code("one"),
      code("two"),
      code("three"),
      code("four"),
      code("unused"),
    ]).total,
    0
  )
})

const queryUrl = moduleUrl(`
  export let response
  export function setResponse(value) { response = value }
  export function useApiQuery() { return { data: response } }
  export const QueryPlaceholder = "query-placeholder"
`)
const { setResponse } = await import(queryUrl)
const { ProductCheckoutPageContainer } = await import(
  transpile(
    "../src/modules/public/containers/product-checkout-page-container.tsx",
    {
      "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
      "next/link": moduleUrl('export default "a"'),
      "lucide-react": moduleUrl('export const ArrowLeftIcon = "arrow"'),
      "@/hooks/use-api-query": queryUrl,
      "@/api/catalog/queries": moduleUrl("export function getProduct() {}"),
      "@/components/layout/empty-state": moduleUrl(
        'export const EmptyState = "empty-state"'
      ),
      "@/components/ui/button": moduleUrl(
        'export const buttonVariants = () => "button"'
      ),
      "@/modules/public/components/product-checkout": moduleUrl(
        'export const ProductCheckout = "checkout"'
      ),
      "@/modules/public/lib/product-checkout": navigationUrl,
      "@/modules/public/lib/product-pricing": pricingUrl,
    }
  )
)

test("the actual checkout route passes the selected sale price rather than a reconstructed original", () => {
  const variants = [
    {
      id: "default",
      price: 120000,
      stock: 1,
      is_active: true,
      is_default: true,
    },
    {
      id: "chosen",
      price: 150000,
      stock: 2,
      is_active: true,
      is_default: false,
    },
    {
      id: "fallback",
      price: null,
      stock: 3,
      is_active: true,
      is_default: false,
    },
  ]
  setResponse({
    shop: { code: "shop" },
    product: {
      id: "product",
      price: 100000,
      old_price: 200000,
      has_variants: true,
      variants,
    },
  })
  for (const [variantId, expected] of [
    [undefined, 120000],
    ["chosen", 150000],
    ["fallback", 100000],
  ]) {
    const checkout = ProductCheckoutPageContainer({
      shopUserCode: "shop",
      productSlug: "product",
      variantId,
    })
    assert.equal(checkout.props.salePrice, expected)
    assert.equal(checkout.props.regularPrice, undefined)
  }
})

const uiUrl = moduleUrl(`
  export const FormSelect = "select", FormSubmitButton = "submit", SelectedFilePreview = "preview",
    Badge = "badge", Button = "button", Card = "card", CardContent = "content",
    CardDescription = "description", CardHeader = "header", CardTitle = "title",
    Form = "form", FormControl = "control", FormField = "field", FormItem = "item",
    FormLabel = "label", FormMessage = "message", Input = "input", Separator = "separator",
    Surface = "surface", Textarea = "textarea", UserAvatar = "avatar", ImageUploadProgress = "progress"
  export const buttonVariants = () => "button"
`)
const noopUrl = moduleUrl(`
  export function useForm() {}
  export function zodResolver() {}
  export function useImageUpload() {}
  export function appendOptionalFile() {}
  export function applyServerErrors() {}
  export function runUploadAction() {}
  export function deleteReviewAction() {}
  export function reactShopAction() {}
  export function reviewProductAction() {}
  export function toggleFollowAction() {}
  export const reviewProductSchema = {}, IMAGE_UPLOAD_ACCEPT = "image/*", toast = {}
`)
const { ProductInteractions } = await import(
  transpile("../src/modules/public/components/product-interactions.tsx", {
    cn: moduleUrl('export const cn = (...classes) => classes.filter(Boolean).join(" ")'),
    react: moduleUrl(`
      export const useState = (initial) => [typeof initial === "function" ? initial() : initial, () => {}]
      export const useTransition = () => [false, () => {}]
    `),
    "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
    "next/link": moduleUrl('export default "a"'),
    "lucide-react": moduleUrl(`
      export const BadgeCheckIcon = "icon", CirclePlayIcon = "icon", HeartIcon = "icon",
        PackageCheckIcon = "icon", PaperclipIcon = "icon", ThumbsDownIcon = "icon",
        ThumbsUpIcon = "icon", ShoppingBagIcon = "icon", TicketPercentIcon = "icon"
    `),
    "@hookform/resolvers/zod": noopUrl,
    "react-hook-form": noopUrl,
    sonner: noopUrl,
    ...Object.fromEntries(
      [
        "form-select",
        "form-submit-button",
        "selected-file-preview",
        "ui/badge",
        "ui/button",
        "ui/card",
        "ui/form",
        "ui/input",
        "ui/separator",
        "ui/surface",
        "ui/textarea",
        "user-avatar",
        "image-upload-progress",
      ].map((path) => [`@/components/${path}`, uiUrl])
    ),
    "@/lib/form-utils": noopUrl,
    "@/lib/validation": noopUrl,
    "@/hooks/use-image-upload": noopUrl,
    "@/lib/format": transpile("../src/lib/format.ts"),
    "@/modules/public/actions": noopUrl,
    "@/modules/public/schemas/reviews": noopUrl,
    "@/modules/public/lib/variant-selection": variantsUrl,
    "@/modules/public/lib/product-checkout": navigationUrl,
    "@/modules/public/lib/product-pricing": pricingUrl,
  })
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

test("product detail labels the selected variant sale and the separate conditional 25% preview", () => {
  for (const old_price of [200000, null]) {
    const tree = ProductInteractions({
      shop: { code: "shop", viewer: {} },
      product: {
        price: 100000,
        old_price,
        variants: [
          {
            id: "chosen",
            price: 120000,
            stock: 1,
            is_active: true,
            is_default: true,
            option_values: {},
          },
        ],
        options: [],
        has_variants: true,
        stock: 1,
      },
    })
    const values = elements(tree)
    assert.equal(
      textContent(
        values.find((item) => item.props?.["aria-label"] === "Giá mua ngay")
      ),
      formatCurrency(120000)
    )
    assert.equal(
      textContent(
        values.find(
          (item) =>
            item.props?.["aria-label"] === "Giá dự kiến sau mã quảng cáo 25%"
        )
      ),
      formatCurrency(90000)
    )
    assert.ok(
      textContent(tree).includes(
        "Giá dự kiến khi áp dụng mã quảng cáo 25% hợp lệ"
      )
    )
    assert.equal(textContent(tree).includes("Giá gốc:"), old_price !== null)
    const offer = values.find(
      (item) =>
        item.type === "a" && textContent(item).includes("Mua với ưu đãi")
    )
    assert.ok(offer.props.href.endsWith("#checkout-discount-title"))
    assert.ok(!offer.props.href.includes("discount_code"))
  }
})
