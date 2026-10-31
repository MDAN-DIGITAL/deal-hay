import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
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
  return moduleUrl(
    outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, specifier) => {
      assert.ok(imports[specifier], `Unexpected import: ${specifier}`)
      return `from ${quote}${imports[specifier]}${quote}`
    })
  )
}
const redirectsUrl = transpile("../src/lib/auth-redirect.ts")
const { getSafeAuthRedirect, getAuthPageHref } = await import(redirectsUrl)
test("wallet and saved-product links survive authentication", () => {
  for (const path of [
    "/discount-codes",
    "/discount-codes?status=available",
    "/diagnostics",
    "/shops/SHOP-1/products/ao-thun?discount_code=DH-EXAMPLE",
    "/shops/SHOP-1/products/ao-thun/checkout?variant_id=red-small&discount_code=DH-A%26B",
  ]) {
    assert.equal(getSafeAuthRedirect(path), path)
    assert.equal(
      new URL(
        getAuthPageHref("/sign-in", path),
        "https://deal-hay.local"
      ).searchParams.get("redirect"),
      path
    )
  }
})

test("login redirects reject external and encoded unsafe wallet destinations", () => {
  for (const path of [
    "https://outside.example/discount-codes",
    "//outside.example/discount-codes",
    "/%2foutside.example/discount-codes",
    "/discount-codes%5coutside.example",
    "/discount-codes%0aLocation:outside",
    "/discount-codes-invalid",
  ]) {
    assert.equal(getSafeAuthRedirect(path), "/", path)
  }
})

test("missing or malformed return paths use the homepage", () => {
  for (const value of [
    undefined,
    null,
    ["/profile"],
    "",
    "javascript:alert(1)",
    "/%invalid",
    "/sign-in",
  ]) {
    assert.equal(getSafeAuthRedirect(value), "/")
    assert.equal(getAuthPageHref("/sign-in", value), "/sign-in")
  }
})
