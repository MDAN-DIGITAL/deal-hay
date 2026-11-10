import { ADCASH_AUTOTAG_ZONE_ID, ADCASH_SCRIPT_URL } from "@/config/advertising"

export type AdcashFailureReason =
  | "browser_unavailable"
  | "script_conflict"
  | "script_unreachable"
  | "script_timeout"
  | "library_unavailable"
  | "initialization_failed"

export class AdcashError extends Error {
  constructor(
    public readonly reason: AdcashFailureReason,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = "AdcashError"
  }
}

type AdcashLibrary = {
  runAutoTag: (options: { zoneId: string }) => void
}
type DocumentState = {
  loading?: Promise<AdcashLibrary>
  started: boolean
}

const documents = new WeakMap<Document, DocumentState>()

function libraryFor(document: Document): AdcashLibrary | undefined {
  const library = (
    document.defaultView as (Window & { aclib?: AdcashLibrary }) | null
  )?.aclib
  return typeof library?.runAutoTag === "function" ? library : undefined
}

function loadLibrary(
  document: Document,
  state: DocumentState
): Promise<AdcashLibrary> {
  const installed = libraryFor(document)
  if (installed) return Promise.resolve(installed)
  if (state.loading) return state.loading

  const loading = new Promise<AdcashLibrary>((resolve, reject) => {
    const view = document.defaultView
    if (!view) {
      reject(
        new AdcashError(
          "browser_unavailable",
          "Quảng cáo chỉ khả dụng trong trình duyệt."
        )
      )
      return
    }

    const existing =
      document.getElementById("aclib") ??
      Array.from(document.scripts).find(
        (script) => script.src === ADCASH_SCRIPT_URL
      )
    if (
      existing &&
      (existing.tagName !== "SCRIPT" ||
        (existing as HTMLScriptElement).src !== ADCASH_SCRIPT_URL)
    ) {
      reject(
        new AdcashError(
          "script_conflict",
          "Không thể khởi tạo quảng cáo. Vui lòng tải lại trang."
        )
      )
      return
    }

    const script = (existing ??
      document.createElement("script")) as HTMLScriptElement
    const cleanup = () => {
      view.clearTimeout(timeout)
      script.removeEventListener("load", onLoad)
      script.removeEventListener("error", onError)
    }
    const fail = (reason: AdcashFailureReason, message: string) => {
      cleanup()
      script.remove()
      reject(new AdcashError(reason, message))
    }
    const onLoad = () => {
      const library = libraryFor(document)
      if (!library) {
        fail(
          "library_unavailable",
          "Dịch vụ quảng cáo chưa sẵn sàng. Vui lòng thử lại."
        )
        return
      }
      cleanup()
      resolve(library)
    }
    const onError = () =>
      fail(
        "script_unreachable",
        "Không tải được quảng cáo. Vui lòng thử lại hoặc kiểm tra trình chặn quảng cáo."
      )

    script.addEventListener("load", onLoad)
    script.addEventListener("error", onError)
    const timeout = view.setTimeout(
      () =>
        fail(
          "script_timeout",
          "Quảng cáo tải quá lâu. Vui lòng thử lại hoặc tiếp tục mua hàng."
        ),
      15_000
    )

    if (!existing) {
      try {
        script.id = "aclib"
        script.type = "text/javascript"
        script.async = true
        script.src = ADCASH_SCRIPT_URL
        document.head.appendChild(script)
      } catch {
        onError()
      }
    }
  })
  state.loading = loading.catch((error) => {
    state.loading = undefined
    throw error
  })
  return state.loading
}

function aborted(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException("Đã hủy tải quảng cáo.", "AbortError")
}

function waitForLibrary(
  loading: Promise<AdcashLibrary>,
  signal?: AbortSignal
): Promise<AdcashLibrary> {
  if (!signal) return loading
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort)
      reject(aborted(signal))
    }
    signal.addEventListener("abort", onAbort, { once: true })
    loading.then(
      (library) => {
        signal.removeEventListener("abort", onAbort)
        resolve(library)
      },
      (error) => {
        signal.removeEventListener("abort", onAbort)
        reject(error)
      }
    )
    if (signal.aborted) onAbort()
  })
}

/** Starts automatic ad placement only; loading a tag does not earn a discount. */
export async function startAdcashAutoTag(
  document: Document,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted) throw aborted(signal)
  let state = documents.get(document)
  if (!state) {
    state = { started: false }
    documents.set(document, state)
  }
  if (state.started) return

  const library = await waitForLibrary(loadLibrary(document, state), signal)
  if (signal?.aborted) throw aborted(signal)
  if (state.started) return

  state.started = true
  try {
    library.runAutoTag({ zoneId: ADCASH_AUTOTAG_ZONE_ID })
  } catch (cause) {
    state.started = false
    throw new AdcashError(
      "initialization_failed",
      "Không mở được quảng cáo. Vui lòng thử lại.",
      { cause }
    )
  }
}
