import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const sessionSource = ts.transpileModule(
  readFileSync(new URL("../src/lib/session.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
).outputText
const sessionUrl = `data:text/javascript;base64,${Buffer.from(sessionSource).toString("base64")}`
const source = ts
  .transpileModule(
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
  )
  .outputText.replace('"@/lib/session"', JSON.stringify(sessionUrl))
const {
  CHAT_NAVIGATION_EVENT,
  navigateToChat,
  reserveChatPage,
  openChatPage,
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

test("saved links for an empty retired support room resolve to its original private history", () => {
  const target = {
    id: "real-support",
    slug: "earlier-admin-chat",
    messages: [{ id: "kept-message" }],
  }
  const cache = new Map([[target.id, target]])
  const aliases = [
    {
      id: "empty-support",
      slug: "generated-room",
      target_id: target.id,
      target_slug: target.slug,
    },
  ]
  assert.equal(
    resolveChatNavigationTarget(
      cache,
      { conversationId: "empty-support", messageId: "kept-message" },
      aliases
    ),
    target
  )
  assert.equal(
    resolveChatNavigationTarget(
      cache,
      { conversationSlug: "generated-room" },
      aliases
    ),
    target
  )
  assert.equal(
    resolveChatNavigationTarget(
      new Map(),
      { conversationId: "empty-support" },
      aliases
    ),
    undefined
  )
})

function browser(t, path) {
  const window = new EventTarget()
  window.location = new URL(path, "https://dealhay.example")
  window.pushes = []
  const storage = (values = {}) => {
    const entries = new Map(Object.entries(values))
    return {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
      removeItem: (key) => entries.delete(key),
    }
  }
  window.sessionStorage = storage({ dealhay_access_token: "account-a" })
  window.localStorage = storage()
  window.opens = []
  window.open = (url, target) => {
    const page = {
      opener: window,
      closed: false,
      sessionStorage: storage({ dealhay_wss_session: "outdated" }),
      destinations: [],
      close() {
        this.closed = true
      },
    }
    page.location = {
      replace(href) {
        page.destinations.push(href)
      },
    }
    window.opens.push({ url, target, page })
    return page
  }
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

test("opening a toast outside chat preserves its account and exact message in a new tab", (t) => {
  const window = browser(t, "/profile")
  const destinations = []
  const href = "/chats?conversation=thread-b&message=message-b"
  navigateToChat(href, (value) => destinations.push(value))
  assert.deepEqual(destinations, [])
  assert.deepEqual(window.pushes, [])
  assert.equal(window.opens.length, 1)
  const opened = window.opens[0]
  assert.equal(opened.url, "about:blank")
  assert.equal(opened.target, "_blank")
  assert.equal(opened.page.opener, null)
  assert.equal(
    opened.page.sessionStorage.getItem("dealhay_access_token"),
    "account-a"
  )
  assert.equal(opened.page.sessionStorage.getItem("dealhay_wss_session"), "")
  assert.deepEqual(opened.page.destinations, [href])
})

test("reserved chat tabs retain the shared WSS record for offline API access without putting credentials in URLs", (t) => {
  const window = browser(t, "/profile")
  const record = JSON.stringify({
    owner: "bound-account",
    session: { token: "a".repeat(64) },
  })
  window.localStorage.setItem("dealhay_wss_session", record)
  window.sessionStorage.setItem("dealhay_wss_session", "old-tab-record")
  assert.equal(openChatPage("/chats/thread?message=target"), true)
  const opened = window.opens[0]
  assert.equal(
    opened.page.sessionStorage.getItem("dealhay_wss_session"),
    record
  )
  assert.deepEqual(opened.page.destinations, ["/chats/thread?message=target"])
  assert.equal(opened.page.opener, null)
})

test("a shared WSS tombstone overrides the old tab's cached credential when reserving chat", (t) => {
  const window = browser(t, "/profile")
  window.localStorage.setItem("dealhay_wss_session", "")
  window.sessionStorage.setItem("dealhay_wss_session", "old-tab-record")
  assert.equal(openChatPage("/chats/thread"), true)
  assert.equal(
    window.opens[0].page.sessionStorage.getItem("dealhay_wss_session"),
    ""
  )
})

test("a restricted-storage browser passes its current WSS credential to the owned blank tab", (t) => {
  const window = browser(t, "/profile")
  Object.defineProperty(window, "localStorage", {
    get() {
      throw new DOMException("Blocked", "SecurityError")
    },
  })
  window.sessionStorage.setItem("dealhay_wss_session", "current-tab-record")
  assert.equal(openChatPage("/chats/thread"), true)
  assert.equal(
    window.opens[0].page.sessionStorage.getItem("dealhay_wss_session"),
    "current-tab-record"
  )
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
  assert.deepEqual(window.opens, [])
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
  assert.deepEqual(window.opens, [])
})

test("reserving before an async chat action closes an unused tab on failure", (t) => {
  const window = browser(t, "/admin/users")
  const reserved = reserveChatPage()
  assert.equal(window.opens.length, 1)
  assert.deepEqual(window.opens[0].page.destinations, [])
  reserved.close()
  reserved.close()
  assert.equal(window.opens[0].page.closed, true)
  assert.equal(reserved.navigate("/chats/new-thread"), false)
})

for (const next of [null, "account-b"])
  test(`${next ? "switching accounts" : "logging out"} while creating a chat cannot navigate the reserved tab`, (t) => {
    const window = browser(t, "/shop-manage")
    const reserved = reserveChatPage()
    window.localStorage.setItem("dealhay_access_token", next ?? "")
    assert.equal(reserved.navigate("/chats/old-account-thread"), false)
    assert.equal(window.opens[0].page.closed, true)
    assert.deepEqual(window.opens[0].page.destinations, [])
  })

test("a reserved tab only navigates once to a local chat URL and does not close after success", (t) => {
  const window = browser(t, "/")
  const reserved = reserveChatPage()
  assert.equal(
    reserved.navigate("https://dealhay.example/chats/target?message=exact"),
    true
  )
  assert.equal(reserved.navigate("/chats/other"), false)
  reserved.close()
  assert.equal(window.opens[0].page.closed, false)
  assert.deepEqual(window.opens[0].page.destinations, [
    "/chats/target?message=exact",
  ])
})

test("blocked tabs and invalid destinations never replace the source page", (t) => {
  const window = browser(t, "/profile")
  window.open = () => null
  assert.equal(reserveChatPage(), null)
  assert.equal(openChatPage("/chats/thread"), false)
  for (const href of [
    "javascript:alert(1)",
    "https://outside.example/chats",
    "/profile",
  ])
    assert.equal(openChatPage(href), false)
  assert.equal(window.location.pathname, "/profile")
  assert.deepEqual(window.pushes, [])
})
