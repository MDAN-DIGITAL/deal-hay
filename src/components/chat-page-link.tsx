"use client"

import Link from "next/link"
import type { ComponentProps, MouseEvent } from "react"

import { openChatPage } from "@/modules/chats/lib/chat-navigation"

/** A real link remains available if the browser blocks a scripted new tab. */
export function ChatPageLink({
  onClick,
  onAuxClick,
  title = "Mở tin nhắn trong tab mới",
  ...props
}: ComponentProps<typeof Link>) {
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.altKey || event.shiftKey) return
    if (openChatPage(event.currentTarget.href)) event.preventDefault()
  }
  return (
    <Link
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      onClick={(event) => {
        onClick?.(event)
        if (event.button === 0) open(event)
      }}
      onAuxClick={(event) => {
        onAuxClick?.(event)
        if (event.button === 1) open(event)
      }}
    />
  )
}
