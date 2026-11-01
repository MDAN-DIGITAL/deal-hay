import type {
  ChatsResponse,
  ChatMessagesReadEvent,
  ChatHistoryResponse,
} from "@/api/chats/types"
import type {
  ChatMessage,
  ConversationSummary,
  SelectedConversation,
} from "@/types/chat"

export type ChatState = ChatsResponse & {
  viewerId?: string
  conversationCache: ReadonlyMap<string, SelectedConversation>
  messageIds: ReadonlySet<string>
  knownMessages: ReadonlyMap<string, ChatMessage>
  readReceipts: ReadonlyMap<string, ChatMessagesReadEvent>
}

export function createChatState(
  data: ChatsResponse,
  viewerId?: string
): ChatState {
  const snapshots = new Map(
    (data.conversationSnapshots ?? []).map((conversation) => [
      conversation.id,
      conversation,
    ])
  )
  if (data.selectedConversation)
    snapshots.set(data.selectedConversation.id, data.selectedConversation)
  const messages = [...snapshots.values()].flatMap(({ messages }) => messages)
  return {
    ...data,
    viewerId,
    conversationCache: snapshots,
    messageIds: new Set(messages.map(({ id }) => id)),
    knownMessages: new Map(messages.map((message) => [message.id, message])),
    readReceipts: new Map(),
  }
}

/** Selection only reads the preloaded cache; it never requests a new history. */
export function selectChatConversation(
  state: ChatState,
  slug?: string
): ChatState {
  const cached = [...state.conversationCache.values()].find(
    (item) => item.slug === slug
  )
  const summary = state.conversations.find((item) => item.slug === slug)
  return {
    ...state,
    selectedConversation: cached
      ? {
          ...cached,
          ...summary,
          messages: cached.messages.map(
            (message) => state.knownMessages.get(message.id) ?? message
          ),
        }
      : null,
  }
}

export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const messages = new Map(current.map((message) => [message.id, message]))
  for (const message of incoming) {
    const previous = messages.get(message.id)
    messages.set(message.id, {
      ...previous,
      ...message,
      read_at: message.read_at ?? previous?.read_at ?? null,
      ...(message.viewer_read_at !== undefined ||
      previous?.viewer_read_at !== undefined
        ? {
            viewer_read_at:
              message.viewer_read_at ?? previous?.viewer_read_at ?? null,
          }
        : {}),
    })
  }
  return [...messages.values()].sort(
    (a, b) =>
      (a.created_at ?? "").localeCompare(b.created_at ?? "") ||
      a.id.localeCompare(b.id)
  )
}

export function receiveChatMessage(
  state: ChatState,
  message: ChatMessage,
  currentUserId: string
): ChatState {
  if (state.messageIds.has(message.id)) return state

  for (const receipt of state.readReceipts.values()) {
    if (
      receipt.conversation_id === message.conversation_id &&
      receipt.reader_id !== message.sender.id &&
      message.created_at &&
      message.created_at <= receipt.read_through_at
    ) {
      message = {
        ...message,
        read_at: message.read_at ?? receipt.read_at,
        viewer_read_at:
          receipt.reader_id === currentUserId
            ? (message.viewer_read_at ?? receipt.read_at)
            : (message.viewer_read_at ?? null),
      }
    }
  }

  const update = <T extends ConversationSummary>(conversation: T): T => {
    if (conversation.id !== message.conversation_id) return conversation
    const isLatest =
      (message.created_at ?? "") >= (conversation.updated_at ?? "")
    const participants = message.mentions?.length
      ? [
          ...new Map([
            ...(conversation.participants ?? []).map(
              (person) => [person.id, person] as const
            ),
            ...message.mentions.map(
              (admin) => [admin.id, { ...admin, is_admin: true }] as const
            ),
          ]).values(),
        ]
      : conversation.participants
    return {
      ...conversation,
      ...(participants ? { participants } : {}),
      ...(isLatest
        ? { last_message: message.body, updated_at: message.created_at }
        : {}),
      unread_count:
        conversation.unread_count +
        (message.sender.id !== currentUserId && !message.viewer_read_at
          ? 1
          : 0),
    }
  }
  const conversations = state.conversations
    .map(update)
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
  const selected = state.selectedConversation
  const cache = new Map(state.conversationCache)
  const cached = cache.get(message.conversation_id)
  if (cached)
    cache.set(cached.id, {
      ...update(cached),
      messages: mergeMessages(cached.messages, [message]),
    })

  return {
    ...state,
    viewerId: currentUserId,
    conversations,
    conversationCache: cache,
    selectedConversation:
      selected?.id === message.conversation_id
        ? {
            ...update(selected),
            messages: mergeMessages(selected.messages, [message]),
          }
        : selected,
    messageIds: new Set([...state.messageIds, message.id]),
    knownMessages: new Map([...state.knownMessages, [message.id, message]]),
  }
}

