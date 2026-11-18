"use client"

import { KeyRoundIcon, LogInIcon, MailIcon } from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormSubmitButton } from "@/components/form-submit-button"
import { PasswordInput } from "@/components/password-input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { applyServerErrors } from "@/lib/form-utils"
import { resetPasswordAction } from "@/modules/auth/actions"
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@/modules/auth/schemas/auth"

export function ResetPasswordForm({
  email,
  token,
}: {
  email?: string
  token?: string
}) {
  const [isPending, startTransition] = useTransition()
  const [linkError, setLinkError] = useState("")
  const [completed, setCompleted] = useState("")
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: email ?? "",
      token: token ?? "",
      password: "",
      password_confirmation: "",
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    setLinkError("")
    startTransition(async () => {
      const state = await resetPasswordAction(values)
      const linkMessage = state.errors?.token?.[0] ?? state.errors?.general?.[0]
      const visibleErrors = state.errors
        ? Object.fromEntries(
            Object.entries(state.errors).filter(
              ([field]) => field !== "token" && field !== "general"
            )
          )
        : undefined
      const hasFieldErrors = applyServerErrors(visibleErrors, form.setError)

      if (state.success) {
        setCompleted(state.message)
        toast.success(state.message)
        form.reset({
          email: values.email,
          token: "",
          password: "",
          password_confirmation: "",
        })
        return
      }

      if (linkMessage) {
        setLinkError(linkMessage)
      } else if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  if (!token || completed)
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {completed ? "Đã đặt lại mật khẩu" : "Liên kết không hợp lệ"}
          </CardTitle>
        </CardHeader>
        <CardContent className="gap-4">
          <Alert variant={completed ? "success" : "destructive"}>
            <AlertDescription>
              {completed ||
                "Vui lòng mở liên kết trong email hoặc yêu cầu một liên kết đặt lại mật khẩu mới."}
            </AlertDescription>
          </Alert>
          <Button
            nativeButton={false}
            render={<Link href={completed ? "/sign-in" : "/forgot-password"} />}
            startIcon={completed ? <LogInIcon /> : <MailIcon />}
          >
            {completed ? "Đến trang đăng nhập" : "Yêu cầu liên kết mới"}
          </Button>
        </CardContent>
      </Card>
    )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Đặt lại mật khẩu</CardTitle>
        <CardDescription>
          Nhập mật khẩu mới. Bạn sẽ được đăng nhập ngay sau khi cập nhật thành
          công.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {linkError ? (
          <Alert variant="destructive">
            <AlertTitle>Không thể sử dụng liên kết này</AlertTitle>
            <AlertDescription>
              <p>{linkError}</p>
              <Link href="/forgot-password" className="text-primary underline">
                Yêu cầu liên kết mới
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}
        <Form {...form}>
          <form className="space-y-4" noValidate onSubmit={onSubmit}>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      startIcon={<MailIcon />}
                      autoComplete="email"
                      inputMode="email"
                      type="text"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              rules={{ deps: "password_confirmation" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mật khẩu mới</FormLabel>
                  <FormControl>
                    <PasswordInput
                      autoCapitalize="none"
                      autoComplete="new-password"
                      maxLength={72}
                      minLength={6}
                      spellCheck={false}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Ít nhất 6 ký tự, có ít nhất một chữ cái và một chữ số.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password_confirmation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Xác nhận mật khẩu</FormLabel>
                  <FormControl>
                    <PasswordInput
                      autoCapitalize="none"
                      autoComplete="new-password"
                      maxLength={72}
                      minLength={6}
                      spellCheck={false}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormSubmitButton
              startIcon={<KeyRoundIcon />}
              idleText="Đặt lại mật khẩu"
              pending={isPending}
              pendingText="Đang cập nhật..."
            />
          </form>
        </Form>
        <Link
          className="text-sm text-primary underline-offset-4 hover:underline"
          href="/sign-in"
        >
          Quay lại đăng nhập
        </Link>
      </CardContent>
    </Card>
  )
}
