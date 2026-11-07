"use client"

import { useSearchParams } from "next/navigation"

import { singleRouteQueryValue } from "@/lib/route-query"
import { ResetPasswordPageContainer } from "@/modules/auth/containers/reset-password-page-container"

export function ResetPasswordPageContent() {
  const searchParams = useSearchParams()
  return (
    <ResetPasswordPageContainer
      email={singleRouteQueryValue(searchParams, "email")}
      token={singleRouteQueryValue(searchParams, "token")}
    />
  )
}
