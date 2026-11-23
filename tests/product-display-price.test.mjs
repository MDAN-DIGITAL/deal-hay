import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

function moduleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
}

function transpileModule(relativePath, imports = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }
  )

  return moduleUrl(
    outputText.replace(/from (["'])([^"']+)\1/g, (match, quote, specifier) => {
      assert.ok(imports[specifier], `Unmocked import: ${specifier}`)
      return `from ${quote}${imports[specifier]}${quote}`
    })
  )
}

const uiUrl = moduleUrl(`
  import { createElement } from ${JSON.stringify(import.meta.resolve("react"))}
  const wrapper = ({ children }) => createElement("div", null, children)
  export default wrapper
  export const Badge = wrapper
  export const Button = wrapper
  export const AddToCartButton = () => createElement("button", null, "Thêm vào giỏ hàng")
  export const Card = wrapper
  export const CardContent = wrapper
  export const CardFooter = wrapper
  export const MediaImage = () => null
  export const ArrowUpRightIcon = () => null
  export const EyeIcon = () => null
  export const PackageCheckIcon = () => null
`)
const formatUrl = transpileModule("../src/lib/format.ts")
const utilsUrl = transpileModule("../src/lib/utils.ts", {
  clsx: import.meta.resolve("clsx"),
  "tailwind-merge": import.meta.resolve("tailwind-merge"),
})
const pricingUrl = transpileModule(
  "../src/modules/public/lib/product-pricing.ts"
)
const { formatCurrency } = await import(formatUrl)
const { ProductCard } = await import(
  transpileModule("../src/modules/public/components/product-card.tsx", {
    "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
    "next/link": uiUrl,
    "lucide-react": uiUrl,
    "@/components/media-image": uiUrl,
    "@/components/ui/badge": uiUrl,
    "@/components/ui/button": uiUrl,
    "@/components/ui/card": uiUrl,
    "@/lib/format": formatUrl,
    "@/lib/utils": utilsUrl,
    "@/modules/cart/components/add-to-cart-button": uiUrl,
    "@/modules/public/lib/product-pricing": pricingUrl,
  })
)

function renderCard(prices, cartShopCode) {
  return renderToStaticMarkup(
    createElement(ProductCard, {
      href: "/shops/test-shop/products/test-product",
      cartShopCode,
      product: {
        id: "product-1",
        name: "Variant product",
        category: "Test category",
        stock: 2,
        price: 50000,
        has_variants: true,
        ...prices,
      },
    })
  )
}

test("homepage cards show both purchase actions and the remaining stock", () => {
  const rendered = renderCard({ stock: 2 }, "test-shop")
  assert.match(rendered, /Xem chi tiết/)
  assert.match(rendered, /Thêm vào giỏ hàng/)
  assert.match(rendered, /Còn 2 sản phẩm/)
})

test("catalog cards show the initial variant price instead of the base price", () => {
  const rendered = renderCard({ display_price: 80000 })

  assert.ok(rendered.includes(formatCurrency(80000)))
  assert.ok(!rendered.includes(formatCurrency(50000)))
})

test("a zero-priced variant does not fall back to the base price", () => {
  const rendered = renderCard({ display_price: 0 })

  assert.ok(rendered.includes(formatCurrency(0)))
  assert.ok(!rendered.includes(formatCurrency(50000)))
})

test("older API responses and simple products retain their base price", () => {
  assert.ok(renderCard({}).includes(formatCurrency(50000)))
})

test("the sale price is primary and the original price is a struck reference", () => {
  const rendered = renderCard({
    display_price: 80000,
    display_original_price: 100000,
    advertisement_available: true,
  })
  assert.ok(rendered.includes(formatCurrency(100000)))
  assert.ok(rendered.includes(formatCurrency(80000)))
  assert.match(rendered, /aria-label="Giá bán"[^>]*>80/)
  assert.match(rendered, /aria-label="Giá gốc"[^>]*line-through/)
  assert.ok(!rendered.includes("Giá khi dùng mã ưu đãi"))
})

test("ad availability does not replace the sale price with the original or preview price", () => {
  const rendered = renderCard({
    display_price: 80000,
    display_original_price: 100000,
    display_ad_price: 60000,
    advertisement_available: false,
  })
  assert.ok(rendered.includes(formatCurrency(100000)))
  assert.ok(rendered.includes(formatCurrency(80000)))
  assert.ok(!rendered.includes(formatCurrency(60000)))
  assert.ok(!rendered.includes("Giá khi dùng mã ưu đãi"))
})

test("a reference below the selected variant sale price is not shown as an offer", () => {
  const rendered = renderCard({ display_price: 120000, old_price: 100000 })
  assert.ok(rendered.includes(formatCurrency(120000)))
  assert.ok(!rendered.includes(formatCurrency(100000)))
  assert.ok(!rendered.includes("line-through"))
})
