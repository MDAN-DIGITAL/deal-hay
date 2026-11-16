import type { ReactNode } from "react"
import { AdminWorkspace } from "@/modules/admin/components/admin-workspace"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminWorkspace>{children}</AdminWorkspace>
}
