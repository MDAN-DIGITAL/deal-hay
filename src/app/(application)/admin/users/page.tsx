import type { Metadata } from "next"

import { AuthenticatedAdminUsersPage } from "./content"

export const metadata: Metadata = { title: "Admin người dùng" }

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page } = await searchParams
  return <AuthenticatedAdminUsersPage page={page} />
}
