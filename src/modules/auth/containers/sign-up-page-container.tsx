import { GuestGuard } from "@/components/session-provider"
import { AuthShell } from "@/modules/auth/containers/auth-shell"
import { SignUpForm } from "@/modules/auth/components/sign-up-form"

export function SignUpPageContainer({ redirectTo }: { redirectTo?: string }) {
  return (
    <GuestGuard redirectTo={redirectTo}>
      <AuthShell
        title="Tạo tài khoản Deal Hay mới"
        description="Đăng ký để theo dõi shop, gửi đánh giá sản phẩm, nhận thông báo và trò chuyện trực tiếp với người bán."
      >
        <SignUpForm redirectTo={redirectTo} />
      </AuthShell>
    </GuestGuard>
  )
}
