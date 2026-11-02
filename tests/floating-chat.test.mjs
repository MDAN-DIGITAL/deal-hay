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
  export const useState=(initial)=>globalThis.__floatingChat.state(initial)
  export const useCallback=(callback)=>callback
  export const useRef=(initial)=>globalThis.__floatingChat.ref(initial)
  export const useEffect=(effect,deps)=>globalThis.__floatingChat.effect(effect,deps)
  export const useSyncExternalStore=(_subscribe,snapshot)=>snapshot()
`)
const widgets = moduleUrl(`
  export const useSession=()=>globalThis.__floatingChat.session
  export const usePathname=()=>globalThis.__floatingChat.pathname
  export const useRealtime=()=>({unreadCounts:{messages:globalThis.__floatingChat.unread}})
  export const Button='button',buttonVariants=()=>''
  export const Maximize2Icon='maximize',MessageCircleIcon='message',MinusIcon='minimize',ShieldCheckIcon='shield'
  export const Dialog='dialog-root',DialogTrigger='dialog-trigger',DialogPortal='dialog-portal',DialogPopup='dialog-popup',DialogTitle='dialog-title',DialogDescription='dialog-description',DialogClose='dialog-close'
`)
const imports = {
  react,
  "react/jsx-runtime": moduleUrl(
    "export const jsx=(type,props,key)=>({type,props,key});export const jsxs=jsx"
  ),
  "next/dynamic": moduleUrl("export default ()=> 'chats-panel'"),
  "next/link": moduleUrl("export default 'link'"),
  "@/lib/auth-redirect": transpile("../src/lib/auth-redirect.ts"),
}
for (const name of [
  "next/navigation",
  "@/components/ui/dialog",
  "lucide-react",
  "@/components/realtime-provider",
  "@/components/session-provider",
  "@/components/ui/button",
])
  imports[name] = widgets
const { FloatingChat } = await import(
  transpile("../src/modules/chats/components/floating-chat.tsx", imports)
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
function mount(t, options = {}) {
  const previousWindow = globalThis.window,
    previousHarness = globalThis.__floatingChat
  let slots = [],
    cursor = 0,
    effects = [],
    currentKey
  const viewport = Object.assign(new EventTarget(), {
    height: 640,
    offsetTop: 0,
  })
  const media = Object.assign(new EventTarget(), {
    matches: options.mobile ?? false,
  })
  const popup = {
    style: {
      setProperty(name, value) {
        this[name] = value
      },
      removeProperty(name) {
        delete this[name]
      },
    },
  }
  const window = Object.assign(new EventTarget(), {
    matchMedia: () => media,
    visualViewport: viewport,
    innerHeight: 640,
  })
  const screen = {
    session: { user: { id: "viewer" }, loading: false, ...options.session },
    pathname: options.pathname ?? "/products/item",
    unread: options.unread ?? 2,
    popup,
    viewport,
    media,
    window,
    tree: null,
    wrapper: null,
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
    ref(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
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
    render() {
      screen.wrapper = FloatingChat()
      // React remounts the widget when its account key changes.
      if (currentKey !== screen.wrapper.key) {
        for (const slot of slots) slot?.cleanup?.()
        slots = []
        currentKey = screen.wrapper.key
      }
      cursor = 0
      effects = []
      screen.tree = screen.wrapper.type(screen.wrapper.props)
      for (const node of nodes(screen.tree))
        if (node.props?.ref) node.props.ref.current = popup
      for (const effect of effects) effect()
      return screen.tree
    },
    setOpen(open) {
      nodes(screen.tree)
        .find((node) => node.type === "dialog-root")
        .props.onOpenChange(open)
      screen.render()
    },
    panel() {
      return nodes(screen.tree).find((node) => node.type === "chats-panel")
    },
    unmount() {
      for (const slot of slots) slot?.cleanup?.()
    },
  }
  globalThis.window = window
  globalThis.__floatingChat = screen
  t.after(() => {
    screen.unmount()
    globalThis.window = previousWindow
    globalThis.__floatingChat = previousHarness
  })
  screen.render()
  return screen
}

test("chat data stays lazy until opening, then minimizing preserves the embedded panel with active=false", (t) => {
  const screen = mount(t)
  assert.equal(screen.panel(), undefined)
  const launcher = nodes(screen.tree).find(
    (node) => node.type === "dialog-trigger"
  )
  assert.equal(
    launcher.props.render.props["aria-label"],
    "Mở chat, 2 tin nhắn chưa đọc"
  )
  assert.equal(
    nodes(screen.tree).find((node) => node.type === "dialog-portal").props
      .keepMounted,
    true
  )
  screen.setOpen(true)
  assert.equal(screen.panel().props.currentUserId, "viewer")
  assert.equal(screen.panel().props.embedded, true)
  assert.equal(screen.panel().props.active, true)
  screen.setOpen(false)
  assert.ok(
    screen.panel(),
    "keeping the panel mounted preserves loaded chat data and drafts"
  )
  assert.equal(screen.panel().props.active, false)
  screen.setOpen(true)
  assert.equal(screen.panel().props.active, true)
})

test("the dedicated chat route hides the launcher and pauses an already loaded panel without removing it", (t) => {
  const screen = mount(t)
  screen.setOpen(true)
  screen.pathname = "/chats/thread"
  screen.render()
  assert.equal(
    nodes(screen.tree).some((node) => node.type === "dialog-trigger"),
    false
  )
  assert.equal(
    nodes(screen.tree).find((node) => node.type === "dialog-root").props.open,
    false
  )
  assert.ok(screen.panel())
  assert.equal(screen.panel().props.active, false)
  screen.pathname = "/chats"
  screen.render()
  assert.equal(
    nodes(screen.tree).some((node) => node.type === "dialog-trigger"),
    false
  )
  screen.pathname = "/shops/store"
  screen.render()
  assert.equal(screen.panel().props.active, true)
})

test("changing account remounts the keyed widget so the previous account's open chat is discarded", (t) => {
  const screen = mount(t)
  screen.setOpen(true)
  assert.equal(screen.wrapper.key, "viewer")
  assert.equal(screen.panel().props.currentUserId, "viewer")
  screen.session.user = { id: "second-user" }
  screen.render()
  assert.equal(screen.wrapper.key, "second-user")
  assert.equal(screen.panel(), undefined)
  assert.equal(
    nodes(screen.tree).find((node) => node.type === "dialog-root").props.open,
    false
  )
  screen.setOpen(true)
  assert.equal(screen.panel().props.currentUserId, "second-user")
  screen.session.user = null
  screen.render()
  assert.equal(screen.wrapper.key, "guest")
  assert.equal(screen.panel(), undefined)
})

test("guests see the admin support entry and a safe login link returning to chat", (t) => {
  const screen = mount(t, { session: { user: null } })
  screen.setOpen(true)
  assert.equal(screen.panel(), undefined)
  const login = nodes(screen.tree).find(
    (node) => node.type === "link" && node.props.href.startsWith("/sign-in")
  )
  assert.equal(login.props.href, "/sign-in?redirect=%2Fchats")
  assert.ok(
    nodes(screen.tree).some(
      (node) => node.type === "p" && node.props.children === "Deal Hay Admin"
    )
  )
  login.props.onClick()
  screen.render()
  assert.equal(
    nodes(screen.tree).find((node) => node.type === "dialog-root").props.open,
    false
  )
})

test("maximizing opens the selected conversation and falls back to the list after deselection", (t) => {
  const screen = mount(t)
  screen.setOpen(true)
  screen.panel().props.onConversationChange("shop & viewer")
  screen.render()
  const maximize = () =>
    nodes(screen.tree).find(
      (node) => node.props?.["aria-label"] === "Mở trang tin nhắn đầy đủ"
    )
  assert.equal(maximize().props.href, "/chats/shop%20%26%20viewer")
  screen.panel().props.onConversationChange(undefined)
  screen.render()
  assert.equal(maximize().props.href, "/chats")
})

test("mobile chat is modal and follows the keyboard viewport, releasing listeners and custom sizes when minimized", (t) => {
  const screen = mount(t, { mobile: true })
  screen.setOpen(true)
  assert.equal(
    nodes(screen.tree).find((node) => node.type === "dialog-root").props.modal,
    true
  )
  assert.equal(screen.popup.style["--chat-viewport-height"], "640px")
  screen.viewport.height = 310
  screen.viewport.offsetTop = 42
  screen.viewport.dispatchEvent(new Event("resize"))
  assert.equal(screen.popup.style["--chat-viewport-height"], "310px")
  assert.equal(screen.popup.style["--chat-viewport-top"], "42px")
  screen.setOpen(false)
  assert.equal(screen.popup.style["--chat-viewport-height"], undefined)
  screen.viewport.dispatchEvent(new Event("scroll"))
  assert.equal(screen.popup.style["--chat-viewport-height"], undefined)
})
