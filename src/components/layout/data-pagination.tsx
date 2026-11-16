"use client"

import { usePathname, useSearchParams } from "next/navigation"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

function getVisiblePages(current: number, last: number) {
  const pages = new Set([1, last, current - 1, current, current + 1])
  return [...pages]
    .filter((page) => page >= 1 && page <= last)
    .sort((a, b) => a - b)
}

export function DataPagination({
  currentPage = 1,
  lastPage = 1,
  anchor,
}: {
  currentPage?: number
  lastPage?: number
  anchor?: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (lastPage <= 1) return null

  const hrefFor = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (page <= 1) params.delete("page")
    else params.set("page", String(page))
    const query = params.toString()
    const path = query ? `${pathname}?${query}` : pathname
    return anchor ? `${path}#${encodeURIComponent(anchor)}` : path
  }

  const pages = getVisiblePages(currentPage, lastPage)

  return (
    <Pagination className="pt-4">
      <PaginationContent className="max-w-full flex-wrap justify-center gap-0.5 gap-y-2 sm:gap-1">
        <PaginationItem>
          <PaginationPrevious
            className="size-8 p-0! sm:h-9 sm:w-auto sm:px-3!"
            disabled={currentPage <= 1}
            href={hrefFor(Math.max(1, currentPage - 1))}
            text="Trước"
          />
        </PaginationItem>
        {pages.map((page, index) => (
          <PaginationItem key={page} className="flex items-center">
            {index > 0 && page - pages[index - 1] > 1 ? (
              <PaginationEllipsis className="h-8 w-6 sm:size-9" />
            ) : null}
            <PaginationLink
              aria-label={`Trang ${page}`}
              className="size-8 sm:size-9"
              href={hrefFor(page)}
              isActive={page === currentPage}
            >
              {page}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            className="size-8 p-0! sm:h-9 sm:w-auto sm:px-3!"
            disabled={currentPage >= lastPage}
            href={hrefFor(Math.min(lastPage, currentPage + 1))}
            text="Sau"
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
