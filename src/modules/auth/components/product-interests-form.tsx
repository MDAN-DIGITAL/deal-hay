"use client"

import { BadgeCheckIcon, CheckIcon, SparklesIcon } from "lucide-react"
import { useState, useTransition, type FormEvent } from "react"

import { ApiError } from "@/api/client"
import { updateProductInterests } from "@/api/profile/mutations"
import { getProductInterests } from "@/api/profile/queries"
import { FormSubmitButton } from "@/components/form-submit-button"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldError, FieldLabel, FieldSet } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { QueryPlaceholder, useApiQuery } from "@/hooks/use-api-query"
import { invalidateQueries } from "@/lib/query-cache"
import { getSessionId } from "@/lib/session"

export function ProductInterestsForm({
  destination,
  registered,
}: {
  destination: string
  registered: boolean
}) {
  const { data, error } = useApiQuery("product-interests", getProductInterests)
  const [draftIds, setDraftIds] = useState<string[]>()
  const [saveError, setSaveError] = useState<string>()
  const [isPending, startTransition] = useTransition()

  const categories = data?.categories ?? []
  const noCategories = Boolean(data && categories.length === 0 && !error)
  const savedIds = data?.interested_category_ids ?? []
  const draft = new Set(draftIds ?? savedIds)
  const selectedIds = categories
    .map(({ id }) => id)
    .filter((id) => draft.has(id))
  const hasChanges =
    selectedIds.length !== savedIds.length ||
    selectedIds.some((id) => !savedIds.includes(id))
  const canSave = Boolean(data && !error && hasChanges)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const session = getSessionId()
    if (!canSave || isPending || !session) return

    setSaveError(undefined)
    startTransition(async () => {
      try {
        await updateProductInterests(selectedIds, session)
        if (getSessionId() === session) window.location.replace(destination)
      } catch (error) {
        if (getSessionId() !== session) return
        if (error instanceof ApiError && error.status === 422) {
          setSaveError(
            "Một số danh mục vừa thay đổi. Vui lòng kiểm tra lại lựa chọn."
          )
          invalidateQueries()
          return
        }
        setSaveError(
          error instanceof ApiError
            ? error.message
            : "Không thể lưu danh mục. Vui lòng thử lại."
        )
      }
    })
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-2xl py-2 sm:py-8">
      <Card>
        <CardHeader className="gap-2">
          {registered ? (
            <p className="mb-1 flex items-center gap-2 font-medium text-primary">
              <BadgeCheckIcon className="size-5" aria-hidden="true" />
              Đăng ký thành công
            </p>
          ) : null}
          <CardTitle
            as="h1"
            id="interests-title"
            className="text-2xl sm:text-3xl"
          >
            Bạn quan tâm đến danh mục nào?
          </CardTitle>
          <CardDescription id="interests-description">
            Chọn những danh mục bạn thích để ưu tiên sản phẩm phù hợp trên trang
            chủ.
          </CardDescription>
        </CardHeader>

        <CardContent className="gap-4">
          {error ? (
            <QueryPlaceholder error={error} />
          ) : !data ? (
            <div
              role="status"
              aria-label="Đang tải danh mục"
              className="grid gap-2 sm:grid-cols-2"
            >
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : categories.length === 0 ? (
            <p
              role="status"
              className="rounded-lg bg-muted p-4 text-muted-foreground"
            >
              Hiện chưa có danh mục để chọn. Bạn có thể tiếp tục ngay.
            </p>
          ) : (
            <>
              <FieldSet
                aria-labelledby="interests-title"
                aria-describedby="interests-description"
                className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2"
                disabled={isPending}
              >
                {categories.map(({ id, name }) => (
                  <FieldLabel
                    key={id}
                    htmlFor={id}
                    className="min-h-12 w-full cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/60 has-data-checked:hover:bg-primary/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50"
                  >
                    <Checkbox
                      id={id}
                      checked={draft.has(id)}
                      disabled={isPending}
                      onCheckedChange={(checked) => {
                        setSaveError(undefined)
                        setDraftIds(
                          checked
                            ? [...selectedIds, id]
                            : selectedIds.filter((value) => value !== id)
                        )
                      }}
                    />
                    <span className="min-w-0 wrap-anywhere">{name}</span>
                  </FieldLabel>
                ))}
              </FieldSet>
              <p role="status" className="text-muted-foreground">
                {selectedIds.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CheckIcon
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                    Đã chọn {selectedIds.length} danh mục
                  </span>
                ) : (
                  "Bạn có thể chọn nhiều danh mục."
                )}
              </p>
            </>
          )}
          <FieldError>{saveError}</FieldError>
        </CardContent>

        <CardFooter className="flex-wrap justify-end gap-2 border-t">
          <Button
            type="button"
            variant={noCategories ? "default" : "outline"}
            className={noCategories ? "w-full sm:w-auto" : undefined}
            disabled={isPending}
            onClick={() => window.location.replace(destination)}
          >
            {noCategories ? "Tiếp tục" : "Bỏ qua"}
          </Button>
          {!noCategories ? (
            <FormSubmitButton
              idleText="Lưu và tiếp tục"
              pendingText="Đang lưu..."
              startIcon={<SparklesIcon />}
              pending={isPending}
              disabled={!canSave}
              className="flex-1 sm:flex-none"
            />
          ) : null}
        </CardFooter>
      </Card>
    </form>
  )
}
