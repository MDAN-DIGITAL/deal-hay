import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const jsx = moduleUrl(
  "export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment='fragment'"
)
const react = moduleUrl(`
  export const useState=(initial)=>initial==='all'?[globalThis.__conversationList.filter??'all',(value)=>{globalThis.__conversationList.filter=value}]:[globalThis.__conversationList.query,(value)=>{globalThis.__conversationList.query=value}]
  export const useMemo=(create)=>create()
`)
const widgets = moduleUrl(`
  export const MessageCircleIcon='message-icon',SearchIcon='search-icon',ShieldCheckIcon='support-icon'
  export const EmptyState='empty-state',Badge='badge',UserAvatar='avatar',ScrollArea='scroll-area'
  export const InputGroup='input-group',InputGroupAddon='input-addon',InputGroupInput='search'
  export const Item='item',ItemContent='item-content',ItemDescription='item-description',ItemMedia='item-media',ItemTitle='item-title'
`)
const source = ts.transpileModule(
  readFileSync(
    new URL(
      "../src/modules/chats/components/chat-conversation-list.tsx",
      import.meta.url
    ),
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
const { ChatConversationList } = await import(
  moduleUrl(
    source.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
      const dependency =
        name === "react"
          ? react
          : name === "react/jsx-runtime"
            ? jsx
            : name === "next/link"
              ? moduleUrl("export default 'link'")
              : widgets
      return `from ${quote}${dependency}${quote}`
    })
  )
)
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
function text(node) {
  if (typeof node === "string" || typeof node === "number") return String(node)
  return []
    .concat(node?.props?.children ?? [])
    .flat(Infinity)
    .map(text)
    .join("")
}
const conversation = (id, overrides = {}) => ({
  id,
  slug: `real-${id}`,
  counterpart: {
    id: `user-${id}`,
    name: id,
    avatar_url: null,
    is_online: false,
  },
  last_message: null,
  unread_count: 0,
  ...overrides,
})

test("Deal Hay Admin remains first while searching and its row selects the real support conversation", () => {
  globalThis.__conversationList = { query: "" }
  const selected = []
  const props = {
    conversations: [
      conversation("Shop"),
      conversation("Admin", { is_support: true }),
    ],
    onSelect: (slug) => selected.push(slug),
  }
  let tree = ChatConversationList(props)
  let rows = nodes(tree).filter((node) => node.type === "link")
  assert.ok(text(rows[0]).includes("Deal Hay Admin"))
  nodes(tree)
    .find((node) => node.type === "search")
    .props.onChange({ target: { value: "Shop" } })
  tree = ChatConversationList(props)
  rows = nodes(tree).filter((node) => node.type === "link")
  assert.equal(rows.length, 2)
  assert.ok(text(rows[0]).includes("Deal Hay Admin"))
  assert.ok(text(rows[1]).includes("Shop"))
  let prevented = false
  rows[0].props.onClick({
    button: 0,
    preventDefault: () => {
      prevented = true
    },
  })
  assert.equal(prevented, true)
  assert.deepEqual(selected, ["real-Admin"])
})

test("missing support staff leaves a disabled first support row without a fabricated conversation URL", () => {
  globalThis.__conversationList = { query: "" }
  const tree = ChatConversationList({
    conversations: [conversation("Shop")],
    onSelect: () => {
      throw new Error("Unavailable support must not navigate")
    },
  })
  const rows = nodes(tree).filter(
    (node) => node.props?.["aria-disabled"] === "true" || node.type === "link"
  )
  assert.ok(text(rows[0]).includes("Deal Hay Admin"))
  assert.ok(text(rows[0]).includes("Bộ phận hỗ trợ chưa sẵn sàng"))
  assert.equal(rows[0].props["aria-disabled"], "true")
  assert.equal(rows[0].props.render, undefined)
  assert.ok(text(rows[1]).includes("Shop"))
})

test("unread filtering keeps official support pinned and preserves selection semantics", () => {
  globalThis.__conversationList = { query: "" }
  const props = {
    conversations: [
      conversation("Support", { is_support: true }),
      conversation("Unread", { unread_count: 3 }),
      conversation("Read"),
    ],
    selectedConversationId: "Unread",
    onSelect: () => {},
  }
  let tree = ChatConversationList(props)
  nodes(tree)
    .find((node) => node.type === "button" && text(node).startsWith("Chưa đọc"))
    .props.onClick()
  tree = ChatConversationList(props)
  const rows = nodes(tree).filter((node) => node.type === "link")
  assert.equal(rows.length, 2)
  assert.ok(text(rows[0]).includes("Deal Hay Admin"))
  assert.ok(text(rows[1]).includes("Unread"))
  assert.equal(rows[1].props["aria-current"], "page")
  let prevented = false
  rows[1].props.onClick({
    button: 0,
    ctrlKey: true,
    preventDefault: () => {
      prevented = true
    },
  })
  assert.equal(prevented, false)
})
