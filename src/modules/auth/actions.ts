import { ApiError } from "@/api/client"
import {
  forgotPassword,
  login,
  logout,
  register,
  resetPassword,
} from "@/api/auth/mutations"
import { clearAuthSession, setAuthSession } from "@/lib/auth"
import { getSafeAuthRedirect } from "@/lib/auth-redirect"
import { getSessionId } from "@/lib/session"
import type { ActionState } from "@/types/forms"
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type ForgotPasswordValues,
  type ResetPasswordValues,
  type SignInValues,
  type SignUpValues,
} from "@/modules/auth/schemas/auth"

function fromApiError(error: ApiError): ActionState {
  return {
    success: false,
    message: error.message,
    errors: error.errors,
  }
}

export type SignInActionState = ActionState & {
  requiresAdminVerification?: boolean
}

export async function signInAction(
  values: SignInValues,
  redirectTo?: string
): Promise<SignInActionState> {
  const parsed = signInSchema.safeParse(values)

  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng kiểm tra lại thông tin đăng nhập.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const payload = await login({
      email: parsed.data.email,
      password: parsed.data.password,
      remember: parsed.data.remember,
      admin_verification_code: parsed.data.admin_verification_code || undefined,
    })
    setAuthSession(payload.session, parsed.data.remember)
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        ...fromApiError(error),
        requiresAdminVerification:
          error.status === 422 &&
          Boolean(error.errors?.admin_verification_code?.length),
      }
    }
    return { success: false, message: "Không thể đăng nhập. Vui lòng thử lại." }
  }

  window.location.assign(getSafeAuthRedirect(redirectTo))
  return { success: true, message: "" }
}

export async function signUpAction(
  values: SignUpValues,
  redirectTo?: string
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(values)

  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng kiểm tra lại thông tin đăng ký.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const payload = await register({
      email: parsed.data.email,
      password: parsed.data.password,
      password_confirmation: parsed.data.password_confirmation,
      accept_terms: parsed.data.accept_terms,
    })
    setAuthSession(payload.session)
  } catch (error) {
    if (error instanceof ApiError) {
      return fromApiError(error)
    }
    return { success: false, message: "Không thể đăng ký. Vui lòng thử lại." }
  }

  const destination = getSafeAuthRedirect(redirectTo)
  window.location.replace(
    "/profile/interests?welcome=1&redirect=" + encodeURIComponent(destination)
  )
  return { success: true, message: "" }
}

export async function forgotPasswordAction(
  values: ForgotPasswordValues
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(values)

  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng nhập email hợp lệ.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const response = await forgotPassword({ email: parsed.data.email })
    return { success: true, message: response.message }
  } catch (error) {
    if (error instanceof ApiError) {
      return fromApiError(error)
    }
    return { success: false, message: "Không thể gửi yêu cầu quên mật khẩu." }
  }
}

export type ResetPasswordActionState = ActionState & { authenticated?: boolean }

export async function resetPasswordAction(
  values: ResetPasswordValues
): Promise<ResetPasswordActionState> {
  const parsed = resetPasswordSchema.safeParse(values)

  if (!parsed.success) {
    return {
      success: false,
      message: "Vui lòng kiểm tra lại thông tin đặt lại mật khẩu.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  const account = getSessionId()
  let response
  try {
    response = await resetPassword({
      email: parsed.data.email,
      token: parsed.data.token,
      password: parsed.data.password,
      password_confirmation: parsed.data.password_confirmation,
    })
  } catch (error) {
    if (error instanceof ApiError) {
      return fromApiError(error)
    }
    return { success: false, message: "Không thể đặt lại mật khẩu." }
  }

  if (response.session && getSessionId() === account) {
    setAuthSession(response.session)
    window.location.replace("/")
    return { success: true, authenticated: true, message: response.message }
  }
  return {
    success: true,
    authenticated: false,
    message: response.session
      ? "Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập để tiếp tục."
      : response.message,
  }
}

export async function signOutAction(): Promise<void> {
  const session = getSessionId()
  try {
    await logout()
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) throw error
  }
  const current = getSessionId()
  if (current !== session && current !== null) return
  if (current === session) clearAuthSession(session)
  window.location.assign(new URL("/sign-in", window.location.origin).href)
}
