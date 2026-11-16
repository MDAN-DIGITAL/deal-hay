import { AuthShell } from "@/modules/auth/containers/auth-shell"
import { ResetPasswordForm } from "@/modules/auth/components/reset-password-form"

export function ResetPasswordPageContainer({
  email,
  token,
}: {
  email?: string
  token?: string
}) {
  return (
    <AuthShell
      title="Đặt lại mật khẩu mới"
      description="Tạo mật khẩu mới để khôi phục tài khoản và tiếp tục sử dụng Deal Hay."
    >
      <ResetPasswordForm email={email} token={token} />
    </AuthShell>
  )
}
