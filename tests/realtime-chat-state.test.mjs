import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import ts from "typescript"

const { outputText } = ts.transpileModule(
  readFileSync(
    new URL("../src/modules/chats/lib/chat-state.ts", import.meta.url),
    "utf8"
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
)
const {
  createChatState,
  mergeMessages,
  receiveChatMessage,
  receiveReadReceipt,
  reconcileChatState,
  selectChatConversation,
  receiveChatHistory,
  markChatConversationRead,
} = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
)

const currentUserId = "buyer-1"
const conversationId = "conversation-1"
const counterpartId = "shop-owner-1"
const timestamp = (minute) =>
  new Date(Date.UTC(2026, 9, 15, 3, minute)).toISOString()

function message(id, minute, overrides = {}) {
  return {
    id,
    conversation_id: conversationId,
    client_message_id: `client-${id}`,
    body: `Message ${id}`,
    read_at: null,
    attachment: null,
    product: null,
    sender: { id: counterpartId, name: "Test Shop", avatar_url: null },
    created_at: timestamp(minute),
    ...overrides,
  }
}

function summary(overrides = {}) {
  return {
    id: conversationId,
    slug: "test-shop-va-test-buyer",
    counterpart: {
      id: counterpartId,
      name: "Test Shop",
      avatar_url: null,
      is_online: true,
      is_shop: true,
    },
    last_message: "Earlier message",
    unread_count: 0,
    updated_at: timestamp(0),
    ...overrides,
  }
}

function snapshot({
  messages = [],
  conversation = summary(),
  otherConversations = [],
  pagination,
} = {}) {
  return {
    conversations: [conversation, ...otherConversations],
    selectedConversation: {
      ...conversation,
      messages,
      messages_pagination: pagination ?? { has_more: false, next_cursor: null },
    },
  }
}

function receipt(
  messages,
  { readerId = currentUserId, throughMinute = 1, readMinute = 5 } = {}
) {
  return {
    conversation_id: conversationId,
    reader_id: readerId,
    message_ids: messages.map(({ id }) => id),
    read_at: timestamp(readMinute),
    read_through_at: timestamp(throughMinute),
  }
}

test("a socket message appears immediately and moves its conversation to the top", () => {
  const olderState = createChatState(
    snapshot({
      otherConversations: [
        summary({ id: "conversation-2", updated_at: timestamp(1) }),
      ],
    })
  )
  const incoming = message("m1", 2)

  const state = receiveChatMessage(olderState, incoming, currentUserId)

  assert.deepEqual(state.selectedConversation.messages, [incoming])
  assert.equal(state.selectedConversation.unread_count, 1)
  assert.equal(state.conversations[0].id, conversationId)
  assert.equal(state.conversations[0].last_message, incoming.body)
  assert.equal(state.conversations[0].updated_at, incoming.created_at)
  assert.equal(state.conversations[0].unread_count, 1)
  assert.deepEqual(olderState.selectedConversation.messages, [])
})

test("duplicate socket events and an HTTP response do not duplicate a message or its unread count", () => {
  const incoming = message("m1", 1)
  const state = receiveChatMessage(
    createChatState(snapshot()),
    incoming,
    currentUserId
  )
  const duplicate = receiveChatMessage(
    state,
    { ...incoming, replayed: true },
    currentUserId
  )
  const readAt = timestamp(3)
  const merged = mergeMessages(
    [{ ...incoming, read_at: readAt }],
    [{ ...incoming, read_at: null, replayed: true }]
  )

  assert.equal(duplicate.conversations[0].unread_count, 1)
  assert.deepEqual(
    duplicate.selectedConversation.messages.map(({ id }) => id),
    [incoming.id]
  )
  assert.equal(merged.length, 1)
  assert.equal(merged[0].read_at, readAt)
})

test("a message from another tab of the current user preserves the unread count", () => {
  const initial = createChatState(
    snapshot({ conversation: summary({ unread_count: 2 }) })
  )
  const outgoing = message("own-message", 1, {
    sender: { id: currentUserId, name: "Test Buyer", avatar_url: null },
  })

  const state = receiveChatMessage(initial, outgoing, currentUserId)

  assert.equal(state.conversations[0].unread_count, 2)
  assert.equal(state.selectedConversation.unread_count, 2)
  assert.equal(state.selectedConversation.messages[0].id, outgoing.id)
  assert.equal(state.conversations[0].last_message, outgoing.body)
})

