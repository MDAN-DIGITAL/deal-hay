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
  reply_to_id: z
    .string()
    .uuid("Tin nhắn được trả lời không hợp lệ.")
    .optional(),
}

function requireMessageContent(
  value: { body: string; attachment?: unknown },
  context: z.RefinementCtx
) {
  if (!value.body && !value.attachment) {
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
    attachment: chatAttachmentFileSchema(
      "Tệp đính kèm không hợp lệ."
    ).optional(),
  })
  .superRefine(requireMessageContent)

export const sendMessageUploadSchema = z
  .object({
    ...messageFields,
    attachment: chatUploadedAttachmentSchema(
      "Tệp đính kèm không hợp lệ."
    ).optional(),
  })
  .superRefine(requireMessageContent)

export type SendMessageValues = z.infer<typeof sendMessageSchema>
