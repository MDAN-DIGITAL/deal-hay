import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function loadSource(path, imports = {}) {
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
    outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
      assert.ok(imports[name], `Unexpected import: ${name}`)
      return `from ${quote}${imports[name]}${quote}`
    })
  )
}
const react = import.meta.resolve("react")
const jsx = import.meta.resolve("react/jsx-runtime")
const link = moduleUrl(`
  import { createElement } from ${JSON.stringify(react)}
  export default function Link({children,...props}){return createElement("a",props,children)}
`)
const paginationUi = loadSource("../src/components/ui/pagination.tsx", {
  react,
  "react/jsx-runtime": jsx,
  "next/link": link,
  cn: import.meta.resolve("cn"),
  "lucide-react": import.meta.resolve("lucide-react"),
  "@/components/ui/button": moduleUrl(
    'export const buttonVariants=()=>"button"'
  ),
})
const { DataPagination } = await import(
  loadSource("../src/components/layout/data-pagination.tsx", {
    "react/jsx-runtime": jsx,
    "@/components/ui/pagination": paginationUi,
    "next/navigation": moduleUrl(`
      export const usePathname=()=>globalThis.__paginationLocation.pathname
      export const useSearchParams=()=>new URLSearchParams(globalThis.__paginationLocation.search)
    `),
  })
)
const { getHome } = await import(
  loadSource("../src/api/catalog/queries.ts", {
    "@/api/catalog/routes": loadSource("../src/api/catalog/routes.ts"),
    "@/api/client": moduleUrl(`
      export function apiFetch(request){globalThis.__catalogRequest=request;return Promise.resolve({})}
    `),
  })
)
const { default: HomePage } = await import(
  loadSource("../src/app/(storefront)/page.tsx", {
    "react/jsx-runtime": jsx,
    "@/api/catalog/server": moduleUrl(`
      export const PUBLIC_CATALOG_ERROR="Không thể tải"
      export async function getPublicHome(category,page){
        globalThis.__catalogPageRequest={category,page}
        return {status:"ready",data:{products:{current_page:Number(page||1)}}}
      }
    `),
    "@/lib/seo": moduleUrl(`
      export const BRAND_OPEN_GRAPH_IMAGE="/brand.png",BRAND_TWITTER_IMAGE="/brand.png",SITE_DESCRIPTION="Catalog"
      export const siteStructuredData=()=>({})
      export const serializeJsonLd=JSON.stringify
    `),
    "@/modules/public/containers/home-page-container": moduleUrl(`
      import { createElement } from ${JSON.stringify(react)}
      export function HomePageContainer(props){globalThis.__catalogPageProps=props;return createElement("div",null,"catalog")}
    `),
  })
)

function renderPagination(props, search = "", pathname = "/") {
  globalThis.__paginationLocation = { pathname, search }
  return renderToStaticMarkup(createElement(DataPagination, props))
}
function hrefs(html) {
  return [...html.matchAll(/href="([^"]+)"/g)].map(
    ([, href]) => new URL(href.replaceAll("&amp;", "&"), "https://example.test")
  )
}

test("browser catalog pagination forwards the page and selected category to the API", async () => {
  await getHome("Công nghệ & Phụ kiện", "6")
  assert.deepEqual(globalThis.__catalogRequest, {
    path: "/",
    searchParams: { category: "Công nghệ & Phụ kiện", page: "6" },
  })
})

test("direct homepage navigation reads page 6 for both its server snapshot and client query", async () => {
  const page = await HomePage({
    searchParams: Promise.resolve({ category: "Thời trang", page: "6" }),
  })
  renderToStaticMarkup(page)
  assert.deepEqual(globalThis.__catalogPageRequest, {
    category: "Thời trang",
    page: "6",
  })
  assert.equal(globalThis.__catalogPageProps.page, "6")
  assert.equal(
    globalThis.__catalogPageProps.initialData.products.current_page,
    6
  )
})

test("invalid or ambiguous homepage page parameters recover the first page", async () => {
  for (const value of [
    "0",
    "-1",
    "1.5",
    "NaN",
    "9007199254740992",
    ["2", "3"],
  ]) {
    renderToStaticMarkup(
      await HomePage({ searchParams: Promise.resolve({ page: value }) })
    )
    assert.equal(globalThis.__catalogPageRequest.page, undefined)
    assert.equal(
      globalThis.__catalogPageProps.initialData.products.current_page,
      1
    )
  }
})

test("page links retain filters and scroll back to the product collection", () => {
  const html = renderPagination(
    { currentPage: 3, lastPage: 6, anchor: "san-pham" },
    "category=Th%E1%BB%9Di+trang&page=3&search=abc"
  )
  const links = hrefs(html)
  assert.ok(links.some((url) => url.searchParams.get("page") === "4"))
  assert.ok(links.some((url) => !url.searchParams.has("page")))
  for (const url of links) {
    assert.equal(url.pathname, "/")
    assert.equal(url.searchParams.get("category"), "Thời trang")
    assert.equal(url.searchParams.get("search"), "abc")
    assert.equal(url.hash, "#san-pham")
  }
  assert.match(html, /aria-label="Trang 3"/)
  assert.match(html, /aria-current="page"/)
})

test("previous and next controls are disabled at the edges and single pages have no navigation", () => {
  const first = renderPagination({ currentPage: 1, lastPage: 6 })
  assert.match(first, /aria-disabled="true" aria-label="Trang trước"/)
  const last = renderPagination({ currentPage: 6, lastPage: 6 })
  assert.match(last, /aria-disabled="true" aria-label="Trang sau"/)
  assert.equal(renderPagination({ currentPage: 1, lastPage: 1 }), "")
})

test("large collections expose bounded page links without dropping the first or last page", () => {
  const urls = hrefs(
    renderPagination(
      { currentPage: 50, lastPage: 100 },
      "page=50",
      "/admin/users"
    )
  )
  assert.equal(urls.length, 7)
  assert.deepEqual(
    [...new Set(urls.map((url) => Number(url.searchParams.get("page") || 1)))],
    [49, 1, 50, 51, 100]
  )
  for (const url of urls) assert.equal(url.pathname, "/admin/users")
})
