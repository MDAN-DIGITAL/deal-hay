import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const jsx = moduleUrl(`
  export const Fragment="fragment"
  export const jsx=(type,props,key)=>({type,props,key})
  export const jsxs=jsx
`)

function transpile(path, imports = {}, jsxEnabled = false) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: jsxEnabled ? ts.JsxEmit.ReactJSX : undefined,
    },
  }).outputText

  return moduleUrl(
    output.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
      const replacement = name === "react/jsx-runtime" ? jsx : imports[name]
      assert.ok(replacement, `Unexpected import: ${name}`)
      return `from ${quote}${replacement}${quote}`
    })
  )
}

function nodes(node) {
  if (!node || typeof node !== "object") return []
  return [
    node,
    ...[]
      .concat(node.props?.children ?? [])
      .flat(Infinity)
      .flatMap(nodes),
  ]
}

const runtime = moduleUrl(`
  export const SITE_URL=new URL("https://dealhay.example.test")
  export const apiAssetUrl=(value)=>{
    if (!value) return undefined
    return value.startsWith("/api/")
      ? new URL(value,"https://api.example.test/api").href
      : value
  }
  export const defaultProductVariant=(variants)=>{
    const active=variants.filter((variant)=>variant.is_active)
    return active.find((variant)=>variant.is_default&&variant.stock>0)
      ?? active.find((variant)=>variant.stock>0)
      ?? active.find((variant)=>variant.is_default)
      ?? active[0]
  }
`)
const seo = await import(
  transpile("../src/lib/seo.ts", {
    "@/config/env": runtime,
    "@/config/site": runtime,
    "@/modules/public/lib/variant-selection": runtime,
  })
)

test("brand structured data gives Google one consistent site and crawlable logo", () => {
  const data = seo.siteStructuredData()
  assert.equal(data["@context"], "https://schema.org")
  const website = data["@graph"].find(({ "@type": type }) => type === "WebSite")
  const store = data["@graph"].find(
    ({ "@type": type }) => type === "OnlineStore"
  )
  assert.equal(website.name, "Deal Hay")
  assert.equal(website.alternateName, "DealHay")
  assert.equal(website.url, "https://dealhay.example.test/")
  assert.equal(store.logo.url, "https://dealhay.example.test/dealhay-logo.svg")
  assert.equal(store.logo.width, 512)
  assert.equal(website.publisher["@id"], store["@id"])
  assert.equal(
    seo.BRAND_OPEN_GRAPH_IMAGE,
    "https://dealhay.example.test/dealhay-social.png"
  )
})

test("product structured data exposes VND price, stock, seller, images and breadcrumbs", () => {
  const canonical =
    "https://dealhay.example.test/shops/SHOP-01/products/dien-thoai"
  const data = seo.productStructuredData(
    {
      shop: { code: "SHOP-01", name: "An Store" },
      product: {
        name: "Điện thoại",
        category: "Điện thoại",
        description: "  Máy đẹp\n cấu hình mạnh. ",
        sku: "PHONE-01",
        price: 15_200_000,
        stock: 0,
        image_url: "/api/media/assets/shop/main.webp",
        images: [{ id: "1", image_url: "/api/media/assets/shop/gallery.webp" }],
        variants: [
          {
            is_active: true,
            is_default: true,
            price: 15_000_000,
            stock: 0,
            sku: "SOLD-OUT",
          },
          {
            is_active: true,
            is_default: false,
            price: 15_100_000,
            stock: 2,
            sku: "AVAILABLE",
          },
        ],
      },
    },
    canonical
  )
  const product = data["@graph"].find(({ "@type": type }) => type === "Product")
  const breadcrumbs = data["@graph"].find(
    ({ "@type": type }) => type === "BreadcrumbList"
  )

  assert.equal(product.url, canonical)
  assert.equal(product.offers.price, 15_100_000)
  assert.equal(product.offers.priceCurrency, "VND")
  assert.equal(product.offers.availability, "https://schema.org/InStock")
  assert.equal(product.offers.seller.name, "An Store")
  assert.equal(product.sku, "AVAILABLE")
  assert.deepEqual(product.image, [
    "https://api.example.test/api/media/assets/shop/main.webp",
    "https://api.example.test/api/media/assets/shop/gallery.webp",
  ])
  assert.equal(product.description, "Máy đẹp cấu hình mạnh.")
  assert.equal(breadcrumbs.itemListElement.at(-1).item, canonical)
  assert.equal("aggregateRating" in product, false)
})

