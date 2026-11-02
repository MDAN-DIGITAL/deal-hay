"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Dialog } from "@base-ui/react/dialog"
import {
  Maximize2Icon,
  MessageCircleIcon,
  MinusIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { useRealtime } from "@/components/realtime-provider"
import { useSession } from "@/components/session-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import { getAuthPageHref } from "@/lib/auth-redirect"

const ChatsPanel = dynamic(
  () =>
    import("@/modules/chats/containers/chats-page-container").then(
      (module) => module.ChatsPageContainer
    ),
  {
    ssr: false,
    loading: () => (
      <p
        className="py-12 text-center text-sm text-muted-foreground"
        role="status"
      >
        Đang mở tin nhắn...
      </p>
    ),
  }
)

const mobileQuery = "(max-width: 639px)"
function subscribeToScreen(change: () => void) {
  const query = window.matchMedia(mobileQuery)
  query.addEventListener("change", change)
  return () => query.removeEventListener("change", change)
}
const isMobileScreen = () => window.matchMedia(mobileQuery).matches
const serverScreen = () => false

function FloatingChatWidget({
  currentUserId,
  hidden,
  loading,
}: {
  currentUserId?: string
  hidden: boolean
  loading: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [opened, setOpened] = useState(false)
  const [selectedSlug, setSelectedSlug] = useState<string>()
  const handleConversationChange = useCallback((slug?: string) => {
    setSelectedSlug(slug)
  }, [])
  const popup = useRef<HTMLDivElement>(null)
  const mobile = useSyncExternalStore(
    subscribeToScreen,
    isMobileScreen,
    serverScreen
  )
  const { unreadCounts } = useRealtime()
  const open = expanded && !hidden
  const unread = Math.max(0, Math.trunc(unreadCounts.messages))

  useEffect(() => {
    if (!open || !mobile || !popup.current) return
    const element = popup.current
    const viewport = window.visualViewport
    const resize = () => {
      element.style.setProperty(
        "--chat-viewport-height",
        `${viewport?.height ?? window.innerHeight}px`
      )
      element.style.setProperty(
        "--chat-viewport-top",
        `${viewport?.offsetTop ?? 0}px`
      )
    }
    resize()
    viewport?.addEventListener("resize", resize)
    viewport?.addEventListener("scroll", resize)
    window.addEventListener("resize", resize)
    return () => {
      viewport?.removeEventListener("resize", resize)
      viewport?.removeEventListener("scroll", resize)
      window.removeEventListener("resize", resize)
      element.style.removeProperty("--chat-viewport-height")
      element.style.removeProperty("--chat-viewport-top")
    }
  }, [open, mobile])

  return (
    <Dialog.Root
      open={open}
      modal={mobile}
      disablePointerDismissal
      onOpenChange={(next) => {
        setExpanded(next)
        if (next) setOpened(true)
      }}
    >
      {!hidden ? (
        <Dialog.Trigger
          render={
            <Button
              aria-label={
                unread
                  ? `Mở chat, ${unread} tin nhắn chưa đọc`
                  : "Mở chat với Deal Hay"
              }
              className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 size-14 rounded-full shadow-xl ring-4 ring-background sm:right-6 sm:bottom-6 sm:size-16 [&_svg]:size-7"
              title="Tin nhắn & hỗ trợ Deal Hay"
            />
          }
        >
          <MessageCircleIcon />
          {unread > 0 ? (
            <span className="absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-white ring-2 ring-background">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Dialog.Trigger>
      ) : null}
      <Dialog.Portal keepMounted>
        <Dialog.Popup
          ref={popup}
          className="chat-surface fixed top-[var(--chat-viewport-top,0px)] left-0 z-50 flex h-[var(--chat-viewport-height,100dvh)] w-full min-w-0 flex-col overflow-hidden bg-background text-foreground shadow-2xl outline-none sm:top-auto sm:right-6 sm:bottom-24 sm:left-auto sm:h-[min(720px,calc(100dvh-7.5rem))] sm:w-[420px] sm:max-w-[calc(100vw-3rem)] sm:rounded-2xl sm:border"
        >
          <div className="flex shrink-0 items-center gap-3 border-b bg-primary/5 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <MessageCircleIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-semibold">Tin nhắn</Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">
                Hỗ trợ & trò chuyện cùng Deal Hay
              </Dialog.Description>
            </div>
            <Link
              aria-label="Mở trang tin nhắn đầy đủ"
              className={buttonVariants({ size: "icon-lg", variant: "ghost" })}
              href={
                selectedSlug
                  ? `/chats/${encodeURIComponent(selectedSlug)}`
                  : "/chats"
              }
              onClick={() => setExpanded(false)}
              title="Mở toàn màn hình"
            >
              <Maximize2Icon />
            </Link>
            <Dialog.Close
              render={
                <Button
                  aria-label="Thu nhỏ chat"
                  size="icon-lg"
                  variant="ghost"
                  title="Thu nhỏ chat"
                />
              }
            >
              <MinusIcon />
            </Dialog.Close>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {currentUserId && opened ? (
              <ChatsPanel
                currentUserId={currentUserId}
                embedded
                active={open}
                onConversationChange={handleConversationChange}
              />
            ) : loading ? (
              <p
                className="py-12 text-center text-sm text-muted-foreground"
                role="status"
              >
                Đang tải tài khoản...
              </p>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheckIcon className="size-8" />
                </span>
                <div className="space-y-2">
                  <p className="text-lg font-semibold">Deal Hay Admin</p>
                  <p className="text-sm text-muted-foreground">
                    Đăng nhập để nhắn tin với đội ngũ hỗ trợ và các cửa hàng.
                  </p>
                </div>
                <Link
                  className={buttonVariants({ size: "lg" })}
                  href={getAuthPageHref("/sign-in", "/chats")}
                  onClick={() => setExpanded(false)}
                >
                  Đăng nhập để trò chuyện
                </Link>
              </div>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function FloatingChat() {
  const { user, loading } = useSession()
  const pathname = usePathname()
  return (
    <FloatingChatWidget
      key={user?.id ?? "guest"}
      currentUserId={user?.id}
      loading={loading}
      hidden={pathname === "/chats" || pathname.startsWith("/chats/")}
    />
  )
}
