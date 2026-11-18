import type { SelectedConversation, ConversationAlias } from "@/types/chat"
import { getSessionId } from "@/lib/session"

export const CHAT_NAVIGATION_EVENT = "dealhay:chat-navigation"

type ReservedChatPage = {
  navigate: (href: string) => boolean
  close: () => void
}

function chatHref(href: string): string | null {
  try {
    const destination = new URL(href, window.location.origin)
    if (
      destination.origin !== window.location.origin ||
      !parseChatNavigationTarget(destination.pathname, destination.search)
    )
      return null
    return `${destination.pathname}${destination.search}${destination.hash}`
  } catch {
    return null
  }
}

/** Reserve during the click gesture, before awaiting conversation creation. */
export function reserveChatPage(): ReservedChatPage | null {
  if (typeof window === "undefined") return null
  const account = getSessionId()
  let page: Window | null
  try {
    page = window.open("about:blank", "_blank")
  } catch {
    return null
  }
  if (!page) return null
  try {
    page.opener = null
  } catch {
    page.close()
    return null
  }
  let settled = false
  const close = () => {
    if (settled) return
    settled = true
    page.close()
  }
  return {
    close,
    navigate(href) {
      const destination = chatHref(href)
      if (settled || page.closed) return false
      if (!destination || getSessionId() !== account) {
        close()
        return false
      }
      try {
        page.location.replace(destination)
        settled = true
        return true
      } catch {
        close()
        return false
      }
    },
  }
}

export function openChatPage(href: string): boolean {
  if (typeof window === "undefined" || !chatHref(href)) return false
  return reserveChatPage()?.navigate(href) ?? false
}

export type ChatNavigationTarget = {
  conversationId?: string
  conversationSlug?: string
  messageId?: string
}

const identifier = (value: string | null) =>
  value && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : undefined

/** Toast links identify a thread by its stable ID, without fetching its slug. */
export function parseChatNavigationTarget(
  pathname: string,
  search = ""
): ChatNavigationTarget | null {
  if (pathname !== "/chats" && !pathname.startsWith("/chats/")) return null
  const params = new URLSearchParams(search)
  const conversationId = identifier(params.get("conversation"))
  let conversationSlug: string | undefined
  if (pathname.startsWith("/chats/")) {
    try {
      const slug = decodeURIComponent(pathname.slice(7))
      if (slug && slug.length <= 255 && !slug.includes("/"))
        conversationSlug = slug
    } catch {
      // A malformed URL cannot select another cached conversation.
    }
  }
  return {
    conversationId,
    conversationSlug,
    messageId:
      conversationId || conversationSlug
        ? identifier(params.get("message"))
        : undefined,
  }
}

export function resolveChatNavigationTarget(
  conversations: ReadonlyMap<string, SelectedConversation>,
  target: ChatNavigationTarget,
  aliases: readonly ConversationAlias[] = []
): SelectedConversation | undefined {
  const alias = aliases.find((item) =>
    target.conversationId
      ? item.id === target.conversationId
      : item.slug === target.conversationSlug
  )
  if (alias) return conversations.get(alias.target_id)
  if (target.conversationId) return conversations.get(target.conversationId)
  return [...conversations.values()].find(
    ({ slug }) => slug === target.conversationSlug
  )
}

/** Reuse chat history in the chat tab; open a separate authenticated tab elsewhere. */
export function navigateToChat(
  href: string,
  push: (href: string) => void
): void {
  if (typeof window === "undefined") {
    push(href)
    return
  }
  let destination: URL
  try {
    destination = new URL(href, window.location.origin)
  } catch {
    return
  }
  if (
    destination.origin !== window.location.origin ||
    !parseChatNavigationTarget(destination.pathname, destination.search)
  )
    return
  const localHref = `${destination.pathname}${destination.search}${destination.hash}`
  if (parseChatNavigationTarget(window.location.pathname)) {
    if (
      `${window.location.pathname}${window.location.search}${window.location.hash}` !==
      localHref
    )
      window.history.pushState(null, "", localHref)
    window.dispatchEvent(new Event(CHAT_NAVIGATION_EVENT))
  } else openChatPage(localHref)
}
