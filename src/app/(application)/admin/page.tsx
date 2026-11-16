import type { Metadata } from "next"
import { AdminOverview } from "@/modules/admin/components/admin-overview"

export const metadata: Metadata = { title: "Tổng quan quản trị" }

export default function AdminOverviewPage() {
  return <AdminOverview />
}
