import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const react = moduleUrl(`
  export const createContext=()=>({Provider:'realtime-provider'})
  export const useContext=()=>null
  export const useState=(initial)=>globalThis.__toastHarness.hooks.state(initial)
  export const useMemo=(create,deps)=>globalThis.__toastHarness.hooks.memo(create,deps)
  export const useCallback=(callback,deps)=>useMemo(()=>callback,deps)
  export const useRef=(current)=>useMemo(()=>({current}),[])
  export const useEffect=(effect,deps)=>globalThis.__toastHarness.hooks.effect(effect,deps)
`)
const dependencies = moduleUrl(`
  export const useRouter=()=>globalThis.__toastHarness.router
  export const toast=(title,options)=>globalThis.__toastHarness.toasts.push({title,options})
  export const refreshUnreadCountsAction=async()=>null
  export const refreshNotificationCountAction=async()=>null
  export const loadRealtimeConfigAction=async()=>globalThis.__toastHarness.config
  export const loadSocketSessionAction=async()=>null
  export const useUnreadTabTitle=()=>{}
  export const useNotificationSound=()=>({
    notificationSoundEnabled:!globalThis.__toastHarness.muted,
    toggleNotificationSound:()=>{},
    playNotificationSound:(id)=>{if(!globalThis.__toastHarness.muted)globalThis.__toastHarness.sounds.push(id)}
  })
  export const createSocketRealtimeClient=()=>globalThis.__toastHarness.client
`)
const imports = {
  react,
  "react/jsx-runtime": moduleUrl(
    "export const jsx=(type,props)=>({type,props});export const jsxs=jsx"
  ),
  "next/navigation": dependencies,
  sonner: dependencies,
  "@/modules/chats/actions": dependencies,
  "@/modules/realtime/actions": dependencies,
  "@/modules/realtime/hooks/use-notification-sound": dependencies,
  "@/modules/realtime/hooks/use-unread-tab-title": dependencies,
  "@/lib/socket-realtime-client": dependencies,
}
const source = ts
  .transpileModule(
    readFileSync(
      new URL("../src/components/realtime-provider.tsx", import.meta.url),
      "utf8"
    ),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }
  )
  .outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
    assert.ok(imports[name], `Unexpected import: ${name}`)
    return `from ${quote}${imports[name]}${quote}`
  })
  .replace(/import\((["'])([^"']+)\1\)/g, (_, quote, name) => {
    assert.ok(imports[name], `Unexpected dynamic import: ${name}`)
    return `import(${quote}${imports[name]}${quote})`
  })
const { RealtimeProvider } = await import(moduleUrl(source))
const settle = async () => {
  for (let step = 0; step < 12; step++) await Promise.resolve()
}

async function mount(t, { muted = false } = {}) {
  const slots = []
  let cursor = 0
  let effects = []
  const channels = new Map()
  const state = {
    muted,
    toasts: [],
    sounds: [],
    destinations: [],
    config: { broadcaster: "socketio", url: "https://wss.example.test" },
    router: { push: (path) => state.destinations.push(path) },
    client: {
      private(name) {
        if (!channels.has(name))
          channels.set(name, {
            listeners: new Map(),
            listen(event, listener) {
              this.listeners.set(event, listener)
              return this
            },
            subscribed() {
              return this
            },
            error() {
              return this
            },
          })
        return channels.get(name)
      },
      disconnect() {},
      socketId: () => "socket-id",
      connectionStatus: () => "connected",
      connector: { onConnectionChange: () => () => {} },
    },
    hooks: {
      state(initial) {
        const index = cursor++
        if (!(index in slots))
          slots[index] = typeof initial === "function" ? initial() : initial
        return [
          slots[index],
          (next) => {
            slots[index] =
              typeof next === "function" ? next(slots[index]) : next
          },
        ]
      },
      memo(create, deps) {
        const index = cursor++
        const previous = slots[index]
        if (
          !previous ||
          deps.some((dep, i) => !Object.is(dep, previous.deps[i]))
        )
          slots[index] = { deps, value: create() }
        return slots[index].value
      },
      effect(effect, deps) {
        const index = cursor++
        const previous = slots[index]
        if (
          !previous ||
          deps.some((dep, i) => !Object.is(dep, previous.deps[i]))
        )
          effects.push(() => {
            previous?.cleanup?.()
            slots[index] = { deps, cleanup: effect() }
          })
      },
    },
    render() {
      cursor = 0
      effects = []
      const rendered = RealtimeProvider({
        config: state.config,
        currentUserId: "viewer",
        initialUnreadCounts: { messages: 0, notifications: 0 },
        children: null,
      })
      for (const effect of effects) effect()
      return rendered.props.value
    },
    emit(kind, payload) {
      const channel =
        kind === "message" ? "user-chat.viewer" : "user-notifications.viewer"
      const event =
        kind === "message" ? ".message.sent" : ".notification.created"
      const listener = channels.get(channel)?.listeners.get(event)
      assert.ok(listener, `${kind} realtime listener is subscribed`)
      listener(payload)
    },
  }
  globalThis.__toastHarness = state
  state.render()
  await settle()
  t.after(async () => {
    for (const slot of slots) slot?.cleanup?.()
    await settle()
  })
  return state
}

const message = (overrides = {}) => ({
  id: "message-id",
  conversation_id: "conversation-id",
  body: " Xin chào! ",
  sender: { id: "other-user", name: "Cửa hàng" },
  read_at: null,
  attachment: null,
  product: null,
  ...overrides,
})

test("incoming chat displays sender, preview and a safe action even while sound is muted", async (t) => {
  const page = await mount(t, { muted: true })
  page.emit("message", message())
  assert.equal(page.toasts.length, 1)
  const { title, options } = page.toasts[0]
  assert.equal(title, "Tin nhắn mới từ Cửa hàng")
  assert.equal(options.description, "Xin chào!")
  assert.equal(options.id, "message:message-id")
  assert.equal(options.duration, 6000)
  assert.equal(options.action.label, "Xem")
  options.action.onClick()
  assert.deepEqual(page.destinations, ["/chats"])
  assert.deepEqual(page.sounds, [])
})

test("images, videos, files, shared products and empty messages have useful toast previews", async (t) => {
  const page = await mount(t)
  const cases = [
    [{ attachment: { type: "image" } }, "Đã gửi một ảnh."],
    [{ attachment: { type: "video" } }, "Đã gửi một video."],
    [{ attachment: { type: "file" } }, "Đã gửi tệp đính kèm."],
    [{ product: { name: "Áo thun" } }, "Sản phẩm: Áo thun"],
    [{}, "Bạn có tin nhắn mới."],
  ]
  for (const [index, [extra, expected]] of cases.entries()) {
    page.emit(
      "message",
      message({
        ...extra,
        id: `attachment-${index}`,
        body: "  ",
        sender: { id: "other-user" },
      })
    )
    assert.equal(page.toasts.at(-1).title, "Tin nhắn mới")
    assert.equal(page.toasts.at(-1).options.description, expected)
  }
})

test("duplicate events and reconnect do not repeat a toast, and own or already read messages stay quiet", async (t) => {
  const page = await mount(t)
  page.emit("message", message())
  page.emit("message", message())
  page.render().reconnect()
  await settle()
  page.render()
  await settle()
  page.emit("message", message())
  page.emit(
    "message",
    message({ id: "own", sender: { id: "viewer", name: "Me" } })
  )
  page.emit("message", message({ id: "read", read_at: "2026-11-01T00:00:00Z" }))
  page.emit(
    "message",
    message({ id: "viewer-read", viewer_read_at: "2026-11-01T00:00:00Z" })
  )
  assert.equal(page.toasts.length, 1)
  assert.deepEqual(page.sounds, ["message:message-id"])
})

test("another participant reading a group message does not suppress this viewer's toast", async (t) => {
  const page = await mount(t)
  page.emit(
    "message",
    message({ read_at: "2026-11-01T00:00:00Z", viewer_read_at: null })
  )
  assert.equal(page.toasts.length, 1)
})

test("business notifications fall back to a title and have a distinct ID from chat messages", async (t) => {
  const page = await mount(t)
  page.emit("message", message({ id: "same-id" }))
  const notification = {
    id: "same-id",
    title: "  ",
    body: "Đơn hàng đã được xác nhận.",
    read_at: null,
    action_url: "javascript:alert(1)",
  }
  page.emit("notification", notification)
  page.emit("notification", notification)
  assert.equal(page.toasts.length, 2)
  const { title, options } = page.toasts[1]
  assert.equal(title, "Thông báo mới")
  assert.equal(options.id, "notification:same-id")
  assert.equal(options.description, notification.body)
  assert.equal(options.duration, 6000)
  options.action.onClick()
  assert.deepEqual(page.destinations, ["/notifications"])
  page.emit("notification", {
    id: "read-notification",
    read_at: "2026-11-01T00:00:00Z",
  })
  assert.equal(page.toasts.length, 2)
  page.emit("notification", { id: "missing-title" })
  assert.equal(page.toasts.at(-1).title, "Thông báo mới")
})

test("long Unicode message previews are bounded without splitting emoji", async (t) => {
  const page = await mount(t)
  page.emit("message", message({ body: "😀".repeat(200) }))
  const preview = page.toasts[0].options.description
  assert.ok(preview.endsWith("…"))
  assert.ok(Array.from(preview).length <= 160)
  assert.doesNotMatch(
    preview,
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u
  )
})
