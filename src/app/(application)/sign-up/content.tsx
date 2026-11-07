"use client"

import { useSearchParams } from "next/navigation"

import { getSafeAuthRedirect } from "@/lib/auth-redirect"
import { routeQueryValue } from "@/lib/route-query"
import { SignUpPageContainer } from "@/modules/auth/containers/sign-up-page-container"

export function SignUpPageContent() {
  const searchParams = useSearchParams()
  return (
    <SignUpPageContainer
      redirectTo={getSafeAuthRedirect(routeQueryValue(searchParams, "redirect"))}
    />
  )
}
