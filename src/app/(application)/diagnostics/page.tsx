import type { Metadata } from "next"

import { AuthGuard } from "@/components/session-provider"
import { DiagnosticsClient } from "@/modules/diagnostics/components/diagnostics-client"

export const metadata: Metadata = { title: "Độ trễ hệ thống" }

export default function DiagnosticsPage() {
  return (
    <AuthGuard>
      <DiagnosticsClient />
    </AuthGuard>
  )
}
