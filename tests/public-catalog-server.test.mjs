import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function transpile(path, imports = {}) {
  return moduleUrl(
    ts
      .transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      })
      .outputText.replace(/^import ["']server-only["'];?\s*/m, "")
      .replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
        assert.ok(imports[name], `Unexpected import: ${name}`)
        return `from ${quote}${imports[name]}${quote}`
      })
  )
}
const api = transpile("../src/api/client.ts", {
  "@/config/env": moduleUrl(
    'export const env={API_URL:"https://public-api.example.test/api"}'
  ),
  "@/lib/session": moduleUrl(`
    export function getAccessToken(){throw new Error("Public SSR must not read an account token")}
    export function clearAccessToken(){throw new Error("Public SSR must not modify an account")}
  `),
})
const {
  getPublicHome,
  getPublicShop,
  getPublicProduct,
  PUBLIC_CATALOG_TIMEOUT_MS,
  PUBLIC_CATALOG_REVALIDATE_SECONDS,
} = await import(
  transpile("../src/api/catalog/server.ts", {
    react: import.meta.resolve("react"),
    "@/api/client": api,
    "@/api/catalog/routes": transpile("../src/api/catalog/routes.ts"),
  })
)
const home = {
  featuredShops: [],
  products: { data: [], total: 0 },
  categories: [],
  filters: { category: "" },
}
const shop = {
  shop: {
    code: "shop",
    name: "Cửa hàng công khai",
    address: "Hà Nội",
    viewer: {},
  },
  products: [],
  categories: [],
}
const product = {
  shop: shop.shop,
  product: {
    name: "Sản phẩm công khai",
    description: "Thông tin sản phẩm công khai.",
    images: [],
    options: [],
    variants: [],
  },
  relatedProducts: [],
  reviews: [],
  reviewSummary: {},
}
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

test("server catalog requests are anonymous, bounded and encode route segments and filters", async (t) => {
  const calls = []
  const replies = [home, shop, product]
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options })
    return json(replies[calls.length - 1])
  })
  assert.deepEqual(await getPublicHome("Công nghệ & Đời sống"), {
    status: "ready",
    data: home,
  })
  assert.deepEqual(await getPublicShop("AN STORE", "Đồ dùng", "2"), {
    status: "ready",
    data: shop,
  })
  assert.deepEqual(await getPublicProduct("AN STORE", "loa/đỏ?#"), {
    status: "ready",
    data: product,
  })
  for (const { options } of calls) {
    assert.equal(options.headers.has("Authorization"), false)
    assert.equal(options.credentials, "omit")
    assert.equal(options.redirect, "error")
    assert.equal(options.cache, "force-cache")
    assert.equal(options.next.revalidate, PUBLIC_CATALOG_REVALIDATE_SECONDS)
    assert.ok(options.signal instanceof AbortSignal)
    assert.equal(options.signal.aborted, false)
  }
  assert.equal(
    new URL(calls[0].url).searchParams.get("category"),
    "Công nghệ & Đời sống"
  )
  assert.equal(new URL(calls[1].url).pathname, "/api/shops/AN%20STORE")
  assert.equal(new URL(calls[1].url).searchParams.get("page"), "2")
  assert.equal(
    new URL(calls[2].url).pathname,
    "/api/shops/AN%20STORE/products/loa%2F%C4%91%E1%BB%8F%3F%23"
  )
})

test("hidden or missing public resources retain a distinct not-found result", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    json({ message: "Missing" }, 404)
  )
  assert.deepEqual(await getPublicShop("missing"), { status: "not-found" })
  assert.deepEqual(await getPublicProduct("shop", "hidden"), {
    status: "not-found",
  })
})

test("backend and network failures return a safe fallback without server diagnostics", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    json({ message: "Internal database secret" }, 500)
  )
  assert.deepEqual(await getPublicHome(), { status: "unavailable" })
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Sensitive transport diagnostics")
  })
  assert.deepEqual(await getPublicProduct("shop", "product"), {
    status: "unavailable",
  })
})

test("an expired timeout is passed through to fetch and cannot strand the render", async (t) => {
  let timeout
  t.mock.method(AbortSignal, "timeout", (duration) => {
    timeout = duration
    return AbortSignal.abort(new DOMException("Timeout", "TimeoutError"))
  })
  t.mock.method(globalThis, "fetch", async (_url, { signal }) => {
    signal.throwIfAborted()
    assert.fail("An expired request must not continue")
  })
  assert.deepEqual(await getPublicHome(), { status: "unavailable" })
  assert.equal(timeout, PUBLIC_CATALOG_TIMEOUT_MS)
  assert.equal(timeout, 5000)
})

test("unexpected HTML or malformed JSON cannot become a server catalog snapshot", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response("<html>Maintenance</html>", {
        headers: { "Content-Type": "text/html" },
      })
  )
  assert.deepEqual(await getPublicHome(), { status: "unavailable" })
  t.mock.method(globalThis, "fetch", async () => json({ data: null }))
  assert.deepEqual(await getPublicShop("shop"), { status: "unavailable" })
  assert.deepEqual(await getPublicProduct("shop", "product"), {
    status: "unavailable",
  })
})
