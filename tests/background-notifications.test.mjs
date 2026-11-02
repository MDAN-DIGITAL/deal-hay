import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"

const workerSource = readFileSync(
  new URL("../public/notification-worker.js", import.meta.url),
  "utf8"
)

function workerHarness({ cache = new Map(), windows = [] } = {}) {
  const listeners = new Map()
  const shown = [],
    opened = []
  const self = {
    location: { origin: "https://dealhay.test" },
    addEventListener: (name, callback) => listeners.set(name, callback),
    skipWaiting: async () => {},
    clients: {
      matchAll: async () => windows,
      claim: async () => {},
      openWindow: async (url) => opened.push(url),
    },
    registration: {
      showNotification: async (title, options) =>
        shown.push({ title, ...options }),
      getNotifications: async () =>
        shown.map((notification) => ({
          close: () => {
            notification.closed = true
          },
        })),
    },
  }
  vm.runInNewContext(workerSource, {
    self,
    URL,
    Response,
    caches: {
      open: async () => ({
        match: async (key) => cache.get(key)?.clone(),
        put: async (key, value) => cache.set(key, value),
      }),
    },
  })
  async function dispatch(name, input = {}) {
    const pending = []
    listeners.get(name)({
      ...input,
      waitUntil: (promise) => pending.push(promise),
    })
    await Promise.all(pending)
  }
  return {
    cache,
    shown,
    opened,
    dispatch,
    bind: (ownerId) =>
      dispatch("message", {
        source: { url: "https://dealhay.test/chats" },
        data: { type: "dealhay:notification-owner", ownerId },
      }),
    push: (notification) =>
      dispatch("push", { data: { json: () => notification } }),
  }
}
const payload = (overrides = {}) => ({
  id: "message:m1",
  ownerId: "viewer",
  title: "Shop vừa nhắn",
  body: "Xin chào",
  url: "/chats?conversation=c1&message=m1",
  avatar: "/shop.jpg",
  ...overrides,
})

test("a push rings while the tab is hidden and keeps an exact chat destination and avatar", async () => {
  const worker = workerHarness({
    windows: [{ visibilityState: "hidden", focused: false }],
  })
  await worker.bind("viewer")
  await worker.push(payload())
  assert.equal(worker.shown.length, 1)
  assert.equal(worker.shown[0].silent, false)
  assert.equal(worker.shown[0].icon, "https://dealhay.test/shop.jpg")
  assert.equal(worker.shown[0].data.url, "/chats?conversation=c1&message=m1")
  assert.equal(worker.shown[0].tag, "dealhay:viewer:message:m1")
})

test("foreground Web Push remains audible even if the tab has not unlocked browser audio", async () => {
  const worker = workerHarness({
    windows: [{ visibilityState: "visible", focused: true }],
  })
  await worker.bind("viewer")
  await worker.push(payload())
  assert.equal(worker.shown.length, 1)
  assert.equal(worker.shown[0].silent, false)
  assert.ok(
    !("vibrate" in worker.shown[0]),
    "silent notifications must omit vibrate"
  )
})

test("deduplication survives worker restart, and socket fallback plus actual push rings only once", async () => {
  const worker = workerHarness()
  await worker.bind("viewer")
  await worker.dispatch("message", {
    source: { url: "https://dealhay.test/chats" },
    data: { type: "dealhay:show-notification", notification: payload() },
  })
  const restarted = workerHarness({ cache: worker.cache })
  await restarted.push(payload())
  assert.equal(worker.shown[0].silent, false)
  assert.equal(restarted.shown[0].silent, true)
  assert.equal(restarted.shown[0].renotify, false)
  await restarted.push(payload({ id: "message:m2" }))
  assert.equal(restarted.shown[1].silent, false)
})

