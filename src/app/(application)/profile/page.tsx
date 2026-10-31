import type { Metadata } from "next"

import { AuthGuard } from "@/components/session-provider"
import { ProfilePageContainer } from "@/modules/profile/containers/profile-page-container"

export const metadata: Metadata = { title: "Hồ sơ của tôi" }

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  return (
    <AuthGuard>
      <ProfilePageContainer tab={tab} />
    </AuthGuard>
  )
}
