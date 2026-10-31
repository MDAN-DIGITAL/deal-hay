"use client"

import { AuthGuard } from "@/components/session-provider"
import { ChatsPageContainer } from "@/modules/chats/containers/chats-page-container"

export function AuthenticatedChatsPage({
  conversationSlug,
}: {
  conversationSlug?: string
}) {
  return (
    <AuthGuard>
      {(user) => (
        <ChatsPageContainer
          conversationSlug={conversationSlug}
          currentUserId={user.id}
        />
      )}
    </AuthGuard>
  )
}
