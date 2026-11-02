"use client"

import { useSession } from "@/components/session-provider"
import { getRealtimeConfig } from "@/api/chats/queries"
import { useApiQuery } from "@/hooks/use-api-query"
import { RealtimeProvider } from "@/components/realtime-provider"
import { FloatingChat } from "@/modules/chats/components/floating-chat"

export function RealtimeRoot({ children }: { children: React.ReactNode }) {
  const { user, unreadCounts } = useSession()
  const { data: config } = useApiQuery(
    JSON.stringify(["realtime", user?.id]),
    async () => (user ? getRealtimeConfig() : null)
  )
  return (
    <RealtimeProvider
      key={user?.id ?? "guest"}
      config={config ?? null}
      currentUserId={user?.id}
      initialUnreadCounts={unreadCounts}
    >
      {children}
      <FloatingChat />
    </RealtimeProvider>
  )
}
