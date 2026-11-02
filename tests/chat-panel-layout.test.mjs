import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function transpile(file, imports = {}) {
  return moduleUrl(
    ts
      .transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
        },
      })
      .outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
        assert.ok(imports[name], `Unexpected import: ${name}`)
        return `from ${quote}${imports[name]}${quote}`
      })
  )
}
const react = moduleUrl(`
  export const useState=(value)=>globalThis.__chatPanel.state(value)
  export const useMemo=(create,deps)=>globalThis.__chatPanel.memo(create,deps)
  export const useCallback=(callback,deps)=>useMemo(()=>callback,deps)
  export const useRef=(current)=>useMemo(()=>({current}),[])
  export const useEffect=(effect,deps)=>globalThis.__chatPanel.effect(effect,deps)
  export const useTransition=()=>[false,(action)=>action()]
`)
const widgets = moduleUrl(`
  export const EmptyState='empty',Badge='badge',Button='button',Card='card',CardContent='card-content',UserAvatar='avatar'
  export const ChatAttachmentProvider='attachments',ChatComposer='composer',ChatConversationList='conversation-list',ChatMessageList='messages'
  export const ArrowLeftIcon='arrow',HouseIcon='house',LoaderCircleIcon='loading',WifiIcon='wifi',WifiOffIcon='offline'
  export const CheckCheckIcon='checks',MessageCircleIcon='message-icon',MoreHorizontalIcon='more',RefreshCwIcon='refresh',ShieldCheckIcon='shield'
  export const NotificationSoundToggle='sound-toggle',ThemeToggle='theme-toggle'
  export const DropdownMenu='dropdown',DropdownMenuContent='dropdown-content',DropdownMenuItem='dropdown-item',DropdownMenuTrigger='dropdown-trigger'
  export const buttonVariants=()=>''
  export const toast={error:()=>{},success:()=>{}}
  export const heartbeatPresenceAction=async(id)=>globalThis.__chatPanel.heartbeats.push(id)
  export const markConversationReadAction=async(slug)=>{globalThis.__chatPanel.reads.push(slug);return{success:true}}
  export const synchronizeChatsAction=async()=>null
  export const useRealtime=()=>({heartbeatIntervalSeconds:60,synchronizeUnreadCounts:async()=>{}})
  export const useChatRealtime=(options)=>{globalThis.__chatPanel.realtime=options;return{socketId:'socket',status:'connected',reconnect:()=>{}}}
`)
const imports = {
  react,
  "react/jsx-runtime": moduleUrl(
    "export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment='fragment'"
  ),
  "next/link": moduleUrl("export default 'link'"),
  "@/modules/chats/lib/chat-state": transpile(
    "../src/modules/chats/lib/chat-state.ts"
  ),
  "@/modules/chats/lib/chat-navigation": transpile(
    "../src/modules/chats/lib/chat-navigation.ts"
  ),
}
for (const name of [
  "lucide-react",
  "sonner",
  "@/components/layout/empty-state",
  "@/components/layout/notification-sound-toggle",
  "@/components/layout/theme-toggle",
  "@/components/realtime-provider",
  "@/components/ui/badge",
  "@/components/ui/button",
  "@/components/ui/card",
  "@/components/ui/dropdown-menu",
  "@/components/user-avatar",
  "@/modules/chats/actions",
  "@/modules/chats/components/chat-image-attachment",
  "@/modules/chats/components/chat-composer",
  "@/modules/chats/components/chat-conversation-list",
  "@/modules/chats/components/chat-message-list",
  "@/modules/chats/hooks/use-chat-realtime",
])
  imports[name] = widgets
