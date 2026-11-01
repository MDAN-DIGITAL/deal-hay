export const chatRoutes = {
  list: "/chats",
  history: (conversationSlug: string) => `/chats/${conversationSlug}/messages`,
  send: (conversationSlug: string) => `/chats/${conversationSlug}/messages`,
  read: (conversationSlug: string) => `/chats/${conversationSlug}/read`,
  presence: "/presence/heartbeat",
} as const
