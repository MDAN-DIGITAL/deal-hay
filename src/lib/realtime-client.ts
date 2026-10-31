export type ConnectionStatus =
  "connecting" | "connected" | "reconnecting" | "disconnected" | "failed"

type Member = { id: string; name: string }
export interface RealtimeChannel {
  readonly subscription: { subscribed: boolean }
  listen<T>(event: string, listener: (payload: T) => void): this
  stopListening<T>(event: string, listener?: (payload: T) => void): this
  subscribed(listener: () => void): this
  error(listener: () => void): this
}
export interface RealtimePresenceChannel extends RealtimeChannel {
  here(listener: (members: Member[]) => void): this
  joining(listener: (member: Member) => void): this
  leaving(listener: (member: Member) => void): this
}
export type RealtimeClient = {
  private(channel: string): RealtimeChannel
  join(channel: string): RealtimePresenceChannel
  leave(channel: string): void
  socketId(): string | undefined
  disconnect(): void
  connectionStatus(): ConnectionStatus
  ping: () => Promise<void>
  connector: {
    onConnectionChange(listener: (status: ConnectionStatus) => void): () => void
  }
}
