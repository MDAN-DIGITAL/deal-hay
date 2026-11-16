import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const { outputText } = ts.transpileModule(
  readFileSync(
    new URL("../src/modules/admin/lib/admin-navigation.ts", import.meta.url),
    "utf8"
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
)
const { adminFilterHref, adminSourceHref } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
)

test("admin filters search the first page while retaining other filters and clearing stale selections", () => {
  const href = adminFilterHref(
    "/admin/users",
    "page=8&role=customer&status=locked&shop=old&ticket=old",
    { search: "  Nguyễn An  " }
  )
  const query = new URL(href, "https://example.test").searchParams
  assert.equal(query.get("search"), "Nguyễn An")
  assert.equal(query.get("role"), "customer")
  assert.equal(query.get("status"), "locked")
  for (const key of ["page", "shop", "ticket"])
    assert.equal(query.has(key), false)
  assert.equal(
    adminFilterHref("/admin/shops", "search=abc&page=3&status=locked", {
      search: "",
      status: "all",
    }),
    "/admin/shops"
  )
})

test("ticket source links accept application paths and web URLs while rejecting executable or credential-bearing URLs", () => {
  assert.equal(
    adminSourceHref("/notifications?tab=all#notification"),
    "/notifications?tab=all#notification"
  )
  assert.equal(
    adminSourceHref("https://dealhay.store/shops/shop-1"),
    "https://dealhay.store/shops/shop-1"
  )
  for (const value of [
    null,
    "",
    "javascript:alert(1)",
    "data:text/html,test",
    "https://user:secret@example.com/",
  ])
    assert.equal(adminSourceHref(value), null)
})
