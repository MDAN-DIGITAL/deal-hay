function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function identifier(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value)
    ? value
    : undefined
}

/** Conversation IDs come from realtime messages, without needing a slug lookup. */
export function chatToastHref(payload: unknown): string | null {
  const item = record(payload)
  const data = record(item.data)
  const conversationId =
    identifier(item.conversation_id) ?? identifier(data.conversation_id)
  if (!conversationId) return null
  const params = new URLSearchParams({ conversation: conversationId })
  const messageId = identifier(item.message_id) ?? identifier(data.message_id)
  if (messageId) params.set("message", messageId)
  return `/chats?${params}`
}

/** Business notices can open their own page; chat notices open the exact thread. */
export function notificationToastHref(
  payload: unknown,
  origin: string
): string | null {
  const chat = chatToastHref(payload)
  if (chat) return chat
  const item = record(payload)
  const data = record(item.data)
  const action = item.action_url ?? data.action_url
  if (
    typeof action !== "string" ||
    !action ||
    action.trim() !== action ||
    /[\\\u0000-\u0020\u007f]/.test(action) ||
    action.startsWith("//")
  )
    return null
  try {
    const base = new URL(origin)
    const destination = new URL(action, base)
    if (
      !/^https?:$/.test(destination.protocol) ||
      destination.origin !== base.origin ||
      destination.username ||
      destination.password ||
      !(action.startsWith("/") || /^https?:\/\//.test(action))
    )
      return null
    if (/^\/notifications(?:\/|$)/.test(destination.pathname)) return null
    if (
      destination.pathname === "/" &&
      destination.searchParams.get("notifications") === "open"
    )
      return null
    if (destination.pathname === "/shop/manage")
      destination.pathname = "/shop-manage"
    if (/^\/admin\/tickets\/[^/]+$/.test(destination.pathname))
      destination.pathname = "/admin/tickets"
    return `${destination.pathname}${destination.search}${destination.hash}`
  } catch {
    return null
  }
}

export function toastAvatar(
  payload: unknown,
  fallbackName: string
): { name: string; src: string | null } {
  const item = record(payload)
  const data = record(item.data)
  const sender = record(item.sender ?? data.sender)
  const name =
    typeof sender.name === "string" && sender.name.trim()
      ? Array.from(sender.name.trim()).slice(0, 160).join("")
      : fallbackName
  const avatar = sender.avatar_url ?? item.avatar_url ?? data.avatar_url
  const src =
    typeof avatar === "string" &&
    avatar.length <= 2048 &&
    /^(https?:\/\/|\/(?!\/))/.test(avatar) &&
    !/[\\\u0000-\u0020\u007f]/.test(avatar)
      ? avatar
      : null
  return { name, src }
}
