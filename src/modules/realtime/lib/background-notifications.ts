import { wssFetch } from "@/api/wss-client"

export const BACKGROUND_NOTIFICATIONS_CHANGED =
  "dealhay:background-notifications"
const OWNER_KEY = "dealhay:push-owner"
const MUTATION_KEY = "dealhay:push-mutation"
const MUTATION_LOCK = "dealhay:push-subscription"
const WORKER_URL = "/notification-worker.js"

export type PushConfig = { enabled: boolean; publicKey: string | null }
export type BackgroundNotification = {
  id: string
  ownerId: string
  title: string
  body: string
  url: string
  avatar?: string | null
}

export function backgroundNotificationAvailability() {
  if (typeof window === "undefined")
    return {
      supported: false,
      installRequired: false,
      permission: "unsupported" as const,
    }
  const appleMobile =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  const installRequired = appleMobile && !standalone
  const permission =
    "Notification" in window
      ? Notification.permission
      : ("unsupported" as const)
  return {
    supported:
      window.isSecureContext &&
      !installRequired &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      permission !== "unsupported",
    installRequired,
    permission,
  }
}

export function backgroundNotificationOwner(): string | null {
  try {
    return window.localStorage.getItem(OWNER_KEY)
  } catch {
    return null
  }
}

function saveOwner(ownerId: string | null) {
  if (ownerId) window.localStorage.setItem(OWNER_KEY, ownerId)
  else window.localStorage.removeItem(OWNER_KEY)
  window.dispatchEvent(new Event(BACKGROUND_NOTIFICATIONS_CHANGED))
}

function currentMutation(): { id: string; ownerId: string | null } | null {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(MUTATION_KEY) ?? "null"
    )
    return value && typeof value.id === "string" ? value : null
  } catch {
    return null
  }
}

export function backgroundNotificationPendingOwner(): string | null {
  return currentMutation()?.ownerId ?? null
}

function beginMutation(ownerId: string | null) {
  const id = crypto.randomUUID()
  window.localStorage.setItem(MUTATION_KEY, JSON.stringify({ id, ownerId }))
  return id
}

function finishMutation(id: string) {
  if (currentMutation()?.id === id)
    window.localStorage.setItem(
      MUTATION_KEY,
      JSON.stringify({ id, ownerId: null })
    )
}

async function subscriptionLock<T>(work: () => Promise<T>): Promise<T> {
  return navigator.locks?.request
    ? navigator.locks.request(MUTATION_LOCK, work)
    : work()
}

async function bounded<T>(
  promise: Promise<T>,
  milliseconds: number
): Promise<T> {
  let timer: number | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(
          () =>
            reject(new Error("Thông báo nền chưa phản hồi. Vui lòng thử lại.")),
          milliseconds
        )
      }),
    ])
  } finally {
    window.clearTimeout(timer)
  }
}

let registrationPromise: Promise<ServiceWorkerRegistration> | undefined
let mutationVersion = 0
export function notificationWorker(): Promise<ServiceWorkerRegistration> {
  if (!registrationPromise)
    registrationPromise = bounded(
      navigator.serviceWorker
        .register(WORKER_URL, {
          scope: "/",
          updateViaCache: "none",
        })
        .then(() => navigator.serviceWorker.ready),
      10000
    ).catch((error) => {
      registrationPromise = undefined
      throw error
    })
  return registrationPromise
}

async function sendWorkerMessage(
  registration: ServiceWorkerRegistration,
  message: unknown
) {
  const worker = registration.active
  if (!worker) throw new Error("Thông báo nền chưa sẵn sàng. Vui lòng thử lại.")
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel()
    const timer = window.setTimeout(() => {
      channel.port1.close()
      reject(new Error("Không thể kết nối thông báo nền. Vui lòng thử lại."))
    }, 5000)
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timer)
      channel.port1.close()
      if (event.data?.ok) resolve()
      else reject(new Error("Không thể lưu cài đặt thông báo nền."))
    }
    worker.postMessage(message, [channel.port2])
  })
}

