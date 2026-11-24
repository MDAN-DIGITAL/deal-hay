"use client"

import { useSearchParams } from "next/navigation"

import { AuthGuard } from "@/components/session-provider"
import { getSafeAuthRedirect } from "@/lib/auth-redirect"
import { routeQueryValue, singleRouteQueryValue } from "@/lib/route-query"
import { ProductInterestsForm } from "@/modules/auth/components/product-interests-form"

export function ProductInterestsPageContent() {
  const searchParams = useSearchParams()
  const destination = getSafeAuthRedirect(
    routeQueryValue(searchParams, "redirect")
  )
  const registered = singleRouteQueryValue(searchParams, "welcome") === "1"

  return (
    <AuthGuard>
      {(user) => (
        <ProductInterestsForm
          key={user.id}
          destination={destination}
          registered={registered}
        />
      )}
    </AuthGuard>
  )
}
