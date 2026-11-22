"use client"

import { MessageSquareIcon, SendIcon } from "lucide-react"
import { useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormSubmitButton } from "@/components/form-submit-button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { applyServerErrors } from "@/lib/form-utils"
import { notificationAppealAction } from "@/modules/notifications/actions"
import {
  notificationAppealSchema,
  type NotificationAppealValues,
} from "@/modules/notifications/schemas/notifications"

export function NotificationAppealForm({
  notificationId,
}: {
  notificationId: string
}) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<NotificationAppealValues>({
    resolver: zodResolver(notificationAppealSchema),
    defaultValues: {
      notification_id: notificationId,
      message: "",
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const state = await notificationAppealAction(values)
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success) {
        toast.success(state.message)
        form.reset({ notification_id: notificationId, message: "" })
        return
      }

      if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <Form {...form}>
      <form className="space-y-3" noValidate onSubmit={onSubmit}>
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Khiếu nại thông báo này</FormLabel>
              <FormControl>
                <Textarea
                  startIcon={<MessageSquareIcon />}
                  placeholder="Mô tả lý do cần admin hỗ trợ..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormSubmitButton
          startIcon={<SendIcon />}
          idleText="Gửi khiếu nại"
          pending={isPending}
          pendingText="Đang gửi..."
          variant="outline"
        />
      </form>
    </Form>
  )
}