export async function loadPushConfig(): Promise<PushConfig> {
  const config = await bounded(
    wssFetch<PushConfig>({
      path: "/push/config",
      signal: AbortSignal.timeout(10000),
    }),
    10000
  )
  return {
    enabled:
      config.enabled === true &&
      typeof config.publicKey === "string" &&
      config.publicKey.length > 0,
    publicKey: typeof config.publicKey === "string" ? config.publicKey : null,
  }
}

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
  const bytes = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(bytes, (byte) => byte.charCodeAt(0))
}

async function persistSubscription(subscription: PushSubscription) {
  const serialized = subscription.toJSON()
  if (
    !serialized.endpoint ||
    !serialized.keys?.p256dh ||
    !serialized.keys?.auth
  )
    throw new Error("Trình duyệt không cung cấp đăng ký thông báo hợp lệ.")
  await bounded(
    wssFetch({
      path: "/push/subscriptions",
      method: "POST",
      signal: AbortSignal.timeout(10000),
      body: {
        endpoint: serialized.endpoint,
        keys: { p256dh: serialized.keys.p256dh, auth: serialized.keys.auth },
      },
    }),
    10000
  )
}

/** Reconcile only an explicitly enabled owner; opening another account never opts it in. */
export async function restoreBackgroundNotifications(
  ownerId: string,
  config: PushConfig
): Promise<boolean> {
  const version = mutationVersion
  const mutation = currentMutation()?.id
  if (
    backgroundNotificationOwner() !== ownerId ||
    Notification.permission !== "granted"
  )
    return false
  return subscriptionLock(async () => {
    const current = () =>
      version === mutationVersion &&
      mutation === currentMutation()?.id &&
      backgroundNotificationOwner() === ownerId
    if (!current()) return false
    const registration = await notificationWorker()
    const subscription = await bounded(
      registration.pushManager.getSubscription(),
      2000
    )
    if (!current()) return false
    if (!subscription) {
      beginMutation(null)
      saveOwner(null)
      await sendWorkerMessage(registration, {
        type: "dealhay:notification-owner",
        ownerId: null,
      })
      return false
    }
    if (!config.enabled) return false
    await sendWorkerMessage(registration, {
      type: "dealhay:notification-owner",
      ownerId,
    })
    if (!current()) return false
    await persistSubscription(subscription)
    return current()
  })
}

/** Call after requestPermission was started synchronously by a user click. */
export async function enableBackgroundNotifications(
  ownerId: string,
  config: PushConfig,
  isCurrent = () => true
): Promise<void> {
  if (!config.enabled || !config.publicKey)
    throw new Error("Máy chủ chưa bật thông báo nền.")
  const publicKey = config.publicKey
  if (Notification.permission !== "granted")
    throw new Error("Hãy cho phép thông báo trong cài đặt trình duyệt.")
  const version = ++mutationVersion
  const mutation = beginMutation(ownerId)
  const ensureCurrent = () => {
    if (
      version !== mutationVersion ||
      mutation !== currentMutation()?.id ||
      !isCurrent()
    )
      throw new Error("Cài đặt thông báo đã thay đổi.")
  }
  return subscriptionLock(async () => {
    let registration: ServiceWorkerRegistration | undefined
    let subscription: PushSubscription | null = null
    try {
      ensureCurrent()
      registration = await notificationWorker()
      ensureCurrent()
      subscription = await bounded(
        registration.pushManager.getSubscription(),
        2000
      )
      ensureCurrent()
      const key = applicationServerKey(publicKey)
      const previousKey = subscription?.options?.applicationServerKey
      const sameKey =
        previousKey &&
        new Uint8Array(previousKey).every((byte, i) => byte === key[i]) &&
        previousKey.byteLength === key.byteLength
      if (
        subscription &&
        (backgroundNotificationOwner() !== ownerId || !sameKey)
      ) {
        await bounded(subscription.unsubscribe(), 2000)
        subscription = null
        ensureCurrent()
      }
      // Persist the account binding before the server can deliver its first push.
      await sendWorkerMessage(registration, {
        type: "dealhay:notification-owner",
        ownerId,
      })
      ensureCurrent()
      if (!subscription) {
        const subscribed = registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        })
        // subscribe() has no AbortSignal; revoke a late result after timeout/logout.
        let expired = false
        void subscribed
          .then((created) => {
            if (
              expired ||
              version !== mutationVersion ||
              mutation !== currentMutation()?.id ||
              !isCurrent()
            )
              return created.unsubscribe()
          })
          .catch(() => {})
        try {
          subscription = await bounded(subscribed, 10000)
        } catch (error) {
          expired = true
          throw error
        }
      }
      if (
        version !== mutationVersion ||
        mutation !== currentMutation()?.id ||
        !isCurrent()
      ) {
        await bounded(subscription.unsubscribe(), 2000)
        ensureCurrent()
      }
      await persistSubscription(subscription)
      ensureCurrent()
      saveOwner(ownerId)
      finishMutation(mutation)
    } catch (error) {
      if (version === mutationVersion && mutation === currentMutation()?.id) {
        if (subscription)
          await bounded(subscription.unsubscribe(), 2000).catch(() => false)
        if (registration)
          await sendWorkerMessage(registration, {
            type: "dealhay:notification-owner",
            ownerId: null,
          }).catch(() => {})
        saveOwner(null)
        finishMutation(mutation)
      }
      throw error
    }
  })
}

