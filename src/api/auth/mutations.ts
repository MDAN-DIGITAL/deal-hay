import { apiFetch } from "@/api/client"
import { authRoutes } from "@/api/auth/routes"
import { getSessionId } from "@/lib/session"
import { clearBackgroundNotificationOwner } from "@/modules/realtime/lib/background-notifications"
import type {
  ForgotPasswordPayload,
  LoginPayload,
  LoginResponse,
  LogoutResponse,
  RegisterPayload,
  RegisterResponse,
  ResetPasswordPayload,
  PasswordChangeResponse,
} from "@/api/auth/types"

export function login(payload: LoginPayload): Promise<LoginResponse> {
  return apiFetch({ method: "POST", path: authRoutes.login, body: payload })
}

export function register(payload: RegisterPayload): Promise<RegisterResponse> {
  return apiFetch({ method: "POST", path: authRoutes.register, body: payload })
}

export function forgotPassword(
  payload: ForgotPasswordPayload
): Promise<{ message: string }> {
  return apiFetch({
    method: "POST",
    path: authRoutes.forgotPassword,
    body: payload,
  })
}

export function resetPassword(
  payload: ResetPasswordPayload
): Promise<PasswordChangeResponse> {
  return apiFetch({
    method: "POST",
    path: authRoutes.resetPassword,
    body: payload,
  })
}

export async function logout(): Promise<LogoutResponse> {
  const session = getSessionId()
  await clearBackgroundNotificationOwner().catch(() => {})
  if (getSessionId() !== session)
    throw new Error("Phiên đăng nhập đã thay đổi.")
  return apiFetch({ method: "POST", path: authRoutes.logout })
}