export function receiveReadReceipt(
  state: ChatState,
  event: ChatMessagesReadEvent,
  currentUserId: string
): ChatState {
  const cleared = event.reader_id === currentUserId
  const receiptKey = `${event.conversation_id}:${event.reader_id}`
  const previous = state.readReceipts.get(receiptKey)
  if (previous && previous.read_through_at > event.read_through_at) return state
  const ids = new Set(event.message_ids)
  const knownMessages = new Map(state.knownMessages)
  let newlyRead = 0
  for (const [id, message] of knownMessages) {
    if (
      message.conversation_id === event.conversation_id &&
      message.sender.id !== event.reader_id &&
      (ids.has(id) ||
        (message.created_at && message.created_at <= event.read_through_at))
    ) {
      const viewerReadAt =
        message.viewer_read_at === undefined
          ? message.read_at
          : message.viewer_read_at
      if (cleared && !viewerReadAt && message.sender.id !== currentUserId)
        newlyRead += 1
      knownMessages.set(id, {
        ...message,
        read_at: message.read_at ?? event.read_at,
        viewer_read_at: cleared
          ? (viewerReadAt ?? event.read_at)
          : viewerReadAt,
      })
    }
  }
  const update = <T extends ConversationSummary>(conversation: T): T => {
    if (!cleared || conversation.id !== event.conversation_id)
      return conversation
    return {
      ...conversation,
      unread_count:
        (conversation.updated_at ?? "") <= event.read_through_at
          ? 0
          : Math.max(0, conversation.unread_count - newlyRead),
    }
  }
  const conversations = state.conversations.map(update)
  const selected = state.selectedConversation
  return {
    ...state,
    viewerId: currentUserId,
    conversations,
    knownMessages,
    conversationCache: new Map(
      [...state.conversationCache].map(([id, conversation]) => [
        id,
        {
          ...update(conversation),
          messages: conversation.messages.map(
            (message) => knownMessages.get(message.id) ?? message
          ),
        },
      ])
    ),
    readReceipts: new Map([...state.readReceipts, [receiptKey, event]]),
    selectedConversation:
      selected?.id === event.conversation_id
        ? {
            ...update(selected),
            messages: selected.messages.map(
              (message) => knownMessages.get(message.id) ?? message
            ),
          }
        : selected,
  }
}

