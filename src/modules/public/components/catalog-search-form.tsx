import Form from "next/form"
import { SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CATALOG_SEARCH_MAX_LENGTH } from "@/modules/public/lib/catalog-query"

export function CatalogSearchForm({
  action,
  search,
  label,
  placeholder,
  category,
  compact = false,
}: {
  action: string
  search: string
  label: string
  placeholder: string
  category?: string
  compact?: boolean
}) {
  return (
    <Form
      action={action}
      role="search"
      aria-label={label}
      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2"
    >
      <Input
        autoComplete="off"
        aria-label={label}
        defaultValue={search}
        maxLength={CATALOG_SEARCH_MAX_LENGTH}
        name="q"
        placeholder={placeholder}
        startIcon={<SearchIcon />}
        type="search"
      />
      {category ? (
        <Input name="category" type="hidden" value={category} />
      ) : null}
      <Button
        aria-label="Tìm kiếm"
        type="submit"
        className={compact ? "size-10 px-0 lg:w-auto lg:px-4" : undefined}
      >
        {compact ? (
          <SearchIcon aria-hidden="true" className="lg:hidden" />
        ) : null}
        <span className={compact ? "hidden lg:inline" : undefined}>
          Tìm kiếm
        </span>
      </Button>
    </Form>
  )
}