test("an out-of-order socket message keeps the newest conversation preview", () => {
  const newest = message("m3", 3)
  const initial = createChatState(
    snapshot({
      conversation: summary({
        last_message: newest.body,
        updated_at: newest.created_at,
        unread_count: 1,
      }),
      messages: [newest],
    })
  )
  const delayed = message("m2", 2)

  const state = receiveChatMessage(initial, delayed, currentUserId)

  assert.equal(state.conversations[0].last_message, newest.body)
  assert.equal(state.conversations[0].updated_at, newest.created_at)
  assert.equal(state.conversations[0].unread_count, 2)
  assert.deepEqual(
    state.selectedConversation.messages.map(({ id }) => id),
    ["m2", "m3"]
  )
})

test("a delayed receipt for m1 leaves the newer m2 unread", () => {
  const first = message("m1", 1)
  const second = message("m2", 2)
  let state = createChatState(snapshot())
  state = receiveChatMessage(state, first, currentUserId)
  state = receiveChatMessage(state, second, currentUserId)

  const event = receipt([first])
  state = receiveReadReceipt(state, event, currentUserId)

  assert.equal(state.conversations[0].unread_count, 1)
  assert.equal(state.selectedConversation.unread_count, 1)
  assert.equal(state.selectedConversation.messages[0].read_at, event.read_at)
  assert.equal(state.selectedConversation.messages[1].read_at, null)
  assert.equal(state.conversations[0].last_message, second.body)
  assert.equal(
    receiveReadReceipt(state, event, currentUserId).conversations[0]
      .unread_count,
    1
  )
})

test("a receipt arriving before its message prevents that message becoming unread", () => {
  const incoming = message("m1", 1)
  const event = receipt([incoming])
  const withReceipt = receiveReadReceipt(
    createChatState(snapshot()),
    event,
    currentUserId
  )

  const state = receiveChatMessage(withReceipt, incoming, currentUserId)

  assert.equal(state.conversations[0].unread_count, 0)
  assert.equal(state.selectedConversation.unread_count, 0)
  assert.equal(state.selectedConversation.messages[0].read_at, event.read_at)
  assert.equal(state.knownMessages.get(incoming.id).read_at, event.read_at)
})

test("a snapshot captured before a socket update preserves live unread, preview and messages", () => {
  const incoming = message("m1", 2)
  const live = receiveChatMessage(
    createChatState(snapshot()),
    incoming,
    currentUserId
  )
  const stale = snapshot({
    conversation: summary({ updated_at: incoming.created_at, unread_count: 0 }),
  })

  const state = reconcileChatState(live, stale, new Set([conversationId]))

  assert.equal(state.conversations[0].unread_count, 1)
  assert.equal(state.conversations[0].last_message, incoming.body)
  assert.equal(state.selectedConversation.unread_count, 1)
  assert.equal(state.selectedConversation.last_message, incoming.body)
  assert.deepEqual(
    state.selectedConversation.messages.map(({ id }) => id),
    [incoming.id]
  )
})

test("a reconnect snapshot retains loaded history, read receipts and its older pagination cursor", () => {
  const messages = [
    message("m1", 1),
    message("m2", 2),
    message("m3", 3),
    message("m4", 4, {
      sender: { id: currentUserId, name: "Test Buyer", avatar_url: null },
    }),
  ]
  const conversation = summary({
    last_message: messages[3].body,
    updated_at: timestamp(4),
  })
  const pagination = { has_more: true, next_cursor: "before-m1" }
  const initial = createChatState(
    snapshot({ messages, conversation, pagination })
  )
  const event = receipt([messages[3]], {
    readerId: counterpartId,
    throughMinute: 4,
  })
  const live = receiveReadReceipt(initial, event, currentUserId)

  const state = reconcileChatState(
    live,
    snapshot({
      messages: messages.slice(2),
      conversation,
      pagination: { has_more: true, next_cursor: "before-m3" },
    })
  )

  assert.deepEqual(
    state.selectedConversation.messages.map(({ id }) => id),
    ["m1", "m2", "m3", "m4"]
  )
  assert.equal(state.selectedConversation.messages[3].read_at, event.read_at)
  assert.equal(state.knownMessages.get("m4").read_at, event.read_at)
  assert.equal(state.readReceipts.size, 1)
  assert.deepEqual(state.selectedConversation.messages_pagination, pagination)
})

