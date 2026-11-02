import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const url = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const react = url(`
export function useState(initial){return globalThis.__resourceHook.screen.useState(initial)}
export function useRef(initial){return globalThis.__resourceHook.screen.useRef(initial)}
export function useEffect(effect,deps){return globalThis.__resourceHook.screen.useEffect(effect,deps)}
export function useCallback(callback,deps){return globalThis.__resourceHook.screen.useCallback(callback,deps)}
`)
const transport = url(`
export function getAccessToken(){return globalThis.__resourceHook.token}
export function loadServerResources(target,signal){return globalThis.__resourceHook.load(target,signal)}
`)
const imports = {
  react,
  "@/lib/session": transport,
  "@/modules/diagnostics/resource-actions": transport,
}
const source = ts
  .transpileModule(
    readFileSync(
      new URL(
        "../src/modules/diagnostics/hooks/use-server-resources.ts",
        import.meta.url
      ),
      "utf8"
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }
  )
  .outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
    assert.ok(imports[name], name)
    return `from ${quote}${imports[name]}${quote}`
  })
const { useServerResources: renderResourceHook } = await import(url(source))

const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}
const sample = (name) => ({ instance_id: name })
function mount(t, { abortable = true } = {}) {
  const timeouts = new Map(),
    intervals = new Map(),
    requests = []
  let timer = 0
  t.mock.method(globalThis, "setTimeout", (callback, delay) => {
    const id = ++timer
    timeouts.set(id, { callback, delay })
    return id
  })
  t.mock.method(globalThis, "clearTimeout", (id) => timeouts.delete(id))
  t.mock.method(globalThis, "setInterval", (callback, delay) => {
    const id = ++timer
    intervals.set(id, { callback, delay })
    return id
  })
  t.mock.method(globalThis, "clearInterval", (id) => intervals.delete(id))
  globalThis.document = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  })
  const context = {
    token: "admin-a",
    screen: null,
    load(target, signal) {
      let resolve, reject
      const promise = new Promise((done, fail) => {
        resolve = done
        reject = fail
      })
      requests.push({ target, signal, resolve, reject })
      if (abortable)
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        })
      return promise
    },
  }
  globalThis.__resourceHook = context
  const screen = {
    slots: [],
    cursor: 0,
    writes: [],
    disposed: false,
    useState(initial) {
      const index = this.cursor++
      if (!(index in this.slots))
        this.slots[index] = typeof initial === "function" ? initial() : initial
      return [
        this.slots[index],
        (next) => {
          this.slots[index] =
            typeof next === "function" ? next(this.slots[index]) : next
          this.writes.push(this.slots[index])
        },
      ]
    },
    useRef(initial) {
      const index = this.cursor++
      if (!(index in this.slots)) this.slots[index] = { current: initial }
      return this.slots[index]
    },
    useCallback(callback, deps) {
      const index = this.cursor++,
        previous = this.slots[index]
      if (
        !previous ||
        deps.some((value, i) => !Object.is(value, previous.deps[i]))
      )
        this.slots[index] = { callback, deps }
      return this.slots[index].callback
    },
    useEffect(effect, deps) {
      const index = this.cursor++,
        previous = this.slots[index]
      if (
        !previous ||
        deps.some((value, i) => !Object.is(value, previous.deps[i]))
      ) {
        previous?.cleanup?.()
        this.slots[index] = { effect, deps, cleanup: effect() }
      }
    },
    render() {
      assert.equal(this.disposed, false)
      context.screen = this
      this.cursor = 0
      return renderResourceHook()
    },
    replayEffects() {
      for (const slot of this.slots) slot?.cleanup?.()
      for (const slot of this.slots)
        if (slot?.effect) slot.cleanup = slot.effect()
    },
    unmount() {
      if (this.disposed) return
      this.disposed = true
      for (const slot of this.slots) slot?.cleanup?.()
    },
    poll() {
      for (const { callback, delay } of intervals.values()) {
        assert.equal(delay, 5000)
        callback()
      }
    },
    expire() {
      for (const [id, { callback, delay }] of [...timeouts]) {
        assert.equal(delay, 10000)
        timeouts.delete(id)
        callback()
      }
    },
    get result() {
      return this.render()
    },
    requests,
    timeouts,
    intervals,
    context,
  }
  screen.render()
  t.after(() => screen.unmount())
  return screen
}

