import Link from "next/link"
import {
  BadgeCheckIcon,
  BadgePercentIcon,
  CircleHelpIcon,
  FileTextIcon,
  HeartHandshakeIcon,
  HouseIcon,
  MessageCircleIcon,
  ReceiptTextIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  StoreIcon,
  TicketPercentIcon,
  UserRoundIcon,
} from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { Brand } from "@/components/ui/brand"
import { ChatPageLink } from "@/components/chat-page-link"

const customerLinks = [
  {
    href: "/#cach-thuc-hoat-dong",
    label: "Cách thức hoạt động",
    icon: CircleHelpIcon,
  },
  {
    href: "/terms",
    label: "Chính sách ưu đãi quảng cáo",
    icon: TicketPercentIcon,
  },
  { href: "/terms", label: "Chính sách đổi trả", icon: RotateCcwIcon },
  { href: "/terms", label: "Điều khoản sử dụng", icon: FileTextIcon },
  { href: "/", label: "Khám phá sản phẩm", icon: HouseIcon },
  { href: "/profile", label: "Tài khoản của tôi", icon: UserRoundIcon },
  { href: "/chats", label: "Tin nhắn", icon: MessageCircleIcon },
]

const sellerLinks = [
  { href: "/sell", label: "Trở thành người bán", icon: StoreIcon },
  { href: "/terms", label: "Chính sách giá", icon: BadgePercentIcon },
  { href: "/terms", label: "Chính sách phí 0%", icon: ReceiptTextIcon },
  { href: "/terms", label: "Quy chế hoạt động", icon: FileTextIcon },
  { href: "/shop-manage", label: "Kênh người bán", icon: StoreIcon },
]

function footerLinkGroup(title: string, links: typeof customerLinks) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <nav
        className="grid gap-2 text-sm text-muted-foreground"
        aria-label={title}
      >
        {links.map((item) => {
          const NavigationLink = item.href === "/chats" ? ChatPageLink : Link
          return (
            <NavigationLink
              key={item.label}
              className="flex w-fit items-center gap-2 transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-ring"
              href={item.href}
            >
              <item.icon className="size-4 shrink-0" aria-hidden="true" />
              {item.label}
            </NavigationLink>
          )
        })}
      </nav>
    </div>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-9 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
        <div className="space-y-3">
          <Link href="/" aria-label="Deal Hay - Trang chủ">
            <Brand />
          </Link>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            Khám phá sản phẩm, trò chuyện trực tiếp với cửa hàng và nhận hỗ trợ
            khi bạn cần.
          </p>
        </div>

        {footerLinkGroup("Dành cho khách hàng", customerLinks)}
        {footerLinkGroup("Dành cho người bán", sellerLinks)}
      </div>
      <Separator />
      <div className="mx-auto grid max-w-7xl gap-3 px-4 py-5 sm:px-6 md:grid-cols-3 lg:px-8">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheckIcon className="size-4 text-primary" /> Bảo vệ thông tin
          tài khoản
        </p>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <BadgeCheckIcon className="size-4 text-primary" /> Thông tin sản phẩm
          minh bạch
        </p>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <HeartHandshakeIcon className="size-4 text-primary" /> Hỗ trợ khi có
          khiếu nại
        </p>
      </div>
      <Separator />
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© 2026 Deal Hay. All rights reserved.</p>
        <nav className="flex items-center gap-4" aria-label="Thông tin pháp lý">
          <Link
            href="/privacy"
            className="flex items-center gap-1.5 hover:text-foreground"
          >
            <ShieldCheckIcon className="size-3.5 shrink-0" aria-hidden="true" />
            Chính sách bảo mật
          </Link>
          <Link
            href="/terms"
            className="flex items-center gap-1.5 hover:text-foreground"
          >
            <FileTextIcon className="size-3.5 shrink-0" aria-hidden="true" />
            Điều khoản sử dụng
          </Link>
        </nav>
      </div>
    </footer>
  )
}
