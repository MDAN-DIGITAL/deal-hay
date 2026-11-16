"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import PageLoading from "@/components/layout/page-loading"
import { readResetPasswordLink } from "@/modules/auth/lib/reset-password-link"
import { ResetPasswordPageContainer } from "@/modules/auth/containers/reset-password-page-container"

export function ResetPasswordPageContent() {
  const query = useSearchParams().toString()
  const capturedQuery = useRef<string | null>(null)
  const [link, setLink] = useState<ReturnType<
    typeof readResetPasswordLink
  > | null>(null)

  useEffect(() => {
    if (capturedQuery.current === query) return
    if (
      capturedQuery.current !== null &&
      !new URLSearchParams(query).has("token")
    ) {
      capturedQuery.current = query
      return
    }
    capturedQuery.current = query
    const captured = readResetPasswordLink(window.location.href)
    setLink(captured)
    window.history.replaceState(window.history.state, "", captured.cleanHref)
  }, [query])

  if (!link) return <PageLoading />
  return (
    <ResetPasswordPageContainer
      key={link.token ?? "invalid-link"}
      email={link.email}
      token={link.token}
    />
  )
}
