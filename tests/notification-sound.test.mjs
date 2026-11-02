import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const react = moduleUrl(`
  export const useMemo=(create,deps)=>globalThis.__soundHarness.memo(create,deps)
  export const useCallback=(callback,deps)=>useMemo(()=>callback,deps)
  export const useRef=(current)=>useMemo(()=>({current}),[])
  export const useState=(initial)=>globalThis.__soundHarness.state(initial)
  export const useEffect=(effect,deps)=>globalThis.__soundHarness.effect(effect,deps)
  export const useSyncExternalStore=(subscribe,snapshot)=>{
    useEffect(()=>subscribe(()=>{}),[subscribe]);return snapshot()
  }
`)
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL(
      "../src/modules/realtime/hooks/use-notification-sound.ts",
      import.meta.url
    ),
    "utf8"
  ),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }
)
const { useNotificationSound: mountSound } = await import(
  moduleUrl(outputText.replace('from "react"', `from "${react}"`))
)
const settle = async () => {
  for (let step = 0; step < 12; step++) await Promise.resolve()
}
let userCounter = 0

function browser(t, { webkit = false, unsupported = false } = {}) {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const originals = new Map()
  const install = (key, value) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    })
  }
  const window = new EventTarget()
  const document = new EventTarget()
  document.visibilityState = "visible"
  const storage = new Map()
  const mounts = []
  const page = {
    document,
    window,
    storage,
    contexts: [],
    tones: [],
    peaks: [],
    time: 100_000,
    inGesture: false,
    blocked: false,
    gesture(type = "click") {
      page.inGesture = true
      document.dispatchEvent(new Event(type))
      page.inGesture = false
    },
    advance(ms) {
      page.time += ms
      t.mock.timers.tick(ms)
    },
    mount(userId = `sound-user-${++userCounter}`) {
      const slots = []
      let cursor = 0
      let effects = []
      const hooks = {
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
        state(initial) {
          const index = cursor++
          if (!(index in slots)) slots[index] = initial
          return [
            slots[index],
            (value) => {
              slots[index] =
                typeof value === "function" ? value(slots[index]) : value
            },
          ]
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
      }
      const mount = {
        userId,
        render(nextUserId = mount.userId) {
          mount.userId = nextUserId
          cursor = 0
          effects = []
          globalThis.__soundHarness = hooks
          const result = mountSound(nextUserId)
          for (const effect of effects) effect()
          return result
        },
        unmount() {
          for (const slot of slots) slot?.cleanup?.()
        },
      }
      mounts.push(mount)
      mount.render()
      return mount
    },
  }
  class FakeAudioContext extends EventTarget {
    constructor() {
      super()
      this.state = "suspended"
      this.currentTime = 0
      this.destination = {}
      this.resumes = 0
      this.waiters = []
      page.contexts.push(this)
    }
    setState(state) {
      this.state = state
      this.dispatchEvent(new Event("statechange"))
    }
    resume() {
      this.resumes++
      if (!page.blocked && (page.inGesture || this.unlocked)) {
        this.unlocked = true
        this.setState("running")
        for (const resolve of this.waiters.splice(0)) resolve()
        return Promise.resolve()
      }
      return new Promise((resolve) => this.waiters.push(resolve))
    }
    close() {
      this.setState("closed")
      return Promise.resolve()
    }
    createOscillator() {
      const node = new EventTarget()
      node.frequency = { setValueAtTime: (hz) => (node.hz = hz) }
      node.connect = () => {}
      node.disconnect = () => {}
      node.start = () => page.tones.push(node.hz)
      node.stop = () => node.dispatchEvent(new Event("ended"))
      return node
    }
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          exponentialRampToValueAtTime: (gain) => page.peaks.push(gain),
        },
        connect() {},
        disconnect() {},
      }
    }
  }
  if (!unsupported) {
    window[webkit ? "webkitAudioContext" : "AudioContext"] = FakeAudioContext
  }
  window.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  }
  install("window", window)
  install("document", document)
  install("navigator", {
    locks: { request: async (_name, _options, callback) => callback({}) },
  })
  install("performance", { now: () => page.time })
  t.mock.method(Date, "now", () => page.time)
  t.after(() => {
    for (const mount of mounts) mount.unmount()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
    delete globalThis.__soundHarness
  })
  return page
}

test("a blocked incoming burst keeps its latest sound until an iOS touchend unlocks WebKit audio", async (t) => {
  const page = browser(t, { webkit: true })
  const mount = page.mount()
  const sound = mount.render()
  assert.equal(sound.soundReady, false)
  sound.playNotificationSound("message:old")
  sound.playNotificationSound("notification:latest")
  assert.deepEqual(page.tones, [])
  assert.equal(page.contexts[0].resumes, 1)
  page.gesture("touchend")
  await settle()
  assert.deepEqual(page.tones, [880, 1174])
  assert.equal(mount.render().soundReady, true)
  const claimed = JSON.parse(
    page.storage.get(`deal-hay:notification-sound-events:${mount.userId}`)
  )
  assert.deepEqual(claimed.ids, ["notification:latest"])
  assert.ok(page.peaks.includes(0.24), "chime uses an audible volume")
})

test("new alerts resume interrupted audio even in a hidden tab and remain deduplicated", async (t) => {
  const page = browser(t)
  const mount = page.mount()
  page.gesture()
  await settle()
  page.document.visibilityState = "hidden"
  page.contexts[0].setState("interrupted")
  const sound = mount.render()
  assert.equal(sound.soundReady, false)
  sound.playNotificationSound("message:new")
  await settle()
  assert.deepEqual(page.tones, [880, 1174])
  page.advance(1200)
  sound.playNotificationSound("message:new")
  assert.equal(page.tones.length, 2)
  sound.playNotificationSound("notification:new")
  assert.equal(page.tones.length, 4)
})

