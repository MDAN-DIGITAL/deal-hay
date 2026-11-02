/* The worker stores notification settings only. It never caches pages, tokens or API responses. */
const STATE_CACHE = "dealhay-notifications-v1"
const STATE_URL = new URL(
  "/__dealhay_notification_state__",
  self.location.origin
).href
let operations = Promise.resolve()

function ordered(work) {
  const result = operations.then(work, work)
  operations = result.catch(() => {})
  return result
}

async function readState() {
  const cache = await caches.open(STATE_CACHE)
  const response = await cache.match(STATE_URL)
  const state = response ? await response.json() : null
  return state && typeof state.ownerId === "string"
    ? {
        ownerId: state.ownerId,
        seen: Array.isArray(state.seen) ? state.seen.slice(-100) : [],
      }
    : { ownerId: null, seen: [] }
}

async function writeState(state) {
  const cache = await caches.open(STATE_CACHE)
  await cache.put(
    STATE_URL,
    new Response(JSON.stringify(state), {
      headers: { "Content-Type": "application/json" },
    })
  )
}

function safeUrl(value) {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    /[\s\\\x00-\x1f\x7f]/.test(value) ||
    value.startsWith("//")
  )
    return "/notifications"
  try {
    const url = new URL(value, self.location.origin)
    if (
      url.origin !== self.location.origin ||
      url.username ||
      url.password ||
      (!value.startsWith("/") && !value.startsWith(self.location.origin + "/"))
    )
      return "/notifications"
    return url.pathname + url.search + url.hash
  } catch {
    return "/notifications"
  }
}

function safeAvatar(value) {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    /[\s\\\x00-\x1f\x7f]/.test(value) ||
    value.startsWith("//")
  )
    return "/notification-icon-192.png"
  try {
    const url = new URL(value, self.location.origin)
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return "/notification-icon-192.png"
    return url.href
  } catch {
    return "/notification-icon-192.png"
  }
}

function normalize(payload) {
  if (!payload || typeof payload !== "object") return null
  const ownerId = payload.ownerId ?? payload.user_id
  if (
    typeof ownerId !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(ownerId) ||
    typeof payload.id !== "string" ||
    !/^(message|notification):[A-Za-z0-9_-]{1,128}$/.test(payload.id)
  )
    return null
  return {
    id: payload.id,
    ownerId,
    title:
      typeof payload.title === "string" && payload.title.trim()
        ? Array.from(payload.title.trim()).slice(0, 120).join("")
        : "Thông báo mới từ Deal Hay",
    body:
      typeof payload.body === "string"
        ? Array.from(payload.body.trim()).slice(0, 240).join("")
        : "Bạn có thông báo mới.",
    url: safeUrl(payload.url),
    avatar: safeAvatar(payload.avatar),
  }
}

async function show(payload, fromPush) {
  const notification = normalize(payload)
  if (!notification) return
  const state = await readState()
  if (state.ownerId !== notification.ownerId) return
  const windows = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  })
  const focused = windows.some(
    (client) => client.visibilityState === "visible" && client.focused
  )
  if (!fromPush && focused) return
  const tag = `dealhay:${notification.ownerId}:${notification.id}`
  const duplicate = state.seen.includes(tag)
  if (!fromPush && duplicate) return
  // A real Web Push must remain user visible (including while the app is open on Safari).
  // Repeat delivery replaces the same card silently instead of ringing twice.
  await self.registration.showNotification(notification.title, {
    body: notification.body,
    tag,
    icon: notification.avatar,
    badge: "/notification-badge.png",
    lang: "vi",
    silent: duplicate,
    renotify: !duplicate,
    data: { url: notification.url, ownerId: notification.ownerId },
  })
  if (!duplicate) {
    state.seen.push(tag)
    state.seen = state.seen.slice(-100)
    await writeState(state)
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  let payload
  try {
    payload = event.data?.json()
  } catch {
    return
  }
  event.waitUntil(ordered(() => show(payload, true)))
})

self.addEventListener("message", (event) => {
  if (
    !event.source ||
    new URL(event.source.url).origin !== self.location.origin
  )
    return
  const data = event.data
  if (!data || typeof data !== "object") return
  if (data.type === "dealhay:notification-owner") {
    event.waitUntil(
      ordered(async () => {
        const ownerId =
          typeof data.ownerId === "string" &&
          /^[A-Za-z0-9_-]{1,128}$/.test(data.ownerId)
            ? data.ownerId
            : null
        const state = await readState()
        await writeState({
          ownerId,
          seen: state.ownerId === ownerId ? state.seen : [],
        })
        if (state.ownerId !== ownerId) {
          const notifications = await self.registration.getNotifications()
          for (const notification of notifications) notification.close()
        }
      }).then(
        () => event.ports?.[0]?.postMessage({ ok: true }),
        () => event.ports?.[0]?.postMessage({ ok: false })
      )
    )
  } else if (data.type === "dealhay:show-notification") {
    event.waitUntil(
      ordered(() => show(data.notification, false)).then(
        () => event.ports?.[0]?.postMessage({ ok: true }),
        () => event.ports?.[0]?.postMessage({ ok: false })
      )
    )
  }
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(
    ordered(async () => {
      const state = await readState()
      if (!state.ownerId || event.notification.data?.ownerId !== state.ownerId)
        return
      const url = safeUrl(event.notification.data?.url)
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      const client = windows.find(
        (candidate) => new URL(candidate.url).origin === self.location.origin
      )
      if (client) {
        // Navigate even when the existing tab has not mounted its React listeners yet.
        await client.navigate(new URL(url, self.location.origin).href)
        await client.focus()
      } else {
        await self.clients.openWindow(new URL(url, self.location.origin).href)
      }
    })
  )
})