test("a reconnect snapshot without overlap uses its fresh cursor so the missing gap can be fetched", () => {
  const loaded = [message("m1", 1), message("m2", 2)]
  const fresh = [message("m8", 8), message("m9", 9)]
  const initial = createChatState(snapshot({ messages: loaded }))
  const freshPagination = { has_more: true, next_cursor: "before-m8" }

  const state = reconcileChatState(
    initial,
    snapshot({
      messages: fresh,
      conversation: summary({
        last_message: fresh[1].body,
        updated_at: timestamp(9),
      }),
      pagination: freshPagination,
    })
  )

  assert.deepEqual(
    state.selectedConversation.messages.map(({ id }) => id),
    ["m1", "m2", "m8", "m9"]
  )
  assert.deepEqual(
    state.selectedConversation.messages_pagination,
    freshPagination
  )
  assert.equal(state.conversations[0].last_message, fresh[1].body)
})

test("switching people reads every preloaded history immediately and retains updates received while inactive", () => {
  const second = summary({
    id: "conversation-2",
    slug: "second-person",
    unread_count: 0,
  })
  const firstMessage = message("first", 1)
  const secondMessage = message("second", 2, { conversation_id: second.id })
  let state = createChatState({
    ...snapshot({ messages: [firstMessage], otherConversations: [second] }),
    conversationSnapshots: [
      {
        ...summary(),
        messages: [firstMessage],
        messages_pagination: { has_more: false, next_cursor: null },
      },
      {
        ...second,
        messages: [secondMessage],
        messages_pagination: { has_more: false, next_cursor: null },
      },
    ],
  })
  state = selectChatConversation(state, second.slug)
  assert.deepEqual(
    state.selectedConversation.messages.map(({ id }) => id),
    ["second"]
  )
  state = receiveChatMessage(state, message("first-new", 3), currentUserId)
  state = selectChatConversation(state, summary().slug)
  assert.deepEqual(
    state.selectedConversation.messages.map(({ id }) => id),
    ["first", "first-new"]
  )
  assert.equal(state.selectedConversation.unread_count, 1)
  state = selectChatConversation(state)
  assert.equal(state.selectedConversation, null)
  assert.equal(state.conversationCache.size, 2)
})

test("read receipts update an inactive preloaded conversation before it is opened", () => {
  const first = message("unopened", 1)
  let state = createChatState({
    conversations: [summary({ unread_count: 1, updated_at: first.created_at })],
    selectedConversation: null,
    conversationSnapshots: [
      {
        ...summary({ unread_count: 1, updated_at: first.created_at }),
        messages: [first],
        messages_pagination: { has_more: false, next_cursor: null },
      },
    ],
  })
  const event = receipt([first])
  state = receiveReadReceipt(state, event, currentUserId)
  state = selectChatConversation(state, summary().slug)
  assert.equal(state.selectedConversation.messages[0].read_at, event.read_at)
  assert.equal(state.selectedConversation.unread_count, 0)
})

test("reconnect refreshes all cached histories without switching the person the user is chatting with", () => {
  const second = summary({ id: "conversation-2", slug: "second-person" })
  let state = createChatState({
    conversations: [summary(), second],
    selectedConversation: null,
    conversationSnapshots: [
      {
        ...summary(),
        messages: [],
        messages_pagination: { has_more: false, next_cursor: null },
      },
      {
        ...second,
        messages: [],
        messages_pagination: { has_more: false, next_cursor: null },
      },
    ],
  })
  state = selectChatConversation(state, second.slug)
  const incoming = message("recovered", 4)
  state = reconcileChatState(state, {
    conversations: [
      summary({ updated_at: incoming.created_at, unread_count: 1 }),
      second,
    ],
    selectedConversation: null,
    conversationSnapshots: [
      {
        ...summary({ updated_at: incoming.created_at, unread_count: 1 }),
        messages: [incoming],
        messages_pagination: { has_more: false, next_cursor: null },
      },
      {
        ...second,
        messages: [],
        messages_pagination: { has_more: false, next_cursor: null },
      },
    ],
  })
  assert.equal(state.selectedConversation.id, second.id)
  assert.deepEqual(
    selectChatConversation(
      state,
      summary().slug
    ).selectedConversation.messages.map(({ id }) => id),
    ["recovered"]
  )
})

test("tagged admins appear as conversation participants immediately without a page refresh", () => {
  const initial = createChatState(snapshot())
  const state = receiveChatMessage(
    initial,
    message("tagged", 2, { mentions: [{ id: "admin", name: "Support" }] }),
    currentUserId
  )
  assert.deepEqual(state.conversations[0].participants, [
    { id: "admin", name: "Support", is_admin: true },
  ])
  assert.deepEqual(
    state.selectedConversation.participants,
    state.conversations[0].participants
  )
  assert.deepEqual(
    selectChatConversation(state, summary().slug).selectedConversation
      .participants,
    state.conversations[0].participants
  )
})

