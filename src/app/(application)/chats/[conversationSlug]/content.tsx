"use client"

import { useParams } from "next/navigation"

import { AuthenticatedChatsPage } from "../content"

export function ConversationPageContent() {
  const { conversationSlug } = useParams<{ conversationSlug: string }>()
  return <AuthenticatedChatsPage conversationSlug={conversationSlug} />
}
