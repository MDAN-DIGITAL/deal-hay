"use client"

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AtSignIcon,
  LoaderCircleIcon,
  PaperclipIcon,
  PlusIcon,
  RotateCcwIcon,
  SendIcon,
  XIcon,
} from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { SelectedFilePreview } from "@/components/selected-file-preview"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { runUploadAction } from "@/lib/form-utils"
import { getAccessToken } from "@/lib/session"
import {
  CHAT_ATTACHMENT_ACCEPT,
  chatAttachmentFileSchema,
} from "@/lib/validation"
import { ImageUploadProgress } from "@/components/image-upload-progress"
import { useImageUpload } from "@/hooks/use-image-upload"
import { sendMessageAction } from "@/modules/chats/actions"
import {
  chatSendAttempts,
  createChatSendQueue,
  prepareChatSendAttempt,
  prepareChatImageAttempts,
  type ChatSendBatch,
} from "@/modules/chats/lib/chat-send-attempt"
import { uploadChatFile } from "@/lib/chat-upload"
import { ChatEmojiPicker } from "@/modules/chats/components/chat-emoji-picker"
import { ChatReplyPreview } from "@/modules/chats/components/chat-reply-preview"
import {
  sendMessageSchema,
  type SendMessageValues,
} from "@/modules/chats/schemas/chats"
import type { ChatMessage, ChatReply } from "@/types/chat"