/** Run before clearing login credentials. Local unsubscription also protects an offline logout. */
export async function clearBackgroundNotificationOwner(
  ownerId?: string
): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
  if (
    ownerId &&
    backgroundNotificationOwner() !== ownerId &&
    backgroundNotificationPendingOwner() !== ownerId
  )
    return
  ++mutationVersion
  const mutation = beginMutation(null)
  saveOwner(null)
  // A permission/subscribe operation can remain pending in another tab. Revocation
  // must proceed immediately; the shared mutation invalidates any late result.
  if (mutation !== currentMutation()?.id) return
  const registration = await bounded(
    navigator.serviceWorker.getRegistration(WORKER_URL),
    2000
  )
  if (!registration || mutation !== currentMutation()?.id) return
  const subscription = await bounded(
    registration.pushManager.getSubscription(),
    2000
  )
  if (mutation !== currentMutation()?.id) return
  const clearWorker = sendWorkerMessage(registration, {
    type: "dealhay:notification-owner",
    ownerId: null,
  })
  const removal = subscription
    ? bounded(
        wssFetch({
          path: "/push/subscriptions",
          method: "DELETE",
          signal: AbortSignal.timeout(3000),
          body: { endpoint: subscription.endpoint },
        }),
        3000
      ).catch(() => {})
    : Promise.resolve()
  // Never wait on the network before revoking the browser's delivery endpoint.
  const local = await Promise.allSettled([
    clearWorker,
    subscription
      ? bounded(subscription.unsubscribe(), 2000)
      : Promise.resolve(),
    bounded(
      registration.getNotifications?.().then((notifications) => {
        if (mutation !== currentMutation()?.id) return
        for (const notification of notifications) notification.close()
      }) ?? Promise.resolve(),
      2000
    ),
  ])
  await removal
  if (local.slice(0, 2).every((result) => result.status === "rejected"))
    throw new Error(
      "Không thể thu hồi thông báo trên thiết bị này. Vui lòng tắt quyền thông báo trong trình duyệt."
    )
}

/** Socket fallback while a tab is alive; Web Push handles suspended/closed tabs. */
export async function showBackgroundNotification(
  notification: BackgroundNotification
): Promise<void> {
  if (
    typeof window === "undefined" ||
    document.visibilityState === "visible" ||
    !backgroundNotificationAvailability().supported ||
    Notification.permission !== "granted" ||
    backgroundNotificationOwner() !== notification.ownerId
  )
    return
  const registration = await notificationWorker()
  await sendWorkerMessage(registration, {
    type: "dealhay:show-notification",
    notification,
  })
}