test("a history response arriving after changing people updates only its original conversation", () => {
  const second = summary({ id: "second", slug: "second" })
  let state = createChatState({
    ...snapshot(),
    conversations: [summary(), second],
    conversationSnapshots: [
      {
        ...second,
        messages: [],
        messages_pagination: { has_more: false, next_cursor: null },
      },
    ],
  })
  state = selectChatConversation(state, second.slug)
  state = receiveChatHistory(state, conversationId, {
    messages: [message("older", 1)],
    has_more: false,
    next_cursor: null,
  })
  assert.equal(state.selectedConversation.id, second.id)
  assert.deepEqual(state.selectedConversation.messages, [])
  assert.deepEqual(
    selectChatConversation(
      state,
      summary().slug
    ).selectedConversation.messages.map(({ id }) => id),
    ["older"]
  )
})

test("an admin's receipt arriving before an incoming message does not clear the viewer's unread count", () => {
  const incoming = message("admin-read-first", 1)
  const adminReceipt = receipt([incoming], {
    readerId: "third-participant-admin",
  })
  let state = receiveReadReceipt(
    createChatState(snapshot()),
    adminReceipt,
    currentUserId
  )
  state = receiveChatMessage(state, incoming, currentUserId)
  assert.equal(state.conversations[0].unread_count, 1)
  assert.equal(
    state.selectedConversation.messages[0].read_at,
    adminReceipt.read_at
  )
  assert.equal(state.selectedConversation.messages[0].viewer_read_at, null)
})

test("a viewer's delayed receipt decrements only their read messages after an admin already read them", () => {
  const first = message("first-read-by-admin", 1)
  const second = message("newer-unread", 2)
  let state = receiveChatMessage(
    createChatState(snapshot()),
    first,
    currentUserId
  )
  state = receiveChatMessage(state, second, currentUserId)
  state = receiveReadReceipt(
    state,
    receipt([first], { readerId: "admin", throughMinute: 1 }),
    currentUserId
  )
  state = receiveReadReceipt(
    state,
    receipt([first], { throughMinute: 1 }),
    currentUserId
  )
  assert.equal(state.conversations[0].unread_count, 1)
  assert.equal(state.selectedConversation.messages[1].viewer_read_at, undefined)
})

test("viewer-specific unread metadata survives an admin's read receipt and reconnect", () => {
  const first = message("viewer-unread", 1, {
    read_at: timestamp(2),
    viewer_read_at: null,
  })
  let state = createChatState(
    snapshot({
      messages: [first],
      conversation: summary({ unread_count: 1, updated_at: timestamp(1) }),
    }),
    currentUserId
  )
  state = receiveReadReceipt(
    state,
    receipt([first], { readerId: "admin" }),
    currentUserId
  )
  state = reconcileChatState(
    state,
    snapshot({
      messages: [first],
      conversation: summary({ unread_count: 1, updated_at: timestamp(1) }),
    })
  )
  assert.equal(state.conversations[0].unread_count, 1)
  assert.equal(state.selectedConversation.messages[0].viewer_read_at, null)
})

test("HTTP read success records the viewer's state even when websocket receipts arrive later", () => {
  const first = message("http-read", 1, { viewer_read_at: null })
  let state = createChatState(
    snapshot({
      messages: [first],
      conversation: summary({ unread_count: 1, updated_at: timestamp(1) }),
    }),
    currentUserId
  )
  state = markChatConversationRead(
    state,
    conversationId,
    currentUserId,
    timestamp(2)
  )
  state = receiveChatMessage(
    state,
    message("after-http-read", 3),
    currentUserId
  )
  state = receiveReadReceipt(
    state,
    receipt([first], { throughMinute: 1 }),
    currentUserId
  )
  assert.equal(state.conversations[0].unread_count, 1)
  assert.equal(
    state.selectedConversation.messages[0].viewer_read_at,
    timestamp(2)
  )
})

test("an authoritative snapshot removes conversations whose invited-admin membership was revoked", () => {
  const loaded = message("private-old-thread", 1)
  const initial = createChatState(
    snapshot({ messages: [loaded] }),
    currentUserId
  )
  const state = reconcileChatState(initial, {
    conversations: [],
    selectedConversation: null,
    conversationSnapshots: [],
    admins: [],
  })
  assert.equal(state.selectedConversation, null)
  assert.equal(state.conversations.length, 0)
  assert.equal(state.conversationCache.size, 0)
  assert.equal(state.knownMessages.size, 0)
})
