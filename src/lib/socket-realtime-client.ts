import { io, type Socket } from "socket.io-client"
import type { ConnectionStatus } from "@/lib/realtime-client"

import type {
  RealtimeChannel,
  RealtimeClient,
  RealtimePresenceChannel,
} from "@/lib/realtime-client"

type Session = { token: string; url: string; expires_at: number }
type Acknowledgement = { ok: boolean; data?: unknown }
type Listener = (payload: unknown) => void

class SocketChannel implements RealtimePresenceChannel {
  private listeners = new Map<string, Set<Listener>>()
  private subscribers = new Set<() => void>()
  private errors = new Set<() => void>()
  private subscribedNow = false
  private revision = 0
  private members: { id: string; name: string }[] = []
  private presenceHere = new Set<
    (members: { id: string; name: string }[]) => void
  >()
  private presenceJoining = new Set<
    (member: { id: string; name: string }) => void
  >()
  private presenceLeaving = new Set<
    (member: { id: string; name: string }) => void
  >()
  constructor(
    readonly name: string,
    private socket: Socket
  ) {}
  get subscription() {
    return { subscribed: this.subscribedNow }
  }
  listen<T>(event: string, listener: (payload: T) => void): this {
    const key = event.replace(/^\./, "")
    const callbacks = this.listeners.get(key) ?? new Set<Listener>()
    callbacks.add(listener as Listener)
    this.listeners.set(key, callbacks)
    return this
  }
  stopListening<T>(event: string, listener?: (payload: T) => void): this {
    const key = event.replace(/^\./, "")
    if (listener) this.listeners.get(key)?.delete(listener as Listener)
    else this.listeners.delete(key)
    return this
  }
  subscribed(listener: () => void): this {
    this.subscribers.add(listener)
    if (this.subscribedNow) queueMicrotask(listener)
    return this
  }
  error(listener: () => void): this {
    this.errors.add(listener)
    return this
  }
  here(listener: (members: { id: string; name: string }[]) => void): this {
    this.presenceHere.add(listener)
    if (this.subscribedNow) queueMicrotask(() => listener(this.members))
    return this
  }
  joining(listener: (member: { id: string; name: string }) => void): this {
    this.presenceJoining.add(listener)
    return this
  }
  leaving(listener: (member: { id: string; name: string }) => void): this {
    this.presenceLeaving.add(listener)
    return this
  }
  presence(event: string, members: { id: string; name: string }[]) {
    if (event === "here") {
      this.members = members
      for (const listener of this.presenceHere) listener(members)
    } else if (event === "joining" || event === "leaving") {
      const member = members[0]
      if (!member) return
      this.members = this.members.filter(
        (existing) => existing.id !== member.id
      )
      if (event === "joining") this.members.push(member)
      for (const listener of event === "joining"
        ? this.presenceJoining
        : this.presenceLeaving)
        listener(member)
    }
  }
  dispatch(event: string, payload: unknown) {
    if (!this.subscribedNow) return
    for (const listener of this.listeners.get(event.replace(/^\./, "")) ?? [])
      listener(payload)
  }
  reset() {
    this.subscribedNow = false
    this.revision++
    this.members = []
  }
  subscribe() {
    if (!this.socket.connected) return
    const revision = ++this.revision
    this.socket
      .timeout(10_000)
      .emit(
        "realtime:subscribe",
        { channel: this.name },
        (error: Error | null, ack: Acknowledgement) => {
          if (revision !== this.revision || !this.socket.connected) return
          if (error || !ack?.ok) {
            for (const listener of this.errors) listener()
            return
          }
          this.subscribedNow = true
          for (const listener of this.subscribers) listener()
          this.dispatch("pusher:subscription_succeeded", {})
        }
      )
  }
}

