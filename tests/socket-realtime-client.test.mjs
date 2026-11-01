import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const transpile = (file, imports = {}) =>
  moduleUrl(
    ts
      .transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      })
      .outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
        assert.ok(imports[name], `Unmocked import: ${name}`)
        return `from ${quote}${imports[name]}${quote}`
      })
  )
const socketStub = moduleUrl(`
export const state = { sockets: [], allowed: true }
export function io(url, options) {
  const handlers = new Map(), managerHandlers = new Map()
  const socket = {
    url, options, id: "socket-id", connected: false, calls: [],
    io: { on(event, listener) { managerHandlers.set(event, listener) } },
    on(event, listener) { handlers.set(event, listener); return socket },
    receive(event, packet) { handlers.get(event)?.(packet) },
    timeout() { return socket },
    emit(event, payload, callback) { socket.calls.push({ event, payload }); if(callback) queueMicrotask(() => callback(null,{ok:state.allowed})) ; return socket },
    connect() { options.auth((auth) => {socket.auth=auth;if(!auth.ticket){socket.receive("connect_error");return}socket.connected=true;socket.receive("connect")}); return socket },
    disconnect() { socket.connected=false;socket.receive("disconnect","io client disconnect");return socket },
    removeAllListeners() { handlers.clear() },
  }
  state.sockets.push(socket)
  return socket
}`)
const { state } = await import(socketStub)
const { createSocketRealtimeClient } = await import(
  transpile("../src/lib/socket-realtime-client.ts", {
    "socket.io-client": socketStub,
  })
)
const origin = "https://wss.example.com"
const flush = async () => {
  await new Promise((resolve) => setImmediate(resolve))
}
const clients = []
test.afterEach(() => {
  for (const client of clients.splice(0)) client.disconnect()
  state.sockets.length = 0
  state.allowed = true
})
const makeClient = (loader) => {
  const client = createSocketRealtimeClient(origin, loader)
  clients.push(client)
  return client
}

test("a rejected local session renews its credential while a transport outage keeps the cached session", async () => {
  const requests = []
  makeClient(async (force) => {
    requests.push(force)
    return {
      token: "local-session",
      url: origin,
      expires_at: Math.floor(Date.now() / 1000) + 86400,
    }
  })
  await flush()
  const socket = state.sockets[0]
  socket.connected = false
  socket.receive("connect_error", new Error("Network unavailable"))
  socket.connect()
  await flush()
  assert.deepEqual(requests, [false, false])
  socket.connected = false
  socket.receive("connect_error", { data: { code: "UNAUTHENTICATED" } })
  socket.connect()
  await flush()
  assert.deepEqual(requests, [false, false, true])
  socket.receive("session:expired")
  socket.connected = false
  socket.connect()
  await flush()
  assert.equal(requests.at(-1), true)
})

test("Socket.IO uses scoped ticket auth, authorizes subscriptions and dispatches existing business events", async () => {
  let fetched = 0,
    subscribed = 0
  const events = [],
    statuses = []
  const client = makeClient(async () => ({
    token: `ticket-${++fetched}`,
    url: origin,
    expires_at: Math.floor(Date.now() / 1000) + 300,
  }))
  const socket = state.sockets[0]
  client.connector.onConnectionChange((status) => statuses.push(status))
  const listener = (event) => events.push(event)
  const channel = client
    .private("user-chat.owner")
    .listen(".message.sent", listener)
    .subscribed(() => subscribed++)
  await flush()
  assert.deepEqual(socket.auth, { ticket: "ticket-1" })
  assert.deepEqual(socket.calls[0], {
    event: "realtime:subscribe",
    payload: { channel: "user-chat.owner" },
  })
  assert.equal(channel.subscription.subscribed, true)
  assert.equal(subscribed, 1)
  socket.receive("realtime:event", {
    channel: "user-chat.owner",
    event: "message.sent",
    payload: { id: "message-id" },
  })
  socket.receive("realtime:event", {
    channel: "user-chat.another",
    event: "message.sent",
    payload: { id: "wrong-room" },
  })
  assert.deepEqual(events, [{ id: "message-id" }])
  channel.stopListening(".message.sent", listener)
  socket.receive("realtime:event", {
    channel: "user-chat.owner",
    event: "message.sent",
    payload: { id: "ignored" },
  })
  assert.equal(events.length, 1)
  socket.disconnect().connect()
  await flush()
  assert.deepEqual(socket.auth, { ticket: "ticket-2" })
  assert.equal(subscribed, 2)
  assert.ok(statuses.includes("reconnecting"))
  await client.ping()
  assert.equal(socket.calls.at(-1).event, "realtime:ping")
})

test("Socket.IO denied subscriptions remain failed and presence members follow server packets", async () => {
  const client = makeClient(async () => ({
    token: "ticket",
    url: origin,
    expires_at: Math.floor(Date.now() / 1000) + 300,
  }))
  const members = [],
    joined = [],
    left = []
  client
    .join("chat-presence.conversation")
    .here((users) => members.push(users))
    .joining((user) => joined.push(user))
    .leaving((user) => left.push(user))
  await flush()
  const socket = state.sockets[0]
  socket.receive("realtime:presence", {
    channel: "chat-presence.conversation",
    event: "here",
    users: [{ id: "owner", name: "Owner" }],
  })
  socket.receive("realtime:presence", {
    channel: "chat-presence.conversation",
    event: "joining",
    user: { id: "buyer" },
  })
  socket.receive("realtime:presence", {
    channel: "chat-presence.conversation",
    event: "leaving",
    user: { id: "buyer" },
  })
  assert.deepEqual(members.at(-1), [{ id: "owner", name: "Owner" }])
  assert.deepEqual(joined, [{ id: "buyer", name: "" }])
  assert.deepEqual(left, [{ id: "buyer", name: "" }])
  state.allowed = false
  let errors = 0,
    success = 0
  const channel = client
    .private("forbidden")
    .subscribed(() => success++)
    .error(() => errors++)
  await flush()
  assert.equal(errors, 1)
  assert.equal(success, 0)
  assert.equal(channel.subscription.subscribed, false)
})

test("Socket.IO rejects insecure origins and never sends a ticket to a changed session origin", async () => {
  assert.throws(() =>
    createSocketRealtimeClient("http://wss.example.com", async () => ({}))
  )
  const client = makeClient(async () => ({
    token: "secret-ticket",
    url: "https://attacker.example",
    expires_at: Math.floor(Date.now() / 1000) + 300,
  }))
  await flush()
  assert.deepEqual(state.sockets[0].auth, { ticket: "" })
  assert.equal(client.connectionStatus(), "failed")
  assert.doesNotMatch(JSON.stringify(state.sockets[0].auth), /secret-ticket/)
})

test("Socket.IO retries a rejected authentication handshake with a fresh ticket and cancels retries on disposal", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  let attempts = 0
  const client = makeClient(async () => {
    if (++attempts === 1) throw new Error("API temporarily unavailable")
    return {
      token: "fresh-ticket",
      url: origin,
      expires_at: Math.floor(Date.now() / 1000) + 300,
    }
  })
  const channel = client.private("user-chat.owner")
  await flush()
  assert.equal(client.connectionStatus(), "failed")
  t.mock.timers.tick(1000)
  await flush()
  assert.equal(attempts, 2)
  assert.equal(client.connectionStatus(), "connected")
  assert.equal(channel.subscription.subscribed, true)
  state.sockets[0].connected = false
  state.sockets[0].receive("connect_error")
  client.disconnect()
  t.mock.timers.tick(30_000)
  await flush()
  assert.equal(attempts, 2)
})
