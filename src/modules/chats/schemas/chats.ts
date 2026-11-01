import { z } from "zod"
import {
  chatAttachmentFileSchema,
  chatUploadedAttachmentSchema,
} from "@/lib/validation"

const messageFields = {
  body: z.union([
    z.string().trim().max(2000, "Tin nhắn không được vượt quá 2.000 ký tự."),
    z.literal(""),
  ]),
  mention_admin_ids: z.array(z.string().min(1).max(128)).max(20).optional(),
  reply_to_id: z
    .string()
    .uuid("Tin nhắn được trả lời không hợp lệ.")
    .optional(),
}

function requireMessageContent(
  value: {
    body: string
    attachment?: unknown
    attachments?: unknown[]
    mention_admin_ids?: string[]
  },
  context: z.RefinementCtx
) {
  if (
    !value.body &&
    !value.attachment &&
    !value.attachments?.length &&
    !value.mention_admin_ids?.length
  ) {
    context.addIssue({
      code: "custom",
      path: ["body"],
      message: "Vui lòng nhập nội dung hoặc chọn tệp đính kèm.",
    })
  }
}

export const sendMessageSchema = z
  .object({
    ...messageFields,
    attachments: z
      .array(chatAttachmentFileSchema("Tệp đính kèm không hợp lệ."))
      .max(50, "Mỗi lần được gửi tối đa 50 tệp."),
  })
  .superRefine(requireMessageContent)

export const sendMessageUploadSchema = z
  .object({
    client_message_id: z.uuid("Mã tin nhắn không hợp lệ.").optional(),
    ...messageFields,
    attachment: chatUploadedAttachmentSchema(
      "Tệp đính kèm không hợp lệ."
    ).optional(),
  })
  .superRefine(requireMessageContent)

export type SendMessageValues = z.infer<typeof sendMessageSchema>
