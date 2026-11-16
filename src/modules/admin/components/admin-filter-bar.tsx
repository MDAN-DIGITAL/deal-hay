"use client"

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SearchIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Surface } from "@/components/ui/surface"
import { adminFilterHref } from "@/modules/admin/lib/admin-navigation"

export function AdminFilterBar({
  searchPlaceholder,
  fields = [],
}: {
  searchPlaceholder?: string
  fields?: {
    key: string
    label: string
    options: { value: string; label: string }[]
  }[]
}) {
  const query = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const [search, setSearch] = useState(query.get("search") ?? "")
  const change = (values: Record<string, string>) =>
    router.push(adminFilterHref(pathname, query.toString(), values), {
      scroll: false,
    })
  const filtered = Boolean(
    query.get("search") ||
    fields.some(
      (field) => query.get(field.key) && query.get(field.key) !== "all"
    )
  )

  return (
    <Surface
      variant="muted"
      className="flex flex-col gap-3 lg:flex-row lg:items-center"
    >
      {searchPlaceholder ? (
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            change({ search })
          }}
        >
          <InputGroup variant="search" className="min-w-0 flex-1">
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </InputGroup>
          <Button type="submit" variant="outline">
            Tìm kiếm
          </Button>
        </form>
      ) : null}
      <div className="flex min-w-0 flex-wrap gap-2">
        {fields.map((field) => (
          <Select
            key={field.key}
            items={field.options}
            value={query.get(field.key) || "all"}
            onValueChange={(value) => change({ [field.key]: value ?? "all" })}
          >
            <SelectTrigger
              aria-label={field.label}
              className="w-full sm:w-auto sm:min-w-40"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {filtered ? (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("")
              change(
                Object.fromEntries(
                  ["search", ...fields.map((field) => field.key)].map((key) => [
                    key,
                    "",
                  ])
                )
              )
            }}
          >
            <XIcon aria-hidden="true" />
            Xóa bộ lọc
          </Button>
        ) : null}
      </div>
    </Surface>
  )
}
