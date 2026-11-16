import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const hooks = moduleUrl(`
  export const useRef=(value)=>globalThis.__scrollScreen.ref(value)
  export const useEffect=(effect,deps)=>globalThis.__scrollScreen.effect(effect,deps)
  export const usePathname=()=>globalThis.__scrollScreen.window.location.pathname
  export const useSearchParams=()=>globalThis.__scrollScreen.window.location.searchParams
`)
const source = ts.transpileModule(
  readFileSync(
    new URL("../src/components/layout/navigation-scroll.tsx", import.meta.url),
    "utf8"
  ),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }
).outputText
const { NavigationScroll } = await import(
  moduleUrl(source.replace(/from "(?:react|next\/navigation)"/g, `from "${hooks}"`))
)

function mount(t, href = "/") {
  const slots = [],
    frames = new Map(),
    window = new EventTarget()
  let slot = 0,
    frameId = 0
  const screen = {
    window,
    scrolls: [],
    ref(value) {
      const index = slot++
      slots[index] ??= { current: value }
      return slots[index]
    },
    effect(effect, deps) {
      const index = slot++,
        old = slots[index]
      if (old && deps.every((value, i) => value === old.deps[i])) return
      old?.cleanup?.()
      slots[index] = { deps, cleanup: effect() }
    },
    render(href) {
      window.location = new URL(href, "https://example.test")
      slot = 0
      NavigationScroll()
    },
    flush() {
      for (const [id, callback] of frames) {
        frames.delete(id)
        callback()
      }
    },
    navigate(href) {
      this.render(href)
      this.flush()
    },
    restore(href) {
      window.location = new URL(href, "https://example.test")
      window.dispatchEvent(new Event("popstate"))
      this.navigate(href)
    },
  }
  window.scrollTo = (options) => screen.scrolls.push(options)
  window.requestAnimationFrame = (callback) => {
    frames.set(++frameId, callback)
    return frameId
  }
  window.cancelAnimationFrame = (id) => frames.delete(id)
  t.mock.property(globalThis, "window", window)
  globalThis.__scrollScreen = screen
  t.after(() => {
    for (const entry of slots) entry?.cleanup?.()
    delete globalThis.__scrollScreen
  })
  screen.navigate(href)
  return screen
}
Object.defineProperty(globalThis, "window", {
  configurable: true,
  writable: true,
  value: undefined,
})

test("new route navigation scrolls to the document top after commit, without resetting initial load", (t) => {
  const screen = mount(t, "/?page=2")
  assert.deepEqual(screen.scrolls, [])
  screen.render("/shops/shop-1")
  assert.deepEqual(screen.scrolls, [])
  screen.flush()
  assert.deepEqual(screen.scrolls, [{ top: 0, left: 0, behavior: "instant" }])
})

test("pagination and seller section changes reset scrolling even within one route", (t) => {
  const screen = mount(t, "/?category=Thoi+trang")
  screen.navigate("/?category=Thoi+trang&page=2")
  screen.navigate("/?category=Thoi+trang")
  screen.navigate("/shop-manage?tab=products")
  screen.navigate("/shop-manage?tab=orders")
  assert.equal(screen.scrolls.length, 4)
})

test("opening management details and changing filters keeps the current scroll position", (t) => {
  const screen = mount(t, "/admin/shops?page=2")
  screen.navigate("/admin/shops?page=2&shop=selected")
  screen.navigate("/admin/shops?page=2&status=active")
  screen.navigate("/admin/shops?status=active&page=2")
  assert.deepEqual(screen.scrolls, [])
})

test("explicit anchors and chat message positioning remain available", (t) => {
  const screen = mount(t)
  screen.navigate("/?page=2#san-pham")
  screen.navigate("/shops/shop-1#reviews")
  screen.navigate("/chats")
  screen.navigate("/chats/conversation?message=target")
  assert.deepEqual(screen.scrolls, [])
  screen.navigate("/notifications")
  assert.equal(screen.scrolls.length, 1)
})

test("back and forward retain browser restoration, while the next navigation scrolls normally", (t) => {
  const screen = mount(t, "/?page=2")
  screen.restore("/?page=1")
  screen.restore("/?page=2")
  screen.restore("/shops/shop-1")
  assert.deepEqual(screen.scrolls, [])
  screen.navigate("/shops/shop-2")
  assert.equal(screen.scrolls.length, 1)
})

test("a superseded route cannot run its queued scroll after anchor navigation", (t) => {
  const screen = mount(t)
  screen.render("/shops/shop-1")
  screen.render("/shops/shop-2#reviews")
  screen.flush()
  assert.deepEqual(screen.scrolls, [])
})

test("a same-route anchor added before the next frame cancels the queued reset", (t) => {
  const screen = mount(t)
  screen.render("/shops/shop-1")
  screen.render("/shops/shop-1#reviews")
  screen.flush()
  assert.deepEqual(screen.scrolls, [])
})

test("history navigation before the next React commit cancels the queued reset", (t) => {
  const screen = mount(t)
  screen.render("/shops/shop-1")
  screen.window.dispatchEvent(new Event("popstate"))
  screen.flush()
  assert.deepEqual(screen.scrolls, [])
})
