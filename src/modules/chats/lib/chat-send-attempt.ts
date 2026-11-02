export type ChatSendDraft = {
  conversationSlug: string
  body: string
  attachment?: File
  replyToId?: string
  mentionAdminIds?: string[]
}
export type ChatSendAttempt = ChatSendDraft & {
  clientMessageId: string
  prepared?: FormData
  preparing?: Promise<FormData>
}

/** Keep the identity and uploaded references of an unchanged draft across lost responses. */
export function chatSendAttempt(
  previous: ChatSendAttempt | null,
  draft: ChatSendDraft
): ChatSendAttempt {
  const body = draft.body.trim()
  return previous &&
    previous.conversationSlug === draft.conversationSlug &&
    previous.body === body &&
    previous.attachment === draft.attachment &&
    previous.replyToId === draft.replyToId &&
    (previous.mentionAdminIds ?? []).join(",") ===
      (draft.mentionAdminIds ?? []).join(",")
    ? previous
    : { ...draft, body, clientMessageId: crypto.randomUUID() }
}

export async function prepareChatSendAttempt(
  attempt: ChatSendAttempt,
  prepare: (input: FormData) => Promise<FormData>
): Promise<FormData> {
  if (attempt.prepared) return attempt.prepared
  if (attempt.preparing) return attempt.preparing
  const input = chatAttemptPayload(attempt)
  attempt.preparing = prepare(input)
    .then((payload) => {
      payload.set("client_message_id", attempt.clientMessageId)
      attempt.prepared = payload
      return payload
    })
    .finally(() => {
      attempt.preparing = undefined
    })
  return attempt.preparing
}

function chatAttemptPayload(attempt: ChatSendAttempt): FormData {
  const input = new FormData()
  input.set("client_message_id", attempt.clientMessageId)
  if (attempt.body) input.set("body", attempt.body)
  if (attempt.replyToId) input.set("reply_to_id", attempt.replyToId)
  if (attempt.attachment) input.set("attachment", attempt.attachment)
  for (const id of attempt.mentionAdminIds ?? [])
    input.append("mention_admin_ids", id)
  return input
}

/** Upload a selected image batch once; message commits can remain ordered. */
export async function prepareChatImageAttempts(
  attempts: ChatSendAttempt[],
  prepareImages: (input: FormData) => Promise<FormData>
): Promise<void> {
  const pending = attempts.filter(
    (attempt) =>
      !attempt.prepared &&
      !attempt.preparing &&
      attempt.attachment?.type.startsWith("image/")
  )
  if (pending.length) {
    const input = new FormData()
    for (const attempt of pending)
      input.append("attachment", attempt.attachment!)
    const references = Promise.resolve()
      .then(() => prepareImages(input))
      .then((output) => {
        const files = output.getAll("attachment")
        if (
          files.length !== pending.length ||
          files.some((value) => typeof value !== "string" || !value)
        )
          throw new Error("Không thể chuẩn bị đủ ảnh đính kèm.")
        return files as string[]
      })
    pending.forEach((attempt, index) => {
      attempt.preparing = references
        .then((files) => {
          const payload = chatAttemptPayload(attempt)
          payload.set("attachment", files[index])
          attempt.prepared = payload
          return payload
        })
        .finally(() => {
          attempt.preparing = undefined
        })
    })
  }
  const outcomes = await Promise.allSettled(
    attempts.flatMap((attempt) =>
      attempt.preparing ? [attempt.preparing] : []
    )
  )
  const failure = outcomes.find((outcome) => outcome.status === "rejected")
  if (failure?.status === "rejected") throw failure.reason
}

/** Each file keeps its own identity so retrying a partially sent batch is safe. */
export function chatSendAttempts(
  previous: ChatSendAttempt[],
  draft: Omit<ChatSendDraft, "attachment"> & { attachments: File[] }
): ChatSendAttempt[] {
  const files: (File | undefined)[] = draft.attachments.length
    ? draft.attachments
    : [undefined]
  return files.map((attachment, index) =>
    chatSendAttempt(previous[index] ?? null, {
      conversationSlug: draft.conversationSlug,
      body: index === 0 ? draft.body : "",
      attachment,
      replyToId: index === 0 ? draft.replyToId : undefined,
      mentionAdminIds: index === 0 ? draft.mentionAdminIds : [],
    })
  )
}
