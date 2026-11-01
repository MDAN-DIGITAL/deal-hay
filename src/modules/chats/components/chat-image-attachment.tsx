"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { FileIcon, PaperclipIcon } from "lucide-react"
import { toast } from "sonner"
import { ImagePreview } from "@/components/image-preview"
import { Button } from "@/components/ui/button"
import { createChatAttachmentCache } from "@/modules/chats/lib/chat-attachment-cache"
import type { ChatMessage } from "@/types/chat"
import { getWssSession, clearWssSession } from "@/lib/wss-session"

async function loadAttachment(messageId: string, signal?: AbortSignal) {
  const session = await getWssSession()
  const response = await fetch(
    `${session.url}/chat-attachments/${encodeURIComponent(messageId)}`,
    {
      headers: {
        Authorization: `Bearer ${session.token}`,
        Accept: "application/octet-stream",
      },
      credentials: "omit",
      redirect: "error",
      signal,
    }
  )
  if (!response.ok) {
    if (response.status === 401) clearWssSession(session.token)
    throw new Error("Không thể tải tệp đính kèm.")
  }
  return response.blob()
}

const AttachmentCacheContext = createContext<ReturnType<
  typeof createChatAttachmentCache
> | null>(null)

export function ChatAttachmentProvider({
  messages,
  children,
}: {
  messages: Iterable<ChatMessage>
  children: ReactNode
}) {
  const [cache] = useState(() => createChatAttachmentCache(loadAttachment))
  useEffect(() => () => cache.clear(), [cache])
  useEffect(() => {
    let stopped = false
    const images = Array.from(messages).filter(
      (message) => message.attachment?.type === "image"
    )
    let index = 0
    const preload = async () => {
      while (!stopped && index < images.length) {
        const message = images[index++]
        await cache.get(message.id).catch(() => {})
      }
    }
    for (let worker = 0; worker < Math.min(4, images.length); worker++)
      void preload()
    return () => {
      stopped = true
    }
  }, [cache, messages])
  return (
    <AttachmentCacheContext.Provider value={cache}>
      {children}
    </AttachmentCacheContext.Provider>
  )
}

export function ChatImageAttachment({
  messageId,
  name,
}: {
  messageId: string
  name: string
}) {
  const cache = useContext(AttachmentCacheContext)
  const [image, setImage] = useState<{ id: string; url: string } | null>(() => {
    const cached = cache?.peek(messageId)
    return cached ? { id: messageId, url: cached.url } : null
  })
  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | undefined
    const request = cache
      ? cache.get(messageId)
      : loadAttachment(messageId, controller.signal).then((blob) => ({
          blob,
          url: URL.createObjectURL(blob),
        }))
    void request
      .then(({ url }) => {
        if (controller.signal.aborted) {
          if (!cache) URL.revokeObjectURL(url)
          return
        }
        if (!cache) objectUrl = url
        setImage({ id: messageId, url })
      })
      .catch(() => {})
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [cache, messageId])
  if (!image || image.id !== messageId)
    return <p className="p-2 text-xs text-muted-foreground">Ảnh đính kèm</p>
  return (
    <ImagePreview
      alt={name}
      className="mb-2"
      sizes="256px"
      src={image.url}
      thumbnailClassName="aspect-video w-64 max-w-full rounded-xl"
    />
  )
}

export function DownloadAttachment({
  messageId,
  name,
  image,
}: {
  messageId: string
  name: string
  image: boolean
}) {
  const cache = useContext(AttachmentCacheContext)
  const [loading, setLoading] = useState(false)
  const download = async () => {
    if (loading) return
    setLoading(true)
    try {
      const blob = cache
        ? (await cache.get(messageId)).blob
        : await loadAttachment(messageId)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = name
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tải tệp.")
    } finally {
      setLoading(false)
    }
  }
  return (
    <Button
      className="max-w-full"
      size="sm"
      variant="outline"
      disabled={loading}
      onClick={() => void download()}
    >
      {image ? <PaperclipIcon /> : <FileIcon />}
      <span className="max-w-52 truncate">
        {loading ? "Đang tải..." : name}
      </span>
    </Button>
  )
}