const { ChatsPageClient } = await import(
  transpile("../src/modules/chats/components/chats-page-client.tsx", imports)
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
const conversation = (id) => ({
  id,
  slug: id,
  counterpart: {
    id: `peer-${id}`,
    name: id,
    avatar_url: null,
    is_online: false,
  },
  unread_count: 2,
  updated_at: "2026-11-01T00:00:00.000Z",
  messages: [],
  messages_pagination: { has_more: false, next_cursor: null },
})
function mount(t, props = {}) {
  const previousWindow = globalThis.window,
    previousDocument = globalThis.document,
    previousHarness = globalThis.__chatPanel
  const slots = [],
    timers = new Map(),
    intervals = new Map()
  let cursor = 0,
    nextTimer = 0,
    effects = []
  const classes = () => {
    const values = new Set()
    return {
      contains: (value) => values.has(value),
      add: (value) => values.add(value),
      remove: (value) => values.delete(value),
    }
  }
  const rootClasses = classes(),
    bodyClasses = classes()
  const viewport = Object.assign(new EventTarget(), {
    height: 640,
    offsetTop: 0,
  })
  const desktop = Object.assign(new EventTarget(), { matches: false })
  const frame = {
    style: {
      removeProperty(name) {
        delete this[name]
      },
    },
  }
  const window = Object.assign(new EventTarget(), {
    location: {
      origin: "https://dealhay.test",
      pathname: props.embedded ? "/products/item" : "/chats/thread",
      search: "",
      hash: "",
    },
    history: { pushState: (...args) => page.navigations.push(args) },
    visualViewport: viewport,
    matchMedia: () => desktop,
    setTimeout: (callback) => {
      const id = ++nextTimer
      timers.set(id, callback)
      return id
    },
    clearTimeout: (id) => timers.delete(id),
    setInterval: (callback) => {
      const id = ++nextTimer
      intervals.set(id, callback)
      return id
    },
    clearInterval: (id) => intervals.delete(id),
    requestAnimationFrame: (callback) => {
      const id = ++nextTimer
      timers.set(id, callback)
      return id
    },
    cancelAnimationFrame: (id) => timers.delete(id),
  })
  const document = Object.assign(new EventTarget(), {
    visibilityState: "visible",
    hasFocus: () => true,
    documentElement: { classList: rootClasses },
    body: { classList: bodyClasses },
  })
  const selected = conversation("thread"),
    other = conversation("other")
  const page = {
    props: {
      conversations: [selected, other],
      selectedConversation: selected,
      conversationSnapshots: [selected, other],
      currentUserId: "viewer",
      ...props,
    },
    reads: [],
    heartbeats: [],
    navigations: [],
    window,
    document,
    viewport,
    desktop,
    frame,
    rootClasses,
    bodyClasses,
    state(initial) {
      const index = cursor++
      if (!(index in slots))
        slots[index] = typeof initial === "function" ? initial() : initial
      return [
        slots[index],
        (next) => {
          slots[index] = typeof next === "function" ? next(slots[index]) : next
        },
      ]
    },
    memo(create, deps) {
      const index = cursor++,
        previous = slots[index]
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i])))
        slots[index] = { deps, value: create() }
      return slots[index].value
    },
    effect(effect, deps) {
      const index = cursor++,
        previous = slots[index]
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i])))
        effects.push(() => {
          previous?.cleanup?.()
          slots[index] = { deps, cleanup: effect() }
        })
    },
    render(next = {}) {
      page.props = { ...page.props, ...next }
      cursor = 0
      effects = []
      page.tree = ChatsPageClient(page.props)
      for (const node of nodes(page.tree))
        if (node.props?.ref) node.props.ref.current = frame
      for (const effect of effects) effect()
      return page.tree
    },
    flushTimers() {
      const pending = [...timers.values()]
      timers.clear()
      for (const callback of pending) callback()
    },
    unmount() {
      for (const slot of slots) slot?.cleanup?.()
    },
  }
  globalThis.window = window
  globalThis.document = document
  globalThis.__chatPanel = page
  t.after(() => {
    page.unmount()
    globalThis.window = previousWindow
    globalThis.document = previousDocument
    globalThis.__chatPanel = previousHarness
  })
  page.render()
  return page
}
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}

test("embedded chat selects cached conversations without changing the host URL or locking page scrolling", (t) => {
  const page = mount(t, { embedded: true })
  const frame = nodes(page.tree).find(
    (node) => node.props?.["data-chat-layout"]
  )
  assert.equal(frame.props["data-chat-layout"], "embedded")
  assert.ok(frame.props.className.includes("h-full"))
  assert.ok(!frame.props.className.includes("fixed"))
  assert.ok(
    !nodes(page.tree).some((node) =>
      node.props?.className?.includes("grid-cols")
    )
  )
  assert.equal(page.rootClasses.contains("overflow-hidden"), false)
  assert.equal(page.bodyClasses.contains("overflow-hidden"), false)
  const list = nodes(page.tree).find(
    (node) => node.type === "conversation-list"
  )
  list.props.onSelect("other")
  page.render()
  assert.equal(
    nodes(page.tree).find((node) => node.type === "messages").props
      .conversationSlug,
    "other"
  )
  assert.equal(
    nodes(page.tree)
      .find((node) => node.type === "aside")
      .props.className.startsWith("hidden"),
    true
  )
  assert.deepEqual(page.navigations, [])
  assert.equal(page.window.location.pathname, "/products/item")
})

test("a minimized chat never marks messages read or advertises conversation presence until it is active", async (t) => {
  const page = mount(t, { embedded: true, active: false })
  page.flushTimers()
  page.window.dispatchEvent(new Event("focus"))
  page.document.dispatchEvent(new Event("visibilitychange"))
  page.realtime.onMessage({
    id: "incoming",
    conversation_id: "thread",
    body: "Hello",
    sender: { id: "peer-thread", name: "Peer", avatar_url: null },
    read_at: null,
    attachment: null,
    product: null,
    created_at: "2026-11-01T01:00:00.000Z",
  })
  await settle()
  assert.deepEqual(page.reads, [])
  assert.ok(page.heartbeats.every((id) => id === undefined))
  assert.equal(page.realtime.selectedConversationId, undefined)
  assert.equal(page.realtime.counterpartId, undefined)
  page.render({ active: true })
  page.flushTimers()
  await settle()
  assert.deepEqual(page.reads, ["thread"])
  assert.equal(page.heartbeats.at(-1), "thread")
  assert.equal(page.realtime.selectedConversationId, "thread")
  assert.equal(page.realtime.counterpartId, "peer-thread")
})

test("full-page chat fits the visible mobile keyboard area and removes viewport listeners and scroll locks on unmount", (t) => {
  const page = mount(t)
  assert.equal(page.frame.style.height, "640px")
  assert.equal(page.frame.style.top, "0px")
  assert.equal(page.bodyClasses.contains("overflow-hidden"), true)
  page.viewport.height = 320
  page.viewport.offsetTop = 48
  page.viewport.dispatchEvent(new Event("resize"))
  assert.equal(page.frame.style.height, "320px")
  assert.equal(page.frame.style.top, "48px")
  page.desktop.matches = true
  page.desktop.dispatchEvent(new Event("change"))
  assert.equal(page.frame.style.top, "48px")
  assert.equal(page.frame.style.height, "320px")
  page.unmount()
  assert.equal(page.rootClasses.contains("overflow-hidden"), false)
  assert.equal(page.bodyClasses.contains("overflow-hidden"), false)
  assert.equal(page.frame.style.height, undefined)
  page.viewport.dispatchEvent(new Event("resize"))
  assert.equal(page.frame.style.height, undefined)
})
