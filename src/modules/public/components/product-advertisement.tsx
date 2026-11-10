"use client"

import { useEffect, useState } from "react"
import {
  LoaderCircleIcon,
  RefreshCwIcon,
  TvMinimalPlayIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Surface } from "@/components/ui/surface"
import { startAdcashAutoTag } from "@/lib/adcash-autotag"

export function ProductAdvertisement() {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{
    attempt: number
    error?: string
  } | null>(null)
  const loading = result?.attempt !== attempt
  const error = !loading ? result?.error : undefined

  useEffect(() => {
    const controller = new AbortController()
    startAdcashAutoTag(document, controller.signal).then(
      () => {
        if (!controller.signal.aborted) setResult({ attempt })
      },
      () => {
        if (!controller.signal.aborted) {
          setResult({
            attempt,
            error:
              "Chưa tải được quảng cáo. Bạn có thể thử lại hoặc tiếp tục thanh toán.",
          })
        }
      }
    )
    return () => controller.abort()
  }, [attempt])

  return (
    <Surface
      variant="muted"
      padding="default"
      className="space-y-3"
      aria-labelledby="product-advertisement-title"
    >
      <p
        id="product-advertisement-title"
        className="flex items-center gap-2 font-medium"
      >
        <TvMinimalPlayIcon
          className="size-4 shrink-0 text-primary"
          aria-hidden="true"
        />
        Quảng cáo Adcash
      </p>
      <div aria-live="polite" aria-atomic="true">
        {loading ? (
          <p
            className="flex items-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            <LoaderCircleIcon
              className="size-4 shrink-0 animate-spin"
              aria-hidden="true"
            />
            Đang tải quảng cáo…
          </p>
        ) : error ? (
          <p className="text-sm text-muted-foreground" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Quảng cáo được phân phối tự động và có thể xuất hiện dạng cửa sổ
            hoặc lớp phủ.
          </p>
        )}
      </div>
      {error ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setAttempt((value) => value + 1)}
        >
          <RefreshCwIcon aria-hidden="true" /> Thử tải lại quảng cáo
        </Button>
      ) : null}
      <p className="text-xs leading-5 text-muted-foreground">
        Xem quảng cáo là tùy chọn. Bạn có thể tiếp tục thanh toán khi sẵn sàng.
      </p>
    </Surface>
  )
}
