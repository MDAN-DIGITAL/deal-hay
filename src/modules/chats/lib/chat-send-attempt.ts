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
  const input = new FormData()
  input.set("client_message_id", attempt.clientMessageId)
  if (attempt.body) input.set("body", attempt.body)
  if (attempt.replyToId) input.set("reply_to_id", attempt.replyToId)
  if (attempt.attachment) input.set("attachment", attempt.attachment)
  for (const id of attempt.mentionAdminIds ?? [])
    input.append("mention_admin_ids", id)
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
