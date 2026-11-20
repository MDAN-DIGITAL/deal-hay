import type { Metadata } from "next"
import { headers } from "next/headers"
import { MonitorUpIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Brand } from "@/components/ui/brand"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { browserSupport, type BrowserFamily } from "@/lib/browser-support"

export const metadata: Metadata = {
  title: "Cập nhật trình duyệt | Deal Hay",
  robots: { index: false, follow: false },
}

const guides: Record<BrowserFamily, { steps: string; href?: string }> = {
  chrome: {
    steps:
      "Mở menu ⋮ → Trợ giúp → Giới thiệu về Google Chrome. Chờ Chrome cập nhật rồi chọn Chạy lại.",
    href: "https://support.google.com/chrome/answer/95414?hl=vi",
  },
  edge: {
    steps:
      "Mở menu ⋯ → Trợ giúp và phản hồi → Giới thiệu về Microsoft Edge. Cài bản cập nhật rồi khởi động lại Edge.",
    href: "https://support.microsoft.com/en-gb/edge/microsoft-edge-update-settings",
  },
  firefox: {
    steps:
      "Mở menu ☰ → Trợ giúp → Giới thiệu về Firefox. Trên Mac, chọn Firefox → Giới thiệu về Firefox. Khởi động lại khi cập nhật xong.",
    href: "https://support.mozilla.org/en-US/kb/update-firefox-latest-release",
  },
  safari: {
    steps:
      "Mở menu Apple  → Cài đặt hệ thống hoặc Tùy chọn hệ thống → Cập nhật phần mềm. Cài bản macOS hoặc Safari được cung cấp.",
    href: "https://support.apple.com/vi-vn/102665",
  },
  ios: {
    steps:
      "Mở Cài đặt → Cài đặt chung → Cập nhật phần mềm. Cài iOS hoặc iPadOS phiên bản 18 trở lên, rồi mở lại trình duyệt.",
    href: "https://support.apple.com/vi-vn/102665",
  },
  chromium: {
    steps:
      "Mở menu trình duyệt và vào mục Giới thiệu hoặc Cập nhật. Cài bản mới nhất rồi mở lại trình duyệt.",
  },
  legacy: {
    steps:
      "Mở một trình duyệt còn được cập nhật, chẳng hạn Chrome, Edge hoặc Firefox, rồi truy cập lại Deal Hay.",
  },
}

export default async function BrowserUpdatePage() {
  const result = browserSupport(await headers())
  const blocked = result.status !== "allowed"
  const guide = blocked ? guides[result.browser] : guides.chromium
  const steps =
    blocked && result.android
      ? result.name === "Android System WebView"
        ? "Mở Google Play và cập nhật Android System WebView cùng Google Chrome. Sau đó, mở lại ứng dụng hoặc mở Deal Hay bằng Chrome."
        : `Mở Google Play, tìm ${result.name} và chọn Cập nhật. Sau đó, mở lại trình duyệt.`
      : guide.steps
  const guideHref =
    blocked && result.android
      ? "https://support.google.com/googleplay/answer/113412?hl=vi"
      : guide.href
  let description = "Cài phiên bản trình duyệt mới nhất để sử dụng Deal Hay."
  if (result.status === "unverified") {
    description = `Deal Hay chưa xác minh được bản vá của Chrome 128. Phiên bản yêu cầu là ${result.minimum} trở lên.`
  } else if (result.status === "update") {
    if (result.browser === "legacy") {
      description = `Deal Hay đã ngừng hỗ trợ ${result.name}.`
    } else if (result.browser === "chromium") {
      description = `${result.name} sử dụng nền Chromium ${result.version}. Deal Hay yêu cầu Chromium ${result.minimum} trở lên.`
    } else {
      description = `Bạn đang dùng ${result.name} ${result.version}. Deal Hay yêu cầu ${result.name} ${result.minimum} trở lên.`
    }
  }

  return (
    <main>
      <Empty>
        <EmptyHeader>
          <Brand />
          <EmptyMedia variant="icon">
            <MonitorUpIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>
            <h1>Cập nhật trình duyệt để tiếp tục</h1>
          </EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Alert role="note">
            <AlertTitle>Cách cập nhật</AlertTitle>
            <AlertDescription>
              <p>{steps}</p>
              <p>
                Nếu thiết bị đã hết cập nhật, hãy dùng trình duyệt tương thích
                khác hoặc mở Deal Hay trên một thiết bị mới hơn.
              </p>
            </AlertDescription>
          </Alert>
          <ButtonGroup>
            <Button
              nativeButton={false}
              render={<a href={blocked ? "" : "/"} />}
            >
              {blocked ? "Kiểm tra lại" : "Về Deal Hay"}
            </Button>
            {guideHref ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<a href={guideHref} rel="noreferrer" />}
              >
                Hướng dẫn chính thức
              </Button>
            ) : null}
          </ButtonGroup>
        </EmptyContent>
      </Empty>
    </main>
  )
}
