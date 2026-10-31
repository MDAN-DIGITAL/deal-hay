"use client"

import { useApiQuery, QueryPlaceholder } from "@/hooks/use-api-query"
import { getDiscountCodes } from "@/api/discount-codes/queries"
import { DiscountCodesPageClient } from "@/modules/discount-codes/components/discount-codes-page-client"

export function DiscountCodesPageContainer() {
  const { data: response, error } = useApiQuery("discount-codes", () =>
    getDiscountCodes()
  )
  if (!response) return <QueryPlaceholder error={error} />
  return <DiscountCodesPageClient codes={response.discount_codes} />
}
