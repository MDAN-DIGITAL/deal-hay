// Safari 15.6 can cancel fetches, but lacks these AbortSignal factories.
if (typeof AbortSignal.timeout !== "function") {
  AbortSignal.timeout = (milliseconds) => {
    const controller = new AbortController()
    setTimeout(() => {
      controller.abort(
        new DOMException("The operation timed out.", "TimeoutError")
      )
    }, milliseconds)
    return controller.signal
  }
}

if (typeof AbortSignal.any !== "function") {
  AbortSignal.any = (signals) => {
    const controller = new AbortController()
    const abortedSignal = signals.find((signal) => signal.aborted)
    if (abortedSignal) {
      controller.abort(abortedSignal.reason)
      return controller.signal
    }

    for (const signal of signals) {
      signal.addEventListener("abort", () => controller.abort(signal.reason), {
        signal: controller.signal,
      })
    }
    return controller.signal
  }
}