export function ChatComposer({
  conversationSlug,
  socketId,
  replyTo,
  onCancelReply,
  onSent,
  admins = [],
  confirmedClientMessageIds = [],
}: {
  conversationSlug: string
  admins?: { id: string; name: string }[]
  socketId?: string
  replyTo?: ChatReply | null
  onCancelReply?: () => void
  onSent: (message: ChatMessage, replyToId?: string | null) => void
  confirmedClientMessageIds?: string[]
}) {
  const { prepareUploads, uploadProgress } = useImageUpload()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const submittingRef = useRef(false)
  const queueRef = useRef<ReturnType<typeof createChatSendQueue> | null>(null)
  const callbacksRef = useRef({ socketId, onSent })
  const [accountToken] = useState(getAccessToken)
  const [outgoing, setOutgoing] = useState<ChatSendBatch[]>([])
  const [showAdminPicker, setShowAdminPicker] = useState(false)
  const [showMoreActions, setShowMoreActions] = useState(false)
  const form = useForm<SendMessageValues>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: { body: "", attachments: [], mention_admin_ids: [] },
  })
  const attachments = useWatch({ control: form.control, name: "attachments" })
  const body = useWatch({ control: form.control, name: "body" }) ?? ""
  const mentionAdminIds =
    useWatch({ control: form.control, name: "mention_admin_ids" }) ?? []
  const canSend =
    body.trim().length > 0 ||
    attachments.length > 0 ||
    mentionAdminIds.length > 0
  useEffect(() => {
    let active = true
    const isCurrent = () => active && getAccessToken() === accountToken
    queueRef.current = createChatSendQueue({
      isCurrent,
      onChange: setOutgoing,
      prepare: async (attempts) => {
        const state = await runUploadAction(async () => {
          await prepareChatImageAttempts(attempts, (input) =>
            prepareUploads(input, "chat", isCurrent)
          )
          return { success: true as const, message: "" }
        })
        if (!state.success)
          throw new Error(
            Object.values(state.errors ?? {})
              .flat()
              .find(Boolean) || state.message
          )
      },
      send: async (attempt, isUnconfirmed) => {
        const state = await runUploadAction(async () => {
          const payload = await prepareChatSendAttempt(
            attempt,
            async (input) => {
              const prepared = await prepareUploads(input, "chat", isCurrent)
              const file = prepared.get("attachment")
              if (file instanceof File)
                prepared.set(
                  "attachment",
                  await uploadChatFile(file, isCurrent)
                )
              return prepared
            }
          )
          if (!isCurrent()) throw new Error("Phiên đăng nhập đã thay đổi.")
          const socketId = callbacksRef.current.socketId
          if (socketId) payload.set("socket_id", socketId)
          else payload.delete("socket_id")
          return sendMessageAction(attempt.conversationSlug, payload, isCurrent)
        })
        if (!state.success || !state.data)
          throw new Error(
            Object.values(state.errors ?? {})
              .flat()
              .find(Boolean) ||
              state.message ||
              "Không thể gửi tin nhắn. Vui lòng thử lại."
          )
        if (isCurrent() && isUnconfirmed())
          callbacksRef.current.onSent(state.data, attempt.replyToId ?? null)
      },
    })
    return () => {
      active = false
      queueRef.current = null
    }
  }, [accountToken, prepareUploads])

  useEffect(() => {
    callbacksRef.current = { socketId, onSent }
  }, [socketId, onSent])

  useEffect(() => {
    queueRef.current?.acknowledge(confirmedClientMessageIds)
  }, [confirmedClientMessageIds])

  const chooseFiles = () => {
    if (!fileInputRef.current) return
    fileInputRef.current.value = ""
    fileInputRef.current.click()
    setShowMoreActions(false)
  }

  useEffect(() => {
    if (replyTo?.id) textareaRef.current?.focus()
    form.clearErrors("reply_to_id")
  }, [form, replyTo?.id])

  const addFiles = (files: File[]) => {
    const current = form.getValues("attachments")
    if (current.length + files.length > 50) {
      toast.error("Mỗi lần được gửi tối đa 50 tệp.")
      return
    }
    const valid: File[] = []
    for (const file of files) {
      const parsed = chatAttachmentFileSchema(
        "Tệp đính kèm không hợp lệ."
      ).safeParse(file)
      if (!parsed.success) {
        toast.error(
          parsed.error.issues[0]?.message || "Không thể thêm tệp này."
        )
        return
      }
      valid.push(parsed.data)
    }
    form.setValue("attachments", [...current, ...valid], {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const pasteImage = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(event.clipboardData.items ?? [])
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null)
    const images = items.length
      ? items
      : Array.from(event.clipboardData.files ?? []).filter((file) =>
          file.type.startsWith("image/")
        )
    if (!images.length) return
    event.preventDefault()
    addFiles(images)
  }

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current
    const body = form.getValues("body") ?? ""
    const start = textarea?.selectionStart ?? body.length
    const end = textarea?.selectionEnd ?? body.length
    const nextBody = body.slice(0, start) + emoji + body.slice(end)

    form.setValue("body", nextBody, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })

    requestAnimationFrame(() => {
      if (!textarea?.isConnected) return
      textarea.focus()
      textarea.setSelectionRange(start + emoji.length, start + emoji.length)
    })
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    // Validation is synchronous so the accepted snapshot is cleared before the next keystroke.
    const parsed = sendMessageSchema.safeParse(form.getValues())
    if (!parsed.success) {
      submittingRef.current = false
      void form.trigger()
      return
    }
    try {
      const values = parsed.data
      const attempts = chatSendAttempts([], {
        conversationSlug,
        body: values.body,
        attachments: values.attachments,
        replyToId: replyTo?.id,
        mentionAdminIds: values.mention_admin_ids,
      })
      if (!queueRef.current?.enqueue(attempts)) return
      form.reset({ body: "", attachments: [], mention_admin_ids: [] })
      if (replyTo) onCancelReply?.()
      setShowMoreActions(false)
      textareaRef.current?.focus()
    } finally {
      submittingRef.current = false
    }
  }

  return (
    <Form {...form}>
      <form
        className="shrink-0 border-t border-border/70 bg-card pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pt-3"
        noValidate
        onSubmit={onSubmit}
      >
        <div className="mx-auto w-full max-w-[920px] px-3 sm:px-6">
          {outgoing.length ? (
            <ItemGroup
              aria-label="Tin nhắn chờ gửi"
              aria-live="polite"
              className="mb-2 max-h-40 overflow-auto"
            >
              {outgoing.map((batch) => (
                <Item key={batch.id} role="listitem" size="xs" variant="muted">
                  <ItemContent className="min-w-0">
                    <ItemTitle className="max-w-full">
                      {batch.attempts[0]?.body ||
                        batch.attempts[0]?.attachment?.name ||
                        "Tin nhắn tag admin"}
                    </ItemTitle>
                    {batch.attempts.some((attempt) => attempt.attachment) ? (
                      <ItemDescription>
                        {
                          batch.attempts.filter((attempt) => attempt.attachment)
                            .length
                        }{" "}
                        tệp đính kèm
                      </ItemDescription>
                    ) : null}
                    {batch.error ? (
                      <ItemDescription
                        className="text-destructive"
                        role="alert"
                      >
                        {batch.error}
                      </ItemDescription>
                    ) : null}
                  </ItemContent>
                  <ItemActions>
                    <Badge
                      variant={
                        batch.status === "failed" ? "destructive" : "secondary"
                      }
                    >
                      {batch.status === "sending" ? (
                        <LoaderCircleIcon className="animate-spin" />
                      ) : null}
                      {batch.status === "failed"
                        ? "Chưa gửi"
                        : batch.status === "sending"
                          ? "Đang gửi"
                          : "Chờ gửi"}
                    </Badge>
                    {batch.status === "failed" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => queueRef.current?.retry(batch.id)}
                      >
                        <RotateCcwIcon /> Gửi lại
                      </Button>
                    ) : null}
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          ) : null}
          {replyTo ? (
            <ChatReplyPreview
              className="mb-2 max-w-none"
              reply={replyTo}
              onCancel={onCancelReply}
            />
          ) : null}
          {form.formState.errors.reply_to_id?.message ? (
            <p className="mb-2 text-sm text-destructive" role="alert">
              {form.formState.errors.reply_to_id.message}
            </p>
          ) : null}
          {attachments.length ? (
            <div className="mb-2 flex max-h-36 gap-2 overflow-auto">
              {attachments.map((file, index) => (
                <SelectedFilePreview
                  key={index}
                  compact
                  className="w-56 shrink-0"
                  file={file}
                  onRemove={() =>
                    form.setValue(
                      "attachments",
                      attachments.filter((_, position) => position !== index),
                      { shouldValidate: true }
                    )
                  }
                />
              ))}
            </div>
          ) : null}
          {mentionAdminIds.length ? (
            <div className="mb-2 flex flex-wrap gap-1">
              {mentionAdminIds.map((id) => (
                <Button
                  key={id}
                  size="sm"
                  variant="secondary"
                  type="button"
                  aria-label={`Bỏ tag ${admins.find((admin) => admin.id === id)?.name ?? "admin"}`}
                  onClick={() =>
                    form.setValue(
                      "mention_admin_ids",
                      mentionAdminIds.filter((item) => item !== id),
                      { shouldValidate: true }
                    )
                  }
                >
                  @{admins.find((admin) => admin.id === id)?.name ?? "Admin"}
                  <XIcon className="size-3" />
                </Button>
              ))}
            </div>
          ) : null}
          {showAdminPicker ? (
            <div className="mb-2 max-h-40 space-y-1 overflow-auto rounded-xl border border-border/70 bg-background p-2">
              <p className="px-2 text-xs text-muted-foreground">
                Tag admin để mời vào cuộc trò chuyện
              </p>
              {admins.length ? (
                admins.map((admin) => (
                  <Label
                    key={admin.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      aria-label={`@${admin.name}`}
                      checked={mentionAdminIds.includes(admin.id)}
                      onCheckedChange={(checked) =>
                        form.setValue(
                          "mention_admin_ids",
                          checked
                            ? [...mentionAdminIds, admin.id]
                            : mentionAdminIds.filter((id) => id !== admin.id),
                          { shouldValidate: true }
                        )
                      }
                    />
                    @{admin.name}
                  </Label>
                ))
              ) : (
                <p className="px-2 py-1 text-sm text-muted-foreground">
                  Chưa có admin đang hoạt động.
                </p>
              )}
            </div>
          ) : null}
          {form.formState.errors.mention_admin_ids?.message ? (
            <p className="mb-2 text-sm text-destructive" role="alert">
              {form.formState.errors.mention_admin_ids.message}
            </p>
          ) : null}
          <ImageUploadProgress
            progress={
              outgoing.some((batch) => batch.status === "sending")
                ? uploadProgress
                : null
            }
          />
          {showMoreActions ? (
            <div
              className="mb-2 flex gap-2 sm:hidden"
              role="group"
              aria-label="Thêm vào tin nhắn"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={chooseFiles}
              >
                <PaperclipIcon /> Ảnh / tệp
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAdminPicker((current) => !current)
                  setShowMoreActions(false)
                }}
              >
                <AtSignIcon /> Tag admin
              </Button>
            </div>
          ) : null}
          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="sr-only">Nội dung tin nhắn</FormLabel>
                <FormControl>
                  <InputGroup variant="composer">
                    <InputGroupAddon
                      align="inline-start"
                      className="gap-0 self-end py-0.5 pl-0.5 has-[>button]:ml-0 [&_button]:size-10 [&_button]:rounded-xl"
                    >
                      <InputGroupButton
                        aria-label="Thêm ảnh, tệp hoặc tag admin"
                        title="Thêm vào tin nhắn"
                        className="size-10 rounded-xl text-muted-foreground sm:hidden"
                        size="icon-sm"
                        aria-expanded={showMoreActions}
                        onClick={() =>
                          setShowMoreActions((current) => !current)
                        }
                      >
                        <PlusIcon />
                      </InputGroupButton>
                      <InputGroupButton
                        aria-label="Đính kèm tệp"
                        className="hidden size-10 rounded-xl text-muted-foreground hover:text-foreground sm:flex"
                        size="icon-sm"
                        title="Đính kèm tệp"
                        onClick={chooseFiles}
                      >
                        <PaperclipIcon />
                      </InputGroupButton>
                      <InputGroupButton
                        aria-label="Tag admin"
                        title="Tag admin"
                        className={
                          showAdminPicker || mentionAdminIds.length
                            ? "hidden size-10 rounded-xl bg-primary/10 text-primary sm:flex"
                            : "hidden size-10 rounded-xl text-muted-foreground hover:text-foreground sm:flex"
                        }
                        size="icon-sm"
                        aria-expanded={showAdminPicker}
                        onClick={() =>
                          setShowAdminPicker((current) => !current)
                        }
                      >
                        <AtSignIcon />
                      </InputGroupButton>
                      <ChatEmojiPicker
                        focusTarget={textareaRef}
                        onSelect={insertEmoji}
                      />
                    </InputGroupAddon>
                    <InputGroupTextarea
                      aria-label="Nội dung tin nhắn"
                      className="max-h-32 min-h-11 min-w-0 px-2 py-2.5 text-base leading-6 md:text-base"
                      placeholder="Nhắn tin..."
                      rows={1}
                      title="Enter để gửi · Shift + Enter để xuống dòng · Dán ảnh bằng Ctrl/⌘ + V"
                      {...field}
                      ref={(node) => {
                        field.ref(node)
                        textareaRef.current = node
                      }}
                      value={field.value ?? ""}
                      onPaste={pasteImage}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault()
                          if (canSend) event.currentTarget.form?.requestSubmit()
                        }
                      }}
                    />
                    <InputGroupAddon
                      align="inline-end"
                      className="self-end py-0.5 pr-0.5 has-[>button]:mr-0"
                    >
                      <InputGroupButton
                        aria-label="Gửi tin nhắn"
                        className="size-10 rounded-xl"
                        disabled={!canSend}
                        size="icon-sm"
                        title="Gửi tin nhắn"
                        type="submit"
                        variant="default"
                      >
                        <SendIcon />
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="attachments"
            render={({ field: { name, onBlur, ref } }) => (
              <FormItem>
                <FormLabel className="sr-only">Tệp đính kèm</FormLabel>
                <FormControl>
                  <input
                    name={name}
                    onBlur={onBlur}
                    ref={(node) => {
                      ref(node)
                      fileInputRef.current = node
                    }}
                    accept={CHAT_ATTACHMENT_ACCEPT}
                    className="sr-only"
                    type="file"
                    multiple
                    value={undefined}
                    onChange={(event) =>
                      addFiles(Array.from(event.target.files ?? []))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  )
}
