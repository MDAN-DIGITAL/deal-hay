import type { ChatMessage } from "@/types/chat"

export type ChatScrollPosition = {
  scrollTop: number
  atBottom: boolean
  firstRenderedMessageId: string | null
}

export const CHAT_MESSAGE_RENDER_WINDOW = 150

/** Reveal an older toast/reply target directly from the already downloaded history. */
export function chatMessageStartForTarget(
  messages: ChatMessage[],
  targetId: string,
  currentStartId: string | null
): string | null {
  const targetIndex = messages.findIndex(({ id }) => id === targetId)
  const startIndex = Math.max(
    0,
    messages.findIndex(({ id }) => id === currentStartId)
  )
  return targetIndex >= 0 && targetIndex < startIndex
    ? messages[Math.max(0, targetIndex - 10)].id
    : currentStartId
}

/** Keep all history cached while only mounting a useful initial part of a long thread. */
export function initialChatMessageStart(
  messages: ChatMessage[],
  saved?: ChatScrollPosition
): string | null {
  if (
    saved?.firstRenderedMessageId &&
    messages.some(({ id }) => id === saved.firstRenderedMessageId)
  )
    return saved.firstRenderedMessageId
  return (
    messages[Math.max(0, messages.length - CHAT_MESSAGE_RENDER_WINDOW)]?.id ??
    null
  )
}
