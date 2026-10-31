import type { Metadata } from "next"

import { AuthenticatedChatsPage } from "./content"

export const metadata: Metadata = { title: "Tin nhắn" }

export default function ChatsPage() {
  return <AuthenticatedChatsPage />
}
