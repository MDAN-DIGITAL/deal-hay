import { z } from "zod"

import {
  lowercaseAlphanumericPasswordRegex,
  requiredText,
} from "@/lib/validation"

const passwordSchema = z
  .string()
  .min(6, "Mật khẩu phải có ít nhất 6 ký tự.")
  .max(72, "Mật khẩu không được vượt quá 72 ký tự.")
  .regex(
    lowercaseAlphanumericPasswordRegex,
    "Mật khẩu chỉ được gồm chữ thường và số, đồng thời phải có cả hai."
  )

const passwordConfirmationSchema = (message: string) =>
  z
    .string()
    .min(1, message)
    .max(72, "Xác nhận mật khẩu không được vượt quá 72 ký tự.")

const optionalAdminCodeSchema = z.union([
  z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Mã xác minh quản trị viên phải gồm 6 chữ số."),
  z.literal(""),
])

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập email.")
    .email("Email không đúng định dạng.")
    .max(255, "Email không được vượt quá 255 ký tự."),
  password: z
    .string()
    .min(1, "Vui lòng nhập mật khẩu.")
    .max(255, "Mật khẩu không được vượt quá 255 ký tự."),
  remember: z.boolean(),
  admin_verification_code: optionalAdminCodeSchema,
})

export const signUpSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập email.")
      .email("Email không đúng định dạng.")
      .max(255, "Email không được vượt quá 255 ký tự."),
    password: passwordSchema,
    password_confirmation: passwordConfirmationSchema(
      "Vui lòng xác nhận mật khẩu."
    ),
    accept_terms: z
      .boolean()
      .refine(
        (value) => value,
        "Bạn phải đồng ý với điều khoản và chính sách."
      ),
  })
  .refine((value) => value.password === value.password_confirmation, {
    path: ["password_confirmation"],
    message: "Xác nhận mật khẩu không khớp.",
  })

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập email.")
    .email("Email không đúng định dạng.")
    .max(255, "Email không được vượt quá 255 ký tự."),
})

export const resetPasswordSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập email.")
      .email("Email không đúng định dạng.")
      .max(255, "Email không được vượt quá 255 ký tự."),
    token: requiredText("Liên kết đặt lại mật khẩu không hợp lệ."),
    password: passwordSchema,
    password_confirmation: passwordConfirmationSchema(
      "Vui lòng xác nhận mật khẩu mới."
    ),
  })
  .refine((value) => value.password === value.password_confirmation, {
    path: ["password_confirmation"],
    message: "Xác nhận mật khẩu không khớp.",
  })

export type SignInValues = z.infer<typeof signInSchema>
export type SignUpValues = z.infer<typeof signUpSchema>
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