test("logout and account switch close old cards and reject queued pushes for the previous user", async () => {
  const worker = workerHarness()
  await worker.bind("viewer")
  await worker.push(payload())
  await worker.bind(null)
  assert.equal(worker.shown[0].closed, true)
  await worker.push(payload({ id: "message:after-logout" }))
  await worker.bind("another-user")
  await worker.push(payload({ id: "message:wrong-user" }))
  assert.equal(worker.shown.length, 1)
  await worker.push(payload({ id: "message:valid", ownerId: "another-user" }))
  assert.equal(worker.shown.length, 2)
})

test("notification clicks focus an existing tab and navigate to the exact message, or open a new app window", async () => {
  const navigation = []
  const worker = workerHarness({
    windows: [
      {
        url: "https://dealhay.test/profile",
        navigate: async (url) => navigation.push(url),
        focus: async () => navigation.push("focus"),
      },
    ],
  })
  await worker.bind("viewer")
  let closed = false
  await worker.dispatch("notificationclick", {
    notification: {
      close: () => {
        closed = true
      },
      data: { ownerId: "viewer", url: payload().url },
    },
  })
  assert.equal(closed, true)
  assert.deepEqual(navigation, [
    "https://dealhay.test/chats?conversation=c1&message=m1",
    "focus",
  ])
  const closedApp = workerHarness({ cache: worker.cache })
  await closedApp.dispatch("notificationclick", {
    notification: {
      close() {},
      data: { ownerId: "viewer", url: "/notifications" },
    },
  })
  assert.deepEqual(closedApp.opened, ["https://dealhay.test/notifications"])
})

