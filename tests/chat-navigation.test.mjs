import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const source = ts.transpileModule(
  readFileSync(
    new URL("../src/modules/chats/lib/chat-navigation.ts", import.meta.url),
    "utf8"
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
).outputText
const {
  CHAT_NAVIGATION_EVENT,
  navigateToChat,
  parseChatNavigationTarget,
  resolveChatNavigationTarget,
} = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
)

test("a toast identifies its exact conversation and message without knowing the conversation slug", () => {
  const target = parseChatNavigationTarget(
    "/chats",
    "?conversation=thread-b&message=message-b"
  )
  const cache = new Map([
    [
      "thread-a",
      { id: "thread-a", slug: "a-va-b", messages: [{ id: "message-a" }] },
    ],
    [
      "thread-b",
      { id: "thread-b", slug: "b-va-c", messages: [{ id: "message-b" }] },
    ],
  ])
  assert.equal(resolveChatNavigationTarget(cache, target).slug, "b-va-c")
  assert.equal(target.messageId, "message-b")
  assert.equal(
    resolveChatNavigationTarget(cache, {
      ...target,
      conversationId: "missing",
    }),
    undefined
  )
  cache.set("missing", {
    id: "missing",
    slug: "new-admin-thread",
    messages: [],
  })
  assert.equal(
    resolveChatNavigationTarget(cache, { ...target, conversationId: "missing" })
      .slug,
    "new-admin-thread"
  )
})

test("ordinary slug navigation and invalid links cannot accidentally select a different cached chat", () => {
  const cache = new Map([["thread-a", { id: "thread-a", slug: "a-va-b" }]])
  assert.equal(
    resolveChatNavigationTarget(
      cache,
      parseChatNavigationTarget("/chats/a-va-b")
    ).id,
    "thread-a"
  )
  assert.equal(
    resolveChatNavigationTarget(cache, parseChatNavigationTarget("/chats")),
    undefined
  )
  assert.equal(
    parseChatNavigationTarget("/profile", "?conversation=thread-a"),
    null
  )
  assert.equal(
    parseChatNavigationTarget("/chats", "?message=standalone").messageId,
    undefined
  )
  assert.equal(
    parseChatNavigationTarget("/chats", "?conversation=bad%2Fid&message=target")
      .conversationId,
    undefined
  )
  assert.equal(
    parseChatNavigationTarget("/chats/%E0%A4%A").conversationSlug,
    undefined
  )
})

function browser(t, path) {
  const window = new EventTarget()
  window.location = new URL(path, "https://dealhay.example")
  window.pushes = []
  window.history = {
    pushState(_state, _unused, href) {
      window.pushes.push(href)
      window.location = new URL(href, window.location.origin)
    },
  }
  t.mock.property(globalThis, "window", window)
  return window
}
Object.defineProperty(globalThis, "window", {
  value: undefined,
  writable: true,
  configurable: true,
})

test("opening a toast from outside chat uses the router with the exact message query", (t) => {
  const window = browser(t, "/profile")
  const destinations = []
  const href = "/chats?conversation=thread-b&message=message-b"
  navigateToChat(href, (value) => destinations.push(value))
  assert.deepEqual(destinations, [href])
  assert.deepEqual(window.pushes, [])
})

test("chat toast clicks use local history and repeat the focus event for an identical target", (t) => {
  const window = browser(t, "/chats/a-va-b")
  const destinations = []
  const selected = []
  window.addEventListener(CHAT_NAVIGATION_EVENT, () => {
    selected.push(
      parseChatNavigationTarget(
        window.location.pathname,
        window.location.search
      )
    )
  })
  const href = "/chats?conversation=thread-b&message=message-b"
  navigateToChat(href, (value) => destinations.push(value))
  navigateToChat(href, (value) => destinations.push(value))
  assert.deepEqual(destinations, [])
  assert.deepEqual(window.pushes, [href])
  assert.equal(selected.length, 2)
  assert.equal(selected[1].conversationId, "thread-b")
  assert.equal(selected[1].messageId, "message-b")
})

test("toast navigation cannot leave the site or execute an active URL", (t) => {
  const window = browser(t, "/chats")
  const destinations = []
  for (const href of [
    "javascript:alert(1)",
    "http://[malformed",
    "https://outside.example/chats?conversation=a",
    "/profile",
  ])
    navigateToChat(href, (value) => destinations.push(value))
  assert.deepEqual(destinations, [])
  assert.deepEqual(window.pushes, [])
})
