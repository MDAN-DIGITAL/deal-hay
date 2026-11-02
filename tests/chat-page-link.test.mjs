import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const imports = {
  "react/jsx-runtime": moduleUrl(
    "export const jsx=(type,props)=>({type,props})"
  ),
  "next/link": moduleUrl("export default 'link'"),
  "@/modules/chats/lib/chat-navigation": moduleUrl(
    "export const openChatPage=(href)=>globalThis.__chatLink.open(href)"
  ),
}
const source = ts
  .transpileModule(
    readFileSync(
      new URL("../src/components/chat-page-link.tsx", import.meta.url),
      "utf8"
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }
  )
  .outputText.replace(/from (["'])([^"']+)\1/g, (_match, quote, name) => {
    assert.ok(imports[name], `Unexpected import ${name}`)
    return `from ${quote}${imports[name]}${quote}`
  })
const { ChatPageLink } = await import(moduleUrl(source))
const href = "https://dealhay.example/chats/thread?message=exact"
const click = (options = {}) => ({
  button: 0,
  defaultPrevented: false,
  currentTarget: { href },
  preventDefault() {
    this.defaultPrevented = true
  },
  ...options,
})

test("chat entry keeps a real safe new-tab link and preserves the deep link", () => {
  const link = ChatPageLink({ href, children: "Tin nhắn" })
  assert.equal(link.type, "link")
  assert.equal(link.props.href, href)
  assert.equal(link.props.target, "_blank")
  assert.equal(link.props.rel, "noopener noreferrer")
})

test("left, ctrl, meta and middle clicks use the authenticated new tab once", () => {
  const opened = []
  globalThis.__chatLink = {
    open: (href) => {
      opened.push(href)
      return true
    },
  }
  const link = ChatPageLink({ href })
  for (const options of [{}, { ctrlKey: true }, { metaKey: true }]) {
    const event = click(options)
    link.props.onClick(event)
    assert.equal(event.defaultPrevented, true)
  }
  const middle = click({ button: 1 })
  link.props.onAuxClick(middle)
  assert.equal(middle.defaultPrevented, true)
  assert.deepEqual(opened, [href, href, href, href])
})

test("a blocked popup leaves the native anchor available instead of replacing the current page", () => {
  globalThis.__chatLink = { open: () => false }
  const link = ChatPageLink({ href })
  const event = click()
  link.props.onClick(event)
  assert.equal(event.defaultPrevented, false)
  assert.equal(link.props.href, href)
  assert.equal(link.props.target, "_blank")
})

test("cancelled clicks and native window/download modifiers are not intercepted", () => {
  const opened = []
  globalThis.__chatLink = {
    open: (href) => {
      opened.push(href)
      return true
    },
  }
  const cancelled = ChatPageLink({
    href,
    onClick: (event) => event.preventDefault(),
  })
  cancelled.props.onClick(click())
  const link = ChatPageLink({ href })
  for (const options of [{ shiftKey: true }, { altKey: true }, { button: 2 }])
    link.props.onClick(click(options))
  assert.deepEqual(opened, [])
})
