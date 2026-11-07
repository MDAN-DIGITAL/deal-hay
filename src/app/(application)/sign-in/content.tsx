"use client"

import { useSearchParams } from "next/navigation"

import { getSafeAuthRedirect } from "@/lib/auth-redirect"
import { routeQueryValue } from "@/lib/route-query"
import { SignInPageContainer } from "@/modules/auth/containers/sign-in-page-container"

export function SignInPageContent() {
  const searchParams = useSearchParams()
  return (
    <SignInPageContainer
      redirectTo={getSafeAuthRedirect(routeQueryValue(searchParams, "redirect"))}
    />
  )
}
