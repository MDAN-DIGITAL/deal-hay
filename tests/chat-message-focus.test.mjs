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
  export const Fragment='fragment'
  export const useRef=(value)=>globalThis.__messageFocus.ref(value)
  export const useState=(value)=>globalThis.__messageFocus.state(value)
  export const useEffect=(effect,deps)=>globalThis.__messageFocus.effect(effect,deps,false)
  export const useLayoutEffect=(effect,deps)=>globalThis.__messageFocus.effect(effect,deps,true)
  export const useTransition=()=>[false,(action)=>action()]
`)
function transpile(file, imports = {}) {
  return moduleUrl(
    ts
      .transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      })
      .outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
        assert.ok(imports[name], `Unexpected import ${name}`)
        return `from ${quote}${imports[name]}${quote}`
      })
  )
}
const widgets = moduleUrl(`
  export const EmptyState='empty',MediaImage='image',Button='button',ScrollArea='scroll-area',UserAvatar='avatar'
  export const Item='item',ItemContent='item-content',ItemDescription='item-description',ItemMedia='item-media',ItemTitle='item-title'
  export const Message='message-node',MessageAvatar='message-avatar',MessageContent='message-content',MessageGroup='message-group'
  export const ChatImageAttachment='attachment',DownloadAttachment='download',ChatReplyPreview='reply'
  export const CheckCheckIcon='read',CheckIcon='sent',LoaderCircleIcon='loading',ReplyIcon='reply-icon'
  export const toast={info:()=>{},error:()=>{}}
  export const cn=(...values)=>values.filter(Boolean).join(' ')
  export const formatCurrency=String,formatDate=String,formatShortDate=String
  export const loadChatHistoryAction=()=>{throw new Error('Preloaded target must not fetch history')}
