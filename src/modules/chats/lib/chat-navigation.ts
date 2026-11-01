import type { SelectedConversation } from "@/types/chat"

export const CHAT_NAVIGATION_EVENT = "dealhay:chat-navigation"

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
  target: ChatNavigationTarget
): SelectedConversation | undefined {
  if (target.conversationId) return conversations.get(target.conversationId)
  return [...conversations.values()].find(
    ({ slug }) => slug === target.conversationSlug
  )
}

/** Keep cached chat and drafts mounted, including repeated clicks on one toast. */
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
  } else push(localHref)
}