test("resource polling starts both targets and duplicate refreshes never overlap a target", async (t) => {
  const screen = mount(t)
  assert.deepEqual(
    screen.requests.map((item) => item.target),
    ["backend", "wss"]
  )
  screen.result.refresh()
  screen.poll()
  document.dispatchEvent(new Event("visibilitychange"))
  assert.equal(screen.requests.length, 2)
  screen.requests[0].resolve(sample("api-first"))
  await settle()
  screen.result.refresh()
  assert.deepEqual(
    screen.requests.map((item) => item.target),
    ["backend", "wss", "backend"]
  )
  assert.equal(screen.result.states.backend.data.instance_id, "api-first")
  assert.equal(screen.result.states.wss.data, null)
})

test("hidden tabs pause automatic resource polling and visibility resumes it", async (t) => {
  const screen = mount(t)
  for (const request of screen.requests) request.resolve(sample(request.target))
  await settle()
  document.visibilityState = "hidden"
  screen.poll()
  document.dispatchEvent(new Event("visibilitychange"))
  assert.equal(screen.requests.length, 2)
  document.visibilityState = "visible"
  document.dispatchEvent(new Event("visibilitychange"))
  assert.equal(screen.requests.length, 4)
})

test("failed refreshes keep the previous sample and recover independently", async (t) => {
  const screen = mount(t)
  for (const request of screen.requests) request.resolve(sample(request.target))
  await settle()
  screen.result.refresh()
  screen.requests[2].reject(new Error("API unavailable"))
  screen.requests[3].resolve(sample("wss-new"))
  await settle()
  assert.deepEqual(screen.result.states.backend, {
    data: sample("backend"),
    error: "API unavailable",
    loading: false,
  })
  assert.deepEqual(screen.result.states.wss, {
    data: sample("wss-new"),
    error: null,
    loading: false,
  })
  screen.poll()
  screen.requests[4].resolve(sample("api-recovered"))
  await settle()
  assert.equal(screen.result.states.backend.error, null)
  assert.equal(screen.result.states.backend.data.instance_id, "api-recovered")
})

test("a ten-second resource deadline aborts hung requests and unlocks retry", async (t) => {
  const screen = mount(t)
  screen.expire()
  await settle()
  for (const request of screen.requests)
    assert.equal(request.signal.aborted, true)
  assert.equal(screen.result.loading, false)
  assert.match(screen.result.states.backend.error, /10 giây/)
  screen.result.refresh()
  assert.equal(screen.requests.length, 4)
  assert.equal(screen.result.loading, true)
})

test("late responses from another account cannot overwrite the visible resources", async (t) => {
  const screen = mount(t)
  screen.context.token = "admin-b"
  const writes = screen.writes.length
  for (const request of screen.requests)
    request.resolve(sample("admin-a-secret"))
  await settle()
  assert.equal(screen.writes.length, writes)
  assert.equal(screen.result.states.backend.data, null)
  screen.result.refresh()
  screen.requests[2].resolve(sample("admin-b-current"))
  await settle()
  assert.equal(screen.result.states.backend.data.instance_id, "admin-b-current")
})

test("unmount cancels polling and ignores transports that finish after cancellation", async (t) => {
  const screen = mount(t, { abortable: false })
  screen.unmount()
  assert.equal(screen.intervals.size, 0)
  for (const request of screen.requests)
    assert.equal(request.signal.aborted, true)
  const writes = screen.writes.length
  for (const request of screen.requests) request.resolve(sample("late"))
  await settle()
  document.dispatchEvent(new Event("visibilitychange"))
  assert.equal(screen.requests.length, 2)
  assert.equal(screen.writes.length, writes)
  assert.equal(screen.timeouts.size, 0)
})

test("StrictMode effect replay cannot let an old request unlock the current poll", async (t) => {
  const screen = mount(t)
  screen.replayEffects()
  assert.equal(screen.requests.length, 4)
  assert.equal(screen.requests[0].signal.aborted, true)
  assert.equal(screen.requests[1].signal.aborted, true)
  await settle()
  screen.result.refresh()
  screen.poll()
  assert.equal(screen.requests.length, 4)
  screen.requests[2].resolve(sample("current-api"))
  screen.requests[3].resolve(sample("current-wss"))
  await settle()
  assert.equal(screen.result.states.backend.error, null)
  assert.equal(screen.result.states.backend.data.instance_id, "current-api")
  assert.equal(screen.result.states.wss.data.instance_id, "current-wss")
})
