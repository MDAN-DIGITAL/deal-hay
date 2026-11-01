"use client"

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ClipboardEvent,
  type FormEvent,
} from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AtSignIcon,
  LoaderCircleIcon,
  PaperclipIcon,
  SendIcon,
  XIcon,
} from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { applyServerErrors, runUploadAction } from "@/lib/form-utils"
import {
  CHAT_ATTACHMENT_ACCEPT,
  chatAttachmentFileSchema,
} from "@/lib/validation"
import { ImageUploadProgress } from "@/components/image-upload-progress"
import { useImageUpload } from "@/hooks/use-image-upload"
import { sendMessageAction } from "@/modules/chats/actions"
import {
  chatSendAttempts,
  prepareChatSendAttempt,
  type ChatSendAttempt,
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
}: {
  conversationSlug: string
  admins?: { id: string; name: string }[]
  socketId?: string
  replyTo?: ChatReply | null
  onCancelReply?: () => void
  onSent: (message: ChatMessage, replyToId?: string | null) => void
}) {
  const [isPending, startTransition] = useTransition()
  const { prepareUploads, uploadProgress } = useImageUpload()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const attemptRef = useRef<ChatSendAttempt[]>([])
  const [showAdminPicker, setShowAdminPicker] = useState(false)
  const form = useForm<SendMessageValues>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: { body: "", attachments: [], mention_admin_ids: [] },
  })
  const attachments = useWatch({ control: form.control, name: "attachments" })
  const mentionAdminIds =
    useWatch({ control: form.control, name: "mention_admin_ids" }) ?? []

  useEffect(() => {
    if (replyTo?.id) textareaRef.current?.focus()
    form.clearErrors("reply_to_id")
  }, [form, replyTo?.id])

  const addFiles = (files: File[]) => {
    if (isPending) return
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
    if (isPending) return
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
    if (isPending) return

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
    void form.handleSubmit((values) => {
      const attempts = chatSendAttempts(attemptRef.current, {
        conversationSlug,
        body: values.body,
        attachments: values.attachments,
        replyToId: replyTo?.id,
        mentionAdminIds: values.mention_admin_ids,
      })
      attemptRef.current = attempts
      startTransition(async () => {
        for (const attempt of attempts) {
          const state = await runUploadAction(async () => {
            const payload = await prepareChatSendAttempt(
              attempt,
              async (input) => {
                const prepared = await prepareUploads(input, "chat")
                const file = prepared.get("attachment")
                if (file instanceof File)
                  prepared.set("attachment", await uploadChatFile(file))
                return prepared
              }
            )
            if (socketId) payload.set("socket_id", socketId)
            else payload.delete("socket_id")
            return sendMessageAction(conversationSlug, payload)
          })
          const hasFieldErrors = applyServerErrors(
            {
              ...state.errors,
              ...(state.errors?.attachment
                ? { attachments: state.errors.attachment }
                : {}),
            },
            form.setError
          )
          if (!state.success || !state.data) {
            if (!hasFieldErrors && state.message) toast.error(state.message)
            return
          }
          attemptRef.current = attemptRef.current.filter(
            (item) => item !== attempt
          )
          onSent(state.data, attempt.replyToId ?? null)
          // Remove confirmed files immediately; a retry sends only the remaining files.
          form.setValue(
            "attachments",
            form
              .getValues("attachments")
              .filter((file) => file !== attempt.attachment)
          )
          if (attempt === attempts[0]) {
            form.setValue("body", "")
            form.setValue("mention_admin_ids", [])
          }
        }
        form.reset({ body: "", attachments: [], mention_admin_ids: [] })
      })
    })(event)
  }

  return (
    <Form {...form}>
      <form
        className="shrink-0 border-t border-border/60 bg-card px-3 py-3 sm:px-4"
        noValidate
        onSubmit={onSubmit}
      >
        {replyTo ? (
          <ChatReplyPreview
            className="mb-2 max-w-none"
            reply={replyTo}
            onCancel={isPending ? undefined : onCancelReply}
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
                onRemove={
                  isPending
                    ? undefined
                    : () =>
                        form.setValue(
                          "attachments",
                          attachments.filter(
                            (_, position) => position !== index
                          ),
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
                disabled={isPending}
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
          <div className="mb-2 max-h-40 space-y-1 overflow-auto rounded-lg border p-2">
            <p className="px-2 text-xs text-muted-foreground">
              Tag admin để mời vào cuộc trò chuyện
            </p>
            {admins.length ? (
              admins.map((admin) => (
                <label
                  key={admin.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    disabled={isPending}
                    checked={mentionAdminIds.includes(admin.id)}
                    onChange={(event) =>
                      form.setValue(
                        "mention_admin_ids",
                        event.target.checked
                          ? [...mentionAdminIds, admin.id]
                          : mentionAdminIds.filter((id) => id !== admin.id),
                        { shouldValidate: true }
                      )
                    }
                  />
                  @{admin.name}
                </label>
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
        <ImageUploadProgress progress={isPending ? uploadProgress : null} />
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Nội dung tin nhắn</FormLabel>
              <FormControl>
                <InputGroup className="h-auto items-end rounded-2xl bg-muted/30 p-1 shadow-none has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/15">
                  <InputGroupAddon
                    align="inline-start"
                    className="gap-0 self-end py-1 pl-1 has-[>button]:ml-0"
                  >
                    <InputGroupButton
                      aria-label="Đính kèm tệp"
                      className="rounded-full"
                      disabled={isPending}
                      size="icon-sm"
                      title="Đính kèm tệp"
                      onClick={() => {
                        if (!fileInputRef.current) return
                        fileInputRef.current.value = ""
                        fileInputRef.current.click()
                      }}
                    >
                      <PaperclipIcon />
                    </InputGroupButton>
                    <InputGroupButton
                      aria-label="Tag admin"
                      title="Tag admin"
                      className="rounded-full"
                      disabled={isPending}
                      size="icon-sm"
                      aria-expanded={showAdminPicker}
                      onClick={() => setShowAdminPicker((current) => !current)}
                    >
                      <AtSignIcon />
                    </InputGroupButton>
                    <ChatEmojiPicker
                      disabled={isPending}
                      focusTarget={textareaRef}
                      onSelect={insertEmoji}
                    />
                  </InputGroupAddon>
                  <InputGroupTextarea
                    aria-label="Nội dung tin nhắn"
                    className="max-h-32 min-h-10 min-w-0 px-2 py-2.5"
                    disabled={isPending}
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
                        event.currentTarget.form?.requestSubmit()
                      }
                    }}
                  />
                  <InputGroupAddon
                    align="inline-end"
                    className="self-end py-1 pr-1 has-[>button]:mr-0"
                  >
                    <InputGroupButton
                      aria-label="Gửi tin nhắn"
                      className="rounded-full"
                      disabled={isPending}
                      size="icon-sm"
                      title="Gửi tin nhắn"
                      type="submit"
                      variant="default"
                    >
                      {isPending ? (
                        <LoaderCircleIcon className="animate-spin" />
                      ) : (
                        <SendIcon />
                      )}
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
      </form>
    </Form>
  )
}
