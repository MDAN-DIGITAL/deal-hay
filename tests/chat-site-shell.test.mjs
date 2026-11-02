import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"
const url = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const widgets = url(
  "export const usePathname=()=>globalThis.__shellPath;export const SiteHeader='site-header',SiteFooter='site-footer'"
)
const source = ts.transpileModule(
  readFileSync(
    new URL("../src/components/layout/site-shell.tsx", import.meta.url),
    "utf8"
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }
).outputText
const { SiteShell } = await import(
  url(
    source.replace(
      /from (["'])([^"']+)\1/g,
      (_match, quote, name) =>
        `from ${quote}${name === "react/jsx-runtime" ? url("export const jsx=(type,props)=>({type,props});export const jsxs=jsx") : widgets}${quote}`
    )
  )
)
test("chat routes dedicate the screen to messages while other pages keep navigation and advertising", () => {
  for (const path of ["/chats", "/chats/saved-admin-room"]) {
    globalThis.__shellPath = path
    const shell = SiteShell({ children: "messages", advertising: "ad" })
    const children = shell.props.children
    assert.equal(children[0], null)
    assert.equal(children[2], null)
    assert.deepEqual(children[1].props.children, ["messages", null])
  }
  globalThis.__shellPath = "/products/phone"
  const children = SiteShell({ children: "product", advertising: "ad" }).props
    .children
  assert.equal(children[0].type, "site-header")
  assert.equal(children[2].type, "site-footer")
  assert.deepEqual(children[1].props.children, ["product", "ad"])
})
