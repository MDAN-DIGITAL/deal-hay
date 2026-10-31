import type { Metadata } from "next"

import { AuthenticatedChatsPage } from "../content"

export const metadata: Metadata = { title: "Cuộc trò chuyện" }

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationSlug: string }>
}) {
  const { conversationSlug } = await params
  return <AuthenticatedChatsPage conversationSlug={conversationSlug} />
}
