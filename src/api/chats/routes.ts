export const chatRoutes = {
  list: "/chats",
  startShop: (shopCode: string) =>
    `/chats/shops/${encodeURIComponent(shopCode)}/start`,
  startAdmin: (userId: string) =>
    `/chats/users/${encodeURIComponent(userId)}/start`,
  history: (conversationSlug: string) => `/chats/${conversationSlug}/messages`,
  send: (conversationSlug: string) => `/chats/${conversationSlug}/messages`,
  read: (conversationSlug: string) => `/chats/${conversationSlug}/read`,
  presence: "/presence/heartbeat",
} as const
