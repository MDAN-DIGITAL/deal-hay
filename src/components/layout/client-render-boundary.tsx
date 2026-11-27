"use client"

import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import PageLoading from "@/components/layout/page-loading"

const ClientRenderContent = dynamic(
  () =>
    import("@/components/layout/client-render-content").then(
      (module) => module.ClientRenderContent
    ),
  {
    ssr: false,
    loading: () => <PageLoading />,
  }
)

export function ClientRenderBoundary({
  children,
  serverRenderedPaths = [],
}: {
  children: ReactNode
  serverRenderedPaths?: readonly string[]
}) {
  const pathname = usePathname()

  if (serverRenderedPaths.includes(pathname)) return children

  return <ClientRenderContent>{children}</ClientRenderContent>
}
