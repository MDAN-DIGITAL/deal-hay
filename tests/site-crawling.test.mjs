import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (text) =>
  `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`
function load(path, imports = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }
  )
  return import(
    moduleUrl(
      outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
        assert.ok(imports[name], `Unexpected import ${name}`)
        return `from ${quote}${imports[name]}${quote}`
      })
    )
  )
}

const { resolveSiteUrl } = await load("../src/config/site.ts")
const site = moduleUrl(
  'export const SITE_URL = new URL("https://dealhay.example.test")'
)
const api = moduleUrl(
  "export const apiFetch = (...args) => globalThis.__sitemapFetch(...args)"
)
const { default: sitemap } = await load("../src/app/sitemap.ts", {
  "@/api/client": api,
  "@/config/site": site,
})
const { default: robots } = await load("../src/app/robots.ts", {
  "@/config/site": site,
})
const staticUrls = [
  "https://dealhay.example.test/",
  "https://dealhay.example.test/privacy",
  "https://dealhay.example.test/terms",
]
const home = (products = [], featuredShops = [], lastPage = 1) => ({
  featuredShops,
  products: { data: products, current_page: 1, last_page: lastPage },
})

test("canonical origins prefer explicit configuration, production deployment, then the known site", () => {
  assert.equal(
    resolveSiteUrl({
      NEXT_PUBLIC_SITE_URL: " https://deals.example/ ",
      VERCEL_PROJECT_PRODUCTION_URL: "deployment.vercel.app",
    }).href,
    "https://deals.example/"
  )
  assert.equal(
    resolveSiteUrl({
      VERCEL_PROJECT_PRODUCTION_URL: "deployment.vercel.app",
    }).href,
    "https://deployment.vercel.app/"
  )
  assert.equal(resolveSiteUrl({}).href, "https://dealhay.vercel.app/")
})

test("credentials, non-HTTP schemes, paths, query and fragments cannot become canonical origins", () => {
  for (const value of [
    "javascript:alert(1)",
    "https://user:secret@deals.example",
    "https://deals.example/private",
    "https://deals.example/?token=secret",
    "https://deals.example/#private",
    "//deals.example",
    "not a domain",
  ]) {
    assert.equal(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: value,
        VERCEL_PROJECT_PRODUCTION_URL: "production.vercel.app",
      }).origin,
      "https://production.vercel.app",
      value
    )
    assert.equal(
      resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: value }).origin,
      "https://dealhay.vercel.app",
      value
    )
  }
})

test("robots advertises the canonical sitemap and lets crawlers observe HTML noindex", () => {
  const result = robots()
  assert.equal(result.sitemap, "https://dealhay.example.test/sitemap.xml")
  assert.equal(result.rules.allow, "/")
  assert.deepEqual(result.rules.disallow, ["/api/", "/private/"])
  for (const noindexRoute of [
    "/admin",
    "/chats",
    "/profile",
    "/shop-manage",
    "/sell",
    "/sign-in",
    "/reset-password",
    "/shops/*/products/*/checkout",
    "/shops/*/products/*/checkout",
  ])
    assert.ok(!result.rules.disallow.includes(noindexRoute), noindexRoute)
  for (const publicRoute of ["/privacy", "/terms", "/shops"])
    assert.ok(!result.rules.disallow.includes(publicRoute), publicRoute)
})

test("a catalog outage still serves real static URLs without fabricated products or dates", async () => {
  globalThis.__sitemapFetch = async (request) => {
    assert.equal(request.token, null)
    assert.equal(request.method, "GET")
    assert.equal(request.cache, "no-store")
    assert.ok(request.signal instanceof AbortSignal)
    throw new Error("API unavailable")
  }
  assert.deepEqual(
    await sitemap(),
    staticUrls.map((url) => ({ url }))
  )
})

test("public pagination and shop results add only valid same-origin product URLs, with deduplication", async () => {
  const requests = []
  globalThis.__sitemapFetch = async (request) => {
    requests.push(request)
    assert.equal(request.token, null)
    assert.equal(request.method, "GET")
    if (request.path === "/") {
      if (request.searchParams.page === 2)
        return home([{ slug: "sản-phẩm", shop: { code: "shop-b" } }])
      return home(
        [
          { slug: "sản-phẩm", shop: { code: "shop-b" } },
          { slug: "..", shop: { code: "shop-b" } },
          { slug: "private", shop: { code: "https://other.test" } },
        ],
        [{ code: "shop-a" }],
        2
      )
    }
    if (request.path === "/shops/shop-a")
      return {
        shop: { code: "shop-a" },
        products: [{ slug: "item-1" }, { slug: "../checkout" }],
      }
    throw new Error("One shop unavailable")
  }
  const result = await sitemap()
  const urls = result.map(({ url }) => url)
  assert.deepEqual(
    new Set(urls),
    new Set([
      ...staticUrls,
      "https://dealhay.example.test/shops/shop-a",
      "https://dealhay.example.test/shops/shop-b",
      "https://dealhay.example.test/shops/shop-a/products/item-1",
      "https://dealhay.example.test/shops/shop-b/products/s%E1%BA%A3n-ph%E1%BA%A9m",
    ])
  )
  assert.equal(urls.length, new Set(urls).size)
  assert.ok(result.every((entry) => Object.keys(entry).join() === "url"))
  assert.ok(requests.some((request) => request.searchParams.page === 2))
  assert.ok(requests.every((request) => request.signal === requests[0].signal))
})

test("large upstream pagination cannot create unbounded API fan-out", async () => {
  const requests = []
  globalThis.__sitemapFetch = async (request) => {
    requests.push(request)
    if (request.path === "/") {
      const page = request.searchParams.page ?? 1
      return home(
        [{ slug: `item-${page}`, shop: { code: `shop-${page}` } }],
        [],
        999999
      )
    }
    return { shop: { code: request.path.split("/").at(-1) }, products: [] }
  }
  const result = await sitemap()
  assert.equal(requests.filter(({ path }) => path === "/").length, 50)
  assert.equal(
    requests.filter(({ path }) => path.startsWith("/shops/")).length,
    32
  )
  assert.ok(result.length >= staticUrls.length)
})