test("SEO URLs reject unsafe images, encode routes and JSON-LD cannot close its script", () => {
  assert.equal(
    seo.productPath("SHOP/01", "máy?đẹp"),
    "/shops/SHOP%2F01/products/m%C3%A1y%3F%C4%91%E1%BA%B9p"
  )
  for (const value of [
    "javascript:alert(1)",
    "https://user:secret@images.test/photo.webp",
    "https://images.test/photo.webp?token=secret",
    "/relative/photo.webp",
  ]) {
    assert.equal(seo.seoImageUrl(value), null, value)
  }
  const payload = { name: "</script><script>alert(1)</script>" }
  const serialized = seo.serializeJsonLd(payload)
  assert.equal(serialized.includes("<"), false)
  assert.equal(JSON.parse(serialized).name, payload.name)
})

test("the visible brand uses a real responsive SVG mark", async () => {
  const utils = moduleUrl(
    'export const cn=(...values)=>values.flat().filter(Boolean).join(" ")'
  )
  const { Brand } = await import(
    transpile("../src/components/ui/brand.tsx", { "@/lib/utils": utils }, true)
  )
  const tree = nodes(Brand({ compact: true }))
  const mark = tree.find(({ type }) => type === "svg")
  const wordmark = tree.find(
    ({ type, props }) =>
      type === "span" && String(props.className).includes("font-heading")
  )
  assert.equal(mark.props.viewBox, "0 0 64 64")
  assert.equal(mark.props["aria-hidden"], "true")
  assert.equal(mark.props.focusable, "false")
  assert.ok(tree.filter(({ type }) => type === "path").length >= 2)
  assert.match(wordmark.props.className, /hidden/)
})

test("public, app and notification assets share the Deal Hay identity", async () => {
  const logo = readFileSync(
    new URL("../public/dealhay-logo.svg", import.meta.url),
    "utf8"
  )
  const appIcon = readFileSync(
    new URL("../src/app/icon.svg", import.meta.url),
    "utf8"
  )
  assert.match(logo, /width="512" height="512"/)
  assert.match(logo, /#C84B1F/)
  assert.doesNotMatch(logo, /<text\b/)
  assert.match(appIcon, /viewBox="0 0 64 64"/)

  for (const [file, size] of [
    ["../src/app/apple-icon.png", 180],
    ["../public/notification-icon-192.png", 192],
    ["../public/notification-icon-512.png", 512],
    ["../public/notification-badge.png", 96],
  ]) {
    const png = readFileSync(new URL(file, import.meta.url))
    assert.equal(png.subarray(1, 4).toString(), "PNG")
    assert.equal(png.readUInt32BE(16), size)
    assert.equal(png.readUInt32BE(20), size)
  }

  const social = readFileSync(
    new URL("../public/dealhay-social.png", import.meta.url)
  )
  assert.equal(social.readUInt32BE(16), 1200)
  assert.equal(social.readUInt32BE(20), 630)

  const favicon = readFileSync(
    new URL("../src/app/favicon.ico", import.meta.url)
  )
  assert.equal(favicon.readUInt16LE(2), 1)
  assert.equal(favicon.readUInt16LE(4), 1)

  const { default: manifest } = await import(
    transpile("../src/app/manifest.ts")
  )
  const app = manifest()
  assert.equal(app.theme_color, "#c84b1f")
  assert.equal(app.short_name, "DealHay")
  assert.ok(app.icons.some(({ purpose }) => purpose === "maskable"))
})