test("the same event heard by multiple tabs produces one chime and bursts are throttled", async (t) => {
  const page = browser(t)
  const first = page.mount()
  const second = page.mount(first.userId)
  page.gesture("keydown")
  await settle()
  first.render().playNotificationSound("message:shared")
  second.render().playNotificationSound("message:shared")
  first.render().playNotificationSound("notification:burst")
  assert.equal(page.tones.length, 2)
  page.advance(1200)
  second.render().playNotificationSound("notification:next")
  assert.equal(page.tones.length, 4)
})

test("enabling sound plays a confirmation and muted users do not queue alerts", async (t) => {
  const page = browser(t)
  const mount = page.mount()
  page.storage.set(`deal-hay:notification-sound:${mount.userId}`, "muted")
  const muted = mount.render()
  assert.equal(muted.notificationSoundEnabled, false)
  muted.playNotificationSound("message:while-muted")
  assert.equal(page.contexts.length, 0)
  page.inGesture = true
  muted.toggleNotificationSound()
  page.inGesture = false
  await settle()
  assert.equal(mount.render().notificationSoundEnabled, true)
  assert.equal(page.tones.length, 2)
  mount.render().toggleNotificationSound()
  assert.equal(mount.render().soundReady, false)
  assert.equal(await mount.render().testNotificationSound(), false)
})

test("explicit sound testing reports success or a bounded failure instead of hanging", async (t) => {
  const page = browser(t)
  const mount = page.mount()
  const sound = mount.render()
  page.blocked = true
  const blocked = sound.testNotificationSound()
  page.advance(1500)
  assert.equal(await blocked, false)
  page.blocked = false
  page.inGesture = true
  const successful = sound.testNotificationSound()
  page.inGesture = false
  assert.equal(await successful, true)
  assert.equal(page.tones.length, 2)
  const next = mount.render()
  assert.equal(next.testNotificationSound, sound.testNotificationSound)
  assert.equal(next.playNotificationSound, sound.playNotificationSound)
})

test("stale queued alerts expire and changing users closes the previous audio context", async (t) => {
  const page = browser(t)
  const mount = page.mount()
  mount.render().playNotificationSound("message:stale")
  page.advance(30_001)
  page.gesture()
  await settle()
  assert.deepEqual(page.tones, [])
  const previousContext = page.contexts[0]
  mount.render("another-user")
  assert.equal(previousContext.state, "closed")
  assert.equal(mount.render().soundReady, false)
  mount.render().playNotificationSound("message:new-account")
  assert.equal(page.contexts.length, 2)
  mount.unmount()
  assert.equal(page.contexts[1].state, "closed")
  page.gesture()
  assert.equal(page.contexts.length, 2)
})

test("unsupported browsers keep visual delivery available and report test failure", async (t) => {
  const page = browser(t, { unsupported: true })
  const sound = page.mount().render()
  assert.doesNotThrow(() => sound.playNotificationSound("notification:new"))
  assert.equal(await sound.testNotificationSound(), false)
  assert.deepEqual(page.tones, [])
})

test("preferences still work when storage is unavailable and stay isolated per account", async (t) => {
  const page = browser(t)
  page.window.localStorage = {
    getItem() {
      throw new Error("Storage blocked")
    },
    setItem() {
      throw new Error("Storage blocked")
    },
  }
  const mount = page.mount()
  mount.render().toggleNotificationSound()
  assert.equal(mount.render().notificationSoundEnabled, false)
  mount.render().playNotificationSound("message:muted")
  assert.equal(page.contexts.length, 0)
  mount.render(`another-account-${++userCounter}`)
  assert.equal(mount.render().notificationSoundEnabled, true)
  page.gesture()
  mount.render().playNotificationSound("message:allowed")
  assert.equal(page.tones.length, 2)
})

test("unmounting settles pending sound tests and never plays after cleanup", async (t) => {
  const page = browser(t)
  const mount = page.mount()
  const pendingTest = mount.render().testNotificationSound()
  mount.unmount()
  assert.equal(await pendingTest, false)
  page.contexts[0].setState("running")
  page.gesture("touchend")
  await settle()
  assert.deepEqual(page.tones, [])
  assert.equal(page.contexts.length, 1)
})

test("muting while autoplay is blocked discards the incoming alert", async (t) => {
  const page = browser(t)
  const mount = page.mount()
  mount.render().playNotificationSound("message:queued-before-mute")
  mount.render().toggleNotificationSound()
  page.gesture("touchend")
  await settle()
  assert.deepEqual(page.tones, [])

  // Turning sound back on produces only the explicit confirmation, even when
  // the browser resolves an earlier blocked resume at the same time.
  page.inGesture = true
  mount.render().toggleNotificationSound()
  page.inGesture = false
  await settle()
  assert.deepEqual(page.tones, [880, 1174])
  assert.equal(
    page.storage.has(`deal-hay:notification-sound-events:${mount.userId}`),
    false
  )
})

test("an asynchronous cross-tab sound claim cannot play after account cleanup", async (t) => {
  const page = browser(t)
  let claim
  globalThis.navigator.locks.request = (_name, _options, callback) =>
    new Promise((resolve) => {
      claim = () => resolve(callback({}))
    })
  const mount = page.mount()
  page.gesture()
  await settle()
  mount.render().playNotificationSound("message:previous-account")
  assert.equal(typeof claim, "function")
  mount.render(`next-account-${++userCounter}`)
  claim()
  await settle()
  assert.deepEqual(page.tones, [])
})