test("unsafe destinations, malformed pushes and stale notification clicks cannot leave the site or reveal another account", async () => {
  const worker = workerHarness()
  await worker.bind("viewer")
  for (const url of [
    "javascript:alert(1)",
    "//evil.test",
    "https://evil.test/chats",
    "/\\evil.test",
    "/chats\n",
  ]) {
    await worker.push(payload({ id: `message:m${worker.shown.length}`, url }))
    assert.equal(worker.shown.at(-1).data.url, "/notifications")
  }
  const count = worker.shown.length
  await worker.push(payload({ ownerId: "../bad" }))
  await worker.push(payload({ id: "invalid" }))
  await worker.dispatch("push", {
    data: {
      json: () => {
        throw new Error("invalid JSON")
      },
    },
  })
  assert.equal(worker.shown.length, count)
  await worker.bind("new-user")
  await worker.dispatch("notificationclick", {
    notification: {
      close() {},
      data: { ownerId: "viewer", url: "/chats?conversation=private" },
    },
  })
  assert.deepEqual(worker.opened, [])
})

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
let importId = 0
async function clientHarness(
  t,
  {
    owner = null,
    permission = "granted",
    subscription = true,
    locks = false,
  } = {}
) {
  const previous = new Map()
  const cleanups = []
  const replace = (key, value) => {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    })
  }
  t.after(() => {
    for (const cleanup of cleanups) cleanup()
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  const storage = new Map(owner ? [["dealhay:push-owner", owner]] : [])
  const operations = [],
    requests = []
  const key = Uint8Array.from([4, 1, 2, 3]).buffer
  const state = {
    operations,
    requests,
    storage,
    failPost: false,
    failDelete: false,
    failWorker: false,
    postGate: null,
    subscribeGate: null,
    registrationGate: null,
    subscriptionGate: null,
    unsubscribeGate: null,
    cardsGate: null,
    deleteGate: null,
    closedCards: 0,
    subscription: null,
    createSubscription() {
      const current = {
        endpoint: "https://push.test/subscription",
        options: { applicationServerKey: key },
        toJSON: () => ({
          endpoint: "https://push.test/subscription",
          keys: { p256dh: "public", auth: "secret" },
        }),
        unsubscribe: async () => {
          operations.push("unsubscribe")
          if (state.unsubscribeGate) await state.unsubscribeGate
          if (state.subscription === current) state.subscription = null
          return true
        },
      }
      return current
    },
  }
  state.subscription = subscription ? state.createSubscription() : null
  const registration = {
    getNotifications: async () => {
      if (state.cardsGate) await state.cardsGate
      return [
        {
          close() {
            state.closedCards++
          },
        },
      ]
    },
    active: {
      postMessage(message, ports) {
        operations.push(`worker:${message.ownerId ?? "none"}`)
        ports[0].partner.onmessage({ data: { ok: !state.failWorker } })
      },
    },
    pushManager: {
      getSubscription: async () => {
        const gate = state.subscriptionGate
        state.subscriptionGate = null
        if (gate) await gate
        return state.subscription
      },
      subscribe: async (options) => {
        operations.push("subscribe")
        if (state.subscribeGate) await state.subscribeGate
        assert.equal(options.userVisibleOnly, true)
        assert.deepEqual([...options.applicationServerKey], [4, 1, 2, 3])
        state.subscription = state.createSubscription()
        return state.subscription
      },
    },
  }
  replace(
    "window",
    Object.assign(new EventTarget(), {
      isSecureContext: true,
      PushManager: class {},
      Notification: {},
      matchMedia: () => ({ matches: false }),
      setTimeout,
      clearTimeout,
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.delete(key),
      },
    })
  )
  replace("navigator", {
    userAgent: "Chrome",
    platform: "Linux",
    maxTouchPoints: 0,
    serviceWorker: {
      register: async () => registration,
      ready: Promise.resolve(registration),
      getRegistration: async () => {
        if (state.registrationGate) await state.registrationGate
        return registration
      },
    },
  })
  if (locks) {
    let queued = Promise.resolve()
    navigator.locks = {
      request(_name, work) {
        const result = queued.then(work)
        queued = result.catch(() => {})
        return result
      },
    }
  }
  replace("Notification", { permission })
  replace(
    "document",
    Object.assign(new EventTarget(), { visibilityState: "hidden" })
  )
  replace(
    "MessageChannel",
    class {
      constructor() {
        this.port1 = { close() {}, onmessage: null }
        this.port2 = { partner: this.port1 }
      }
    }
  )
  replace("__pushApi", async (request) => {
    requests.push(request)
    operations.push(`request:${request.method ?? "GET"}`)
    if (request.method === "POST" && state.postGate) await state.postGate
    if (request.method === "DELETE" && state.deleteGate) await state.deleteGate
    if (request.method === "POST" && state.failPost)
      throw new Error("server offline")
    if (request.method === "DELETE" && state.failDelete)
      throw new Error("server offline")
    return request.path === "/push/config"
      ? { enabled: true, publicKey: "BAECAw" }
      : {}
  })
  const source = ts
    .transpileModule(
      readFileSync(
        new URL(
          "../src/modules/realtime/lib/background-notifications.ts",
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
    .outputText.replace(
      '"@/api/wss-client"',
      JSON.stringify(
        moduleUrl(
          "export const wssFetch=(request)=>globalThis.__pushApi(request)"
        )
      )
    )
  state.forkTab = () => import(moduleUrl(source + `\n// import ${++importId}`))
  state.client = await state.forkTab()
  state.config = { enabled: true, publicKey: "BAECAw" }
  state.mountHook = async (userId) => {
    document.visibilityState = "visible"
    replace("__pushHookClient", state.client)
    const hookDeps = moduleUrl(`
      export const BACKGROUND_NOTIFICATIONS_CHANGED = "dealhay:background-notifications";
      ${["backgroundNotificationAvailability", "backgroundNotificationOwner", "backgroundNotificationPendingOwner", "clearBackgroundNotificationOwner", "enableBackgroundNotifications", "loadPushConfig", "notificationWorker", "restoreBackgroundNotifications"].map((name) => `export const ${name}=(...args)=>globalThis.__pushHookClient.${name}(...args);`).join("\n")}
    `)
    const react = moduleUrl(`
      export const useRef=(initial)=>globalThis.__pushHookHarness.memo(()=>({current:initial}),[])
      export const useCallback=(callback,deps)=>globalThis.__pushHookHarness.memo(()=>callback,deps)
      export const useState=(initial)=>globalThis.__pushHookHarness.state(initial)
      export const useEffect=(effect,deps)=>globalThis.__pushHookHarness.effect(effect,deps)
    `)
    const hookSource = ts
      .transpileModule(
        readFileSync(
          new URL(
            "../src/modules/realtime/hooks/use-background-notifications.ts",
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
      .outputText.replace('"react"', JSON.stringify(react))
      .replace(
        '"@/modules/realtime/lib/background-notifications"',
        JSON.stringify(hookDeps)
      )
    const { useBackgroundNotifications } = await import(moduleUrl(hookSource))
    const slots = []
    let cursor = 0,
      effects = []
    const hooks = {
      memo(create, deps) {
        const index = cursor++,
          previous = slots[index]
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
        const index = cursor++,
          previous = slots[index]
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
    replace("__pushHookHarness", hooks)
    const mount = {
      userId,
      render: function HookHarness(nextId = mount.userId) {
        mount.userId = nextId
        cursor = 0
        effects = []
        const result = useBackgroundNotifications(nextId)
        for (const effect of effects) effect()
        return result
      },
      async settle() {
        for (let i = 0; i < 60; i++) await Promise.resolve()
      },
    }
    cleanups.push(() => {
      for (const slot of slots) slot?.cleanup?.()
    })
    mount.render()
    return mount
  }
  return state
}

test("enabling stores only a valid subscription and user ownership after the authenticated server accepts it", async (t) => {
  const browser = await clientHarness(t, { subscription: false })
  await browser.client.enableBackgroundNotifications("viewer", browser.config)
  assert.equal(browser.storage.get("dealhay:push-owner"), "viewer")
  assert.deepEqual(browser.operations, [
    "worker:viewer",
    "subscribe",
    "request:POST",
  ])
  assert.deepEqual(browser.requests[0].body, {
    endpoint: "https://push.test/subscription",
    keys: { p256dh: "public", auth: "secret" },
  })
})

test("restoring never enrolls another account or requests browser notification permission", async (t) => {
  const browser = await clientHarness(t, { owner: "previous-user" })
  assert.equal(
    await browser.client.restoreBackgroundNotifications(
      "viewer",
      browser.config
    ),
    false
  )
  assert.deepEqual(browser.operations, [])
})

test("server rejection rolls back browser delivery and worker ownership", async (t) => {
  const browser = await clientHarness(t, { subscription: false })
  browser.failPost = true
  await assert.rejects(
    browser.client.enableBackgroundNotifications("viewer", browser.config),
    /server offline/
  )
  assert.equal(browser.storage.has("dealhay:push-owner"), false)
  assert.equal(browser.subscription, null)
  assert.deepEqual(browser.operations.slice(-2), ["unsubscribe", "worker:none"])
})

test("logout revokes the endpoint even when the worker refuses its state update", async (t) => {
  const browser = await clientHarness(t, { owner: "viewer" })
  browser.failWorker = true
  await browser.client.clearBackgroundNotificationOwner("viewer")
  assert.equal(browser.subscription, null)
  assert.equal(browser.storage.has("dealhay:push-owner"), false)
  assert.ok(browser.operations.includes("unsubscribe"))
  assert.equal(browser.closedCards, 1)
  assert.equal(browser.requests[0].method, "DELETE")
})

test("logging out during the subscription POST cannot revive push ownership when its response arrives", async (t) => {
  const browser = await clientHarness(t, { subscription: false })
  let release
  browser.postGate = new Promise((resolve) => {
    release = resolve
  })
  const enable = browser.client.enableBackgroundNotifications(
    "viewer",
    browser.config
  )
  for (let i = 0; i < 20 && !browser.requests.length; i++)
    await Promise.resolve()
  assert.equal(browser.requests[0].method, "POST")
  await browser.client.clearBackgroundNotificationOwner("viewer")
  release()
  await assert.rejects(enable, /đã thay đổi/)
  assert.equal(browser.subscription, null)
  assert.equal(browser.storage.has("dealhay:push-owner"), false)
})

test("iPhone requires a Home Screen installation and feature detection accepts the installed app", async (t) => {
  const browser = await clientHarness(t)
  navigator.userAgent = "Mozilla iPhone"
  assert.equal(
    browser.client.backgroundNotificationAvailability().installRequired,
    true
  )
  assert.equal(
    browser.client.backgroundNotificationAvailability().supported,
    false
  )
  navigator.standalone = true
  assert.equal(
    browser.client.backgroundNotificationAvailability().installRequired,
    false
  )
  assert.equal(
    browser.client.backgroundNotificationAvailability().supported,
    true
  )
})

test("an offline logout still unsubscribes locally and clears notification ownership", async (t) => {
  const browser = await clientHarness(t, { owner: "viewer" })
  browser.failDelete = true
  await browser.client.clearBackgroundNotificationOwner("viewer")
  assert.equal(browser.subscription, null)
  assert.equal(browser.storage.has("dealhay:push-owner"), false)
  assert.ok(browser.operations.includes("worker:none"))
})

test("logout from another tab invalidates an enable POST already in flight", async (t) => {
  const browser = await clientHarness(t, { subscription: false })
  const anotherTab = await browser.forkTab()
  let release
  browser.postGate = new Promise((resolve) => {
    release = resolve
  })
  const enable = browser.client.enableBackgroundNotifications(
    "viewer",
    browser.config
  )
  for (let i = 0; i < 30 && !browser.requests.length; i++)
    await Promise.resolve()
  assert.equal(browser.requests[0].method, "POST")
  await anotherTab.clearBackgroundNotificationOwner("viewer")
  release()
  await assert.rejects(enable, /đã thay đổi/)
  assert.equal(browser.subscription, null)
  assert.equal(browser.storage.has("dealhay:push-owner"), false)
})

test("logout does not wait for a stalled subscribe operation holding a cross-tab lock", async (t) => {
  const browser = await clientHarness(t, { subscription: false, locks: true })
  let release
  browser.subscribeGate = new Promise((resolve) => {
    release = resolve
  })
  const enabled = browser.client.enableBackgroundNotifications(
    "viewer",
    browser.config
  )
  for (let i = 0; i < 60 && !browser.operations.includes("subscribe"); i++)
    await Promise.resolve()
  assert.ok(browser.operations.includes("subscribe"))
  await browser.client.clearBackgroundNotificationOwner("viewer")
  assert.equal(browser.storage.has("dealhay:push-owner"), false)
  assert.equal(browser.operations.at(-1), "worker:none")
  release()
  await assert.rejects(enabled, /đã thay đổi/)
  assert.equal(browser.subscription, null)
  assert.equal(browser.requests.length, 0)
})

for (const gate of ["registrationGate", "subscriptionGate"]) {
  test(`a delayed logout ${gate} cannot revoke a newly enabled account`, async (t) => {
    const browser = await clientHarness(t, { owner: "previous" })
    const anotherTab = await browser.forkTab()
    let release
    browser[gate] = new Promise((resolve) => {
      release = resolve
    })
    const logout = browser.client.clearBackgroundNotificationOwner("previous")
    // Let logout reach the asynchronous browser API before the new opt-in.
    for (let i = 0; i < 8; i++) await Promise.resolve()
    await anotherTab.enableBackgroundNotifications("current", browser.config)
    const currentEndpoint = browser.subscription
    release()
    await logout
    assert.equal(browser.storage.get("dealhay:push-owner"), "current")
    assert.equal(browser.subscription, currentEndpoint)
    assert.equal(browser.operations.at(-1), "request:POST")
  })
}

test("logout remains bounded when browser revocation, existing cards and server deletion stall", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const browser = await clientHarness(t, { owner: "viewer" })
  browser.unsubscribeGate = new Promise(() => {})
  browser.cardsGate = new Promise(() => {})
  browser.deleteGate = new Promise(() => {})
  let finished = false
  const logout = browser.client
    .clearBackgroundNotificationOwner("viewer")
    .then(() => {
      finished = true
    })
  for (let i = 0; i < 30; i++) await Promise.resolve()
  assert.ok(browser.operations.includes("unsubscribe"))
  t.mock.timers.tick(3000)
  await logout
  assert.equal(finished, true)
  assert.equal(browser.storage.has("dealhay:push-owner"), false)
})

test("a new account's explicit opt-in cannot be overwritten by an old tab's delayed enable", async (t) => {
  const browser = await clientHarness(t, { subscription: false })
  const anotherTab = await browser.forkTab()
  let release
  browser.postGate = new Promise((resolve) => {
    release = resolve
  })
  const previousEnable = browser.client.enableBackgroundNotifications(
    "previous",
    browser.config
  )
  for (let i = 0; i < 30 && !browser.requests.length; i++)
    await Promise.resolve()
  browser.postGate = null
  await anotherTab.enableBackgroundNotifications("current", browser.config)
  release()
  await assert.rejects(previousEnable, /đã thay đổi/)
  assert.equal(browser.storage.get("dealhay:push-owner"), "current")
  assert.notEqual(browser.subscription, null)
  assert.equal(browser.operations.at(-1), "request:POST")
  const currentEndpoint = browser.subscription
  await browser.client.clearBackgroundNotificationOwner("previous")
  assert.equal(browser.storage.get("dealhay:push-owner"), "current")
  assert.equal(browser.subscription, currentEndpoint)
})

test("a guest mount keeps an existing opt-in for background delivery after browser restart", async (t) => {
  const browser = await clientHarness(t, { owner: "viewer" })
  const hook = await browser.mountHook(undefined)
  await hook.settle()
  assert.equal(browser.storage.get("dealhay:push-owner"), "viewer")
  assert.deepEqual(browser.requests, [])
})

test("signing in as a different user clears the previous opt-in without enrolling the new account", async (t) => {
  const browser = await clientHarness(t, { owner: "previous" })
  const hook = await browser.mountHook("current")
  await hook.settle()
  assert.equal(browser.storage.has("dealhay:push-owner"), false)
  assert.equal(browser.subscription, null)
  assert.equal(hook.render().enabled, false)
  assert.ok(browser.requests.some((request) => request.method === "DELETE"))
  assert.ok(!browser.requests.some((request) => request.method === "POST"))
})

test("a delayed enable cannot flip the settings back on or show a stale error after disabling", async (t) => {
  const browser = await clientHarness(t, { subscription: false })
  const hook = await browser.mountHook("viewer")
  await hook.settle()
  let release
  browser.postGate = new Promise((resolve) => {
    release = resolve
  })
  const enabled = hook.render().enable()
  for (
    let i = 0;
    i < 60 && !browser.requests.some((request) => request.method === "POST");
    i++
  )
    await Promise.resolve()
  assert.ok(browser.requests.some((request) => request.method === "POST"))
  await hook.render().disable()
  release()
  assert.equal(await enabled, false)
  await hook.settle()
  const result = hook.render()
  assert.equal(result.enabled, false)
  assert.equal(result.loading, false)
  assert.equal(result.error, undefined)
})

test("notification permission starts synchronously from enable and is never requested during mounting", async (t) => {
  const browser = await clientHarness(t, {
    permission: "default",
    subscription: false,
  })
  let requested = false,
    grant
  Notification.requestPermission = () => {
    requested = true
    return new Promise((resolve) => {
      grant = () => {
        Notification.permission = "granted"
        resolve("granted")
      }
    })
  }
  const hook = await browser.mountHook("viewer")
  await hook.settle()
  assert.equal(requested, false)
  const enabled = hook.render().enable()
  assert.equal(requested, true)
  grant()
  assert.equal(await enabled, true)
  assert.equal(hook.render().enabled, true)
})
