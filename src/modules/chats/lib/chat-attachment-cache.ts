/** A chat-page scoped cache keeps protected images ready when changing conversations. */
export function createChatAttachmentCache(
  load: (id: string, signal: AbortSignal) => Promise<Blob>,
  objectUrls: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL
) {
  const entries = new Map<
    string,
    {
      controller: AbortController
      result: Promise<{ blob: Blob; url: string }>
      url?: string
      value?: { blob: Blob; url: string }
    }
  >()
  return {
    get(id: string) {
      const existing = entries.get(id)
      if (existing) return existing.result
      const controller = new AbortController()
      const entry = {
        controller,
        url: undefined as string | undefined,
        value: undefined as { blob: Blob; url: string } | undefined,
        result: Promise.resolve(null) as unknown as Promise<{
          blob: Blob
          url: string
        }>,
      }
      entry.result = load(id, controller.signal)
        .then((blob) => {
          controller.signal.throwIfAborted()
          entry.url = objectUrls.createObjectURL(blob)
          entry.value = { blob, url: entry.url }
          return entry.value
        })
        .catch((error: unknown) => {
          if (entries.get(id) === entry) entries.delete(id)
          throw error
        })
      entries.set(id, entry)
      return entry.result
    },
    peek(id: string) {
      return entries.get(id)?.value
    },
    clear() {
      for (const entry of entries.values()) {
        entry.controller.abort()
        if (entry.url) objectUrls.revokeObjectURL(entry.url)
      }
      entries.clear()
    },
  }
}
