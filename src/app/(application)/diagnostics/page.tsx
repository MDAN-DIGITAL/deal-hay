import type { Metadata } from "next"

import { AuthGuard } from "@/components/session-provider"
import { DiagnosticsClient } from "@/modules/diagnostics/components/diagnostics-client"

export const metadata: Metadata = { title: "Đo tốc độ máy chủ" }

export default function DiagnosticsPage() {
  return (
    <AuthGuard admin>
      <DiagnosticsClient />
    </AuthGuard>
  )
}
