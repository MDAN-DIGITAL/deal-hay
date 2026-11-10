"use client"

import { useEffect, useState } from "react"
import {
  LoaderCircleIcon,
  RefreshCwIcon,
  TvMinimalPlayIcon,
  WifiOffIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  AdcashError,
  startAdcashAutoTag,
  type AdcashFailureReason,
} from "@/lib/adcash-autotag"

function failureContent(reason: AdcashFailureReason | "unknown") {
  if (reason === "script_unreachable") {
    return {
      title: "Chưa kết nối được quảng cáo",
      description:
        "Kiểm tra kết nối hoặc trình chặn nội dung rồi thử lại. Bạn vẫn có thể tiếp tục thanh toán.",
    }
  }
  if (reason === "script_timeout") {
    return {
      title: "Quảng cáo tải lâu hơn dự kiến",
      description: "Bạn có thể thử tải lại hoặc tiếp tục thanh toán.",
    }
  }
  return {
    title: "Quảng cáo chưa sẵn sàng",
    description: "Vui lòng thử lại sau. Bạn vẫn có thể tiếp tục thanh toán.",
  }
}

export function ProductAdvertisement() {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{
    attempt: number
    reason?: AdcashFailureReason | "unknown"
  } | null>(null)
  const loading = result?.attempt !== attempt
  const reason = !loading ? result?.reason : undefined
  const failure = reason ? failureContent(reason) : undefined

  useEffect(() => {
    const controller = new AbortController()
    startAdcashAutoTag(document, controller.signal).then(
      () => {
        if (!controller.signal.aborted) setResult({ attempt })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setResult({
            attempt,
            reason: error instanceof AdcashError ? error.reason : "unknown",
          })
        }
      }
    )
    return () => controller.abort()
  }, [attempt])

  return (
    <Empty
      className="min-h-48 rounded-none border-0 bg-transparent p-0 sm:min-h-56 sm:p-0"
      data-ad-status={loading ? "loading" : reason ? "error" : "initialized"}
      data-ad-error={reason}
      aria-live="polite"
      aria-atomic="true"
    >
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {loading ? (
            <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          ) : failure ? (
            <WifiOffIcon aria-hidden="true" />
          ) : (
            <TvMinimalPlayIcon aria-hidden="true" />
          )}
        </EmptyMedia>
        <EmptyTitle>
          {loading
            ? "Đang kết nối quảng cáo"
            : (failure?.title ?? "Quảng cáo mở tự động")}
        </EmptyTitle>
        <EmptyDescription>
          {loading
            ? "Vui lòng chờ trong giây lát…"
            : (failure?.description ??
              "Quảng cáo có thể xuất hiện ở cửa sổ hoặc lớp phủ của trình duyệt. Bạn có thể tiếp tục mua hàng khi sẵn sàng.")}
        </EmptyDescription>
      </EmptyHeader>
      {failure ? (
        <EmptyContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => setAttempt((value) => value + 1)}
          >
            <RefreshCwIcon aria-hidden="true" /> Thử lại
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}
