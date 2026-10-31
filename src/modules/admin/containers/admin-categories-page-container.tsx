"use client"

import { useApiQuery, QueryPlaceholder } from "@/hooks/use-api-query"
import { getAdminCategories } from "@/api/admin/queries"
import { AdminCategoriesClient } from "@/modules/admin/components/admin-categories-client"

export function AdminCategoriesPageContainer() {
  const { data: data, error } = useApiQuery("admin-categories", () =>
    getAdminCategories()
  )
  if (!data) return <QueryPlaceholder error={error} />
  return <AdminCategoriesClient categories={data.categories} />
}