export function createSocketRealtimeClient(
  origin: string,
  loadSession: (force?: boolean) => Promise<Session>
): RealtimeClient {
  const endpoint = new URL(origin)
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== "/" ||
    (endpoint.protocol !== "https:" &&
      !(
        endpoint.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)
      ))
  ) {
    throw new Error("Invalid realtime service origin")
  }
  let disposed = false
  let everConnected = false
  let status: ConnectionStatus = "connecting"
  let renewal: ReturnType<typeof setTimeout> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let retryDelay = 1000
  let currentExpiry = 0
  let renewRejectedSession = false
  const changes = new Set<(status: ConnectionStatus) => void>()
  const channels = new Map<string, SocketChannel>()
  const update = (next: ConnectionStatus) => {
    status = next
    for (const listener of changes) listener(next)
  }
  const socket = io(endpoint.origin, {
    transports: ["websocket"],
    autoConnect: false,
    forceNew: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15_000,
    timeout: 20_000,
    auth: (done) => {
      const force = renewRejectedSession
      renewRejectedSession = false
      void loadSession(force)
        .then((session) => {
          if (disposed) return
          if (
            new URL(session.url).origin !== endpoint.origin ||
            session.expires_at * 1000 <= Date.now()
          )
            throw new Error("Invalid realtime session")
          currentExpiry = session.expires_at * 1000
          done({ ticket: session.token })
        })
        .catch(() => {
          if (!disposed) {
            update("failed")
            done({ ticket: "" })
          }
        })
    },
  })
  socket.on("connect", () => {
    if (disposed) return
    clearTimeout(retryTimer)
    retryTimer = undefined
    retryDelay = 1000
    everConnected = true
    update("connected")
    for (const channel of channels.values()) channel.subscribe()
    clearTimeout(renewal)
    renewal = setTimeout(
      () => {
        if (disposed) return
        update("reconnecting")
        socket.disconnect().connect()
      },
      Math.max(1000, currentExpiry - Date.now() - 15_000)
    )
  })
  socket.on("disconnect", (reason) => {
    clearTimeout(renewal)
    for (const channel of channels.values()) channel.reset()
    if (disposed) return
    update("reconnecting")
    // Expired tickets are server disconnects; obtain a fresh ticket on connect.
    if (reason === "io server disconnect") socket.connect()
  })
  socket.on("connect_error", (error: Error & { data?: { code?: string } }) => {
    if (disposed) return
    if (error?.data?.code === "UNAUTHENTICATED") renewRejectedSession = true
    update("failed")
    // Namespace authentication failures do not trigger Socket.IO reconnects.
    if (retryTimer) return
    retryTimer = setTimeout(() => {
      retryTimer = undefined
      if (disposed || socket.connected) return
      update(everConnected ? "reconnecting" : "connecting")
      socket.connect()
    }, retryDelay)
    retryDelay = Math.min(retryDelay * 2, 15_000)
  })
  socket.on("session:expired", () => {
    renewRejectedSession = true
  })
  socket.io.on("reconnect_attempt", () =>
    update(everConnected ? "reconnecting" : "connecting")
  )
  socket.on("realtime:event", (packet: unknown) => {
    if (
      !packet ||
      typeof packet !== "object" ||
      !("channel" in packet) ||
      typeof packet.channel !== "string" ||
      !("event" in packet) ||
      typeof packet.event !== "string"
    )
      return
    channels
      .get(packet.channel)
      ?.dispatch(packet.event, "payload" in packet ? packet.payload : undefined)
  })
  socket.on("realtime:presence", (packet: unknown) => {
    if (
      !packet ||
      typeof packet !== "object" ||
      !("channel" in packet) ||
      typeof packet.channel !== "string" ||
      !("event" in packet) ||
      typeof packet.event !== "string"
    )
      return
    const raw =
      "users" in packet && Array.isArray(packet.users)
        ? packet.users
        : "user" in packet
          ? [packet.user]
          : []
    const members = raw.flatMap((member: unknown) => {
      if (
        !member ||
        typeof member !== "object" ||
        !("id" in member) ||
        typeof member.id !== "string"
      )
        return []
      return [
        {
          id: member.id,
          name:
            "name" in member && typeof member.name === "string"
              ? member.name
              : "",
        },
      ]
    })
    channels.get(packet.channel)?.presence(packet.event, members)
  })
  const channelFor = (name: string) => {
    let channel = channels.get(name)
    if (!channel) {
      channel = new SocketChannel(name, socket)
      channels.set(name, channel)
      channel.subscribe()
    }
    return channel
  }
  socket.connect()
  return {
    private: (name): RealtimeChannel => channelFor(name),
    join: (name) => channelFor(name),
    leave(name) {
      channels.get(name)?.reset()
      channels.delete(name)
      if (socket.connected)
        socket.emit("realtime:unsubscribe", { channel: name })
    },
    socketId: () => socket.id,
    connectionStatus: () => status,
    connector: {
      onConnectionChange(listener) {
        changes.add(listener)
        return () => {
          changes.delete(listener)
        }
      },
    },
    ping: () =>
      new Promise<void>((resolve, reject) => {
        socket
          .timeout(5000)
          .emit(
            "realtime:ping",
            {},
            (error: Error | null, ack: Acknowledgement) =>
              error || !ack?.ok
                ? reject(new Error("Realtime ping failed"))
                : resolve()
          )
      }),
    disconnect() {
      disposed = true
      clearTimeout(renewal)
      clearTimeout(retryTimer)
      socket.removeAllListeners()
      socket.disconnect()
      channels.clear()
      changes.clear()
    },
  }
}