`)
const imports = {
  react,
  "react/jsx-runtime": jsx,
  "next/link": moduleUrl("export default 'link'"),
  "@/modules/chats/lib/chat-scroll": transpile(
    "../src/modules/chats/lib/chat-scroll.ts"
  ),
}
for (const name of [
  "lucide-react",
  "sonner",
  "@/components/layout/empty-state",
  "@/components/media-image",
  "@/components/ui/button",
  "@/components/ui/item",
  "@/components/ui/message",
  "@/components/ui/scroll-area",
  "@/components/user-avatar",
  "@/lib/format",
  "@/lib/utils",
  "@/modules/chats/actions",
  "@/modules/chats/components/chat-image-attachment",
  "@/modules/chats/components/chat-reply-preview",
])
  imports[name] = widgets
const { ChatMessageList } = await import(
  transpile("../src/modules/chats/components/chat-message-list.tsx", imports)
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
const messages = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: `m${index}`,
    conversation_id: "thread",
    body: `Message ${index}`,
    created_at: null,
    sender: { id: "other", name: "Other", avatar_url: null },
    read_at: null,
    attachment: null,
    product: null,
  }))
function mount(t, props = {}) {
  const slots = [],
    refs = [],
    elements = new Map(),
    frames = new Map()
  let cursor = 0,
    dirty = false,
    nextFrame = 0,
    layout = [],
    passive = []
  const viewport = Object.assign(new EventTarget(), {
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 400,
    firstElementChild: {},
  })
  const screen = {
    props: {
      conversationSlug: "thread",
      currentUserId: "viewer",
      messages: messages(500),
      pagination: { has_more: false, next_cursor: null },
      onOlderMessages: () => {},
      onReply: () => {},
      getScrollPosition: () => undefined,
      onScrollPositionChange: () => {},
      ...props,
    },
    viewport,
    scrolls: [],
    focused: [],
    tree: null,
    ref(value) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: value }
      return slots[index]
    },
    state(value) {
      const index = cursor++
      if (!(index in slots))
        slots[index] = typeof value === "function" ? value() : value
      return [
        slots[index],
        (next) => {
          const value = typeof next === "function" ? next(slots[index]) : next
          if (!Object.is(value, slots[index])) {
            slots[index] = value
            dirty = true
          }
        },
      ]
    },
    effect(effect, deps, beforePaint) {
      const index = cursor++,
        previous = slots[index]
      if (
        !previous ||
        deps.some((value, i) => !Object.is(value, previous.deps[i]))
      ) {
        ;(beforePaint ? layout : passive).push(() => {
          previous?.cleanup?.()
          slots[index] = { deps, cleanup: effect() }
        })
      }
    },
    render(next = {}) {
      Object.assign(this.props, next)
      let renders = 0
      do {
        assert.ok(++renders < 20, "layout state must settle")
        dirty = false
        cursor = 0
        layout = []
        passive = []
        this.tree = ChatMessageList(this.props)
        for (const ref of refs.splice(0))
          if (typeof ref === "function") ref(null)
        for (const element of elements.values()) element.isConnected = false
        const mounted = nodes(this.tree)
        const visible = mounted.filter(({ type }) => type === "message-node")
        viewport.scrollHeight = visible.length * 20
        for (const node of mounted) {
          const ref = node.props?.ref
          if (!ref) continue
          let element = { querySelector: () => viewport }
          if (node.type === "message-node") {
            const id = node.props["data-message-id"]
            if (!elements.has(id))
              elements.set(id, {
                isConnected: true,
                scrollIntoView: (options) => {
                  this.scrolls.push({ id, options })
                  viewport.scrollTop = Math.max(
                    0,
                    visible.findIndex(
                      (item) => item.props["data-message-id"] === id
                    ) *
                      20 -
                      100
                  )
                },
                focus: (options) => this.focused.push({ id, options }),
              })
            element = elements.get(id)
            element.isConnected = true
          }
          if (typeof ref === "function") {
            refs.push(ref)
            ref(element)
          } else ref.current = element
        }
        for (const effect of layout) effect()
        for (const effect of passive) effect()
      } while (dirty)
      return this.tree
    },
    flushFrames() {
      const pending = [...frames.values()]
      frames.clear()
      for (const callback of pending) callback()
      if (dirty) this.render()
    },
    dispose() {
      for (const slot of slots) slot?.cleanup?.()
      for (const element of elements.values()) element.isConnected = false
    },
  }
  const previousWindow = globalThis.window
  globalThis.window = {
    requestAnimationFrame: (callback) => {
      const id = ++nextFrame
      frames.set(id, callback)
      return id
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    matchMedia: () => ({ matches: false }),
  }
  globalThis.__messageFocus = screen
  t.after(() => {
    screen.dispose()
    globalThis.window = previousWindow
  })
  screen.render()
  return screen
}

test("a toast reveals an old preloaded message, physically scrolls and focuses it, then highlights it", (t) => {
  const screen = mount(t, { focusMessage: { id: "m30", requestId: 1 } })
  assert.ok(
    nodes(screen.tree).some((node) => node.props?.["data-message-id"] === "m30")
  )
  screen.flushFrames()
  assert.deepEqual(screen.scrolls, [
    { id: "m30", options: { behavior: "instant", block: "center" } },
  ])
  assert.deepEqual(screen.focused, [
    { id: "m30", options: { preventScroll: true } },
  ])
  const target = nodes(screen.tree).find(
    (node) => node.props?.["data-message-id"] === "m30"
  )
  assert.match(target.props.className, /ring-2/)
  assert.ok(
    screen.viewport.scrollTop <
      screen.viewport.scrollHeight - screen.viewport.clientHeight
  )
})

test("the same toast can refocus on another click while ordinary renders do not steal scroll", (t) => {
  const screen = mount(t, { focusMessage: { id: "m400", requestId: 1 } })
  screen.flushFrames()
  screen.viewport.scrollTop = 123
  screen.render({
    focusMessage: { id: "m400", requestId: 1 },
    messages: [...screen.props.messages],
  })
  screen.flushFrames()
  assert.equal(screen.scrolls.length, 1)
  assert.equal(screen.viewport.scrollTop, 123)
  screen.render({ focusMessage: { id: "m400", requestId: 2 } })
  screen.flushFrames()
  assert.equal(screen.scrolls.length, 2)
})

test("a target missing before synchronization is focused when its message arrives", (t) => {
  const screen = mount(t, { focusMessage: { id: "m500", requestId: 1 } })
  screen.flushFrames()
  assert.deepEqual(screen.focused, [])
  screen.render({ messages: messages(501) })
  screen.flushFrames()
  assert.equal(screen.focused.at(-1).id, "m500")
})

test("changing the target or leaving the thread cancels stale animation frames", (t) => {
  const screen = mount(t, { focusMessage: { id: "m400", requestId: 1 } })
  screen.render({ focusMessage: { id: "m410", requestId: 2 } })
  screen.flushFrames()
  assert.deepEqual(
    screen.focused.map(({ id }) => id),
    ["m410"]
  )
  screen.render({ focusMessage: { id: "m420", requestId: 3 } })
  screen.dispose()
  screen.flushFrames()
  assert.deepEqual(
    screen.focused.map(({ id }) => id),
    ["m410"]
  )
})

test("normal visits restore saved viewport and do not jump when another incoming message arrives", (t) => {
  const screen = mount(t, {
    getScrollPosition: () => ({
      firstRenderedMessageId: "m300",
      scrollTop: 250,
      atBottom: false,
    }),
  })
  assert.equal(screen.viewport.scrollTop, 250)
  screen.render({ messages: messages(501) })
  screen.flushFrames()
  assert.equal(screen.viewport.scrollTop, 250)
  assert.deepEqual(screen.focused, [])
})