export function reconcileChatState(
  state: ChatState,
  snapshot: ChatsResponse,
  changedSinceSnapshot: ReadonlySet<string> = new Set()
): ChatState {
  const current = new Map(
    state.conversations.map((conversation) => [conversation.id, conversation])
  )
  const conversations = snapshot.conversations.map((conversation) => {
    const previous = current.get(conversation.id)
    current.delete(conversation.id)
    return previous &&
      (changedSinceSnapshot.has(conversation.id) ||
        (previous.updated_at ?? "") > (conversation.updated_at ?? ""))
      ? previous
      : conversation
  })
  const fullSnapshot = Array.isArray(snapshot.conversationSnapshots)
  if (!fullSnapshot) conversations.push(...current.values())
  conversations.sort((a, b) =>
    (b.updated_at ?? "").localeCompare(a.updated_at ?? "")
  )
  const previous = state.selectedConversation
  const snapshots = new Map(
    (snapshot.conversationSnapshots ?? []).map((conversation) => [
      conversation.id,
      conversation,
    ])
  )
  if (snapshot.selectedConversation)
    snapshots.set(
      snapshot.selectedConversation.id,
      snapshot.selectedConversation
    )
  const allowed = new Set(conversations.map(({ id }) => id))
  const cache = new Map(
    [...state.conversationCache].filter(
      ([id]) => !fullSnapshot || allowed.has(id)
    )
  )
  const knownMessages = new Map(
    [...state.knownMessages].filter(
      ([, message]) => !fullSnapshot || allowed.has(message.conversation_id)
    )
  )
  for (const [id, selected] of snapshots) {
    const cached = cache.get(id)
    const hasOverlap = selected.messages.some(({ id }) =>
      state.messageIds.has(id)
    )
    let messages = mergeMessages(cached?.messages ?? [], selected.messages)
    for (const receipt of state.readReceipts.values()) {
      const ids = new Set(receipt.message_ids)
      messages = messages.map((message) =>
        ids.has(message.id)
          ? {
              ...message,
              read_at: message.read_at ?? receipt.read_at,
              ...(receipt.reader_id === state.viewerId
                ? { viewer_read_at: message.viewer_read_at ?? receipt.read_at }
                : {}),
            }
          : message
      )
    }
    for (const message of messages) knownMessages.set(message.id, message)
    cache.set(id, {
      ...selected,
      ...conversations.find((conversation) => conversation.id === id),
      counterpart: {
        ...selected.counterpart,
        is_online:
          cached?.counterpart.is_online ?? selected.counterpart.is_online,
      },
      messages,
      messages_pagination:
        hasOverlap &&
        cached &&
        cached.messages.length > selected.messages.length
          ? cached.messages_pagination
          : selected.messages_pagination,
    })
  }
  const selectedId = previous?.id ?? snapshot.selectedConversation?.id
  return {
    ...state,
    admins: snapshot.admins ?? state.admins,
    conversations,
    conversationCache: cache,
    selectedConversation: selectedId
      ? (cache.get(selectedId) ?? (fullSnapshot ? null : previous))
      : null,
    readReceipts: new Map(
      [...state.readReceipts].filter(
        ([, receipt]) => !fullSnapshot || allowed.has(receipt.conversation_id)
      )
    ),
    messageIds: new Set(knownMessages.keys()),
    knownMessages,
  }
}

/** A delayed history response belongs to its original thread, even after selection changes. */
export function receiveChatHistory(
  state: ChatState,
  conversationId: string,
  history: ChatHistoryResponse
): ChatState {
  const cached = state.conversationCache.get(conversationId)
  if (!cached) return state
  const conversation = {
    ...cached,
    messages: mergeMessages(cached.messages, history.messages),
    messages_pagination: {
      has_more: history.has_more,
      next_cursor: history.next_cursor,
    },
  }
  return {
    ...state,
    conversationCache: new Map([
      ...state.conversationCache,
      [conversationId, conversation],
    ]),
    selectedConversation:
      state.selectedConversation?.id === conversationId
        ? conversation
        : state.selectedConversation,
    messageIds: new Set([
      ...state.messageIds,
      ...history.messages.map(({ id }) => id),
    ]),
    knownMessages: new Map([
      ...state.knownMessages,
      ...history.messages.map((message) => [message.id, message] as const),
    ]),
  }
}

/** HTTP read success also updates this viewer when their websocket receipt is delayed. */
export function markChatConversationRead(
  state: ChatState,
  conversationId: string,
  currentUserId: string,
  readAt: string
): ChatState {
  const knownMessages = new Map(state.knownMessages)
  for (const [id, message] of knownMessages) {
    if (
      message.conversation_id === conversationId &&
      message.sender.id !== currentUserId
    )
      knownMessages.set(id, {
        ...message,
        viewer_read_at: message.viewer_read_at ?? readAt,
        read_at: message.read_at ?? readAt,
      })
  }
  const update = (conversation: SelectedConversation): SelectedConversation =>
    conversation.id === conversationId
      ? {
          ...conversation,
          unread_count: 0,
          messages: conversation.messages.map(
            (message) => knownMessages.get(message.id) ?? message
          ),
        }
      : conversation
  return {
    ...state,
    viewerId: currentUserId,
    knownMessages,
    conversations: state.conversations.map((conversation) =>
      conversation.id === conversationId
        ? { ...conversation, unread_count: 0 }
        : conversation
    ),
    conversationCache: new Map(
      [...state.conversationCache].map(([id, conversation]) => [
        id,
        update(conversation),
      ])
    ),
    selectedConversation: state.selectedConversation
      ? update(state.selectedConversation)
      : null,
  }
}
