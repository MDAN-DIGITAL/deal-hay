import Link from "next/link"
import {
  BadgeCheckIcon,
  HeartHandshakeIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { Brand } from "@/components/ui/brand"

const footerLinks = [
  { href: "/", label: "Khám phá sản phẩm" },
  { href: "/profile", label: "Tài khoản của tôi" },
  { href: "/chats", label: "Tin nhắn" },
  { href: "/shop-manage", label: "Kênh người bán" },
]

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-[1.25fr_0.75fr_1fr] lg:px-8">
        <div className="space-y-3">
          <Link href="/" aria-label="Deal Hay - Trang chủ">
            <Brand />
          </Link>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            Khám phá sản phẩm, trò chuyện trực tiếp với cửa hàng và nhận hỗ trợ
            khi bạn cần.
          </p>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold">Liên kết nhanh</p>
          <nav
            className="grid gap-2 text-sm text-muted-foreground"
            aria-label="Liên kết cuối trang"
          >
            {footerLinks.map((item) => (
              <Link
                key={item.href}
                className="w-fit transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-ring"
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold">Mua sắm cùng Deal Hay</p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheckIcon className="size-4 text-primary" /> Bảo vệ thông tin
            tài khoản
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <BadgeCheckIcon className="size-4 text-primary" /> Thông tin sản
            phẩm minh bạch
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <HeartHandshakeIcon className="size-4 text-primary" /> Hỗ trợ khi có
            khiếu nại
          </p>
        </div>
      </div>
      <Separator />
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© 2026 Deal Hay. All rights reserved.</p>
        <nav className="flex items-center gap-4" aria-label="Thông tin pháp lý">
          <Link href="/privacy" className="hover:text-foreground">
            Chính sách bảo mật
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Điều khoản sử dụng
          </Link>
        </nav>
      </div>
    </footer>
  )
}
