"use client"

import { useSyncExternalStore } from "react"

/** Ads belong to loaded catalog content, never account, checkout or fallback screens. */
export function isAdvertisingPage(pathname: string): boolean {
  return (
    pathname === "/" ||
    /^\/shops\/[^/]+(?:\/products\/[^/]+)?\/?$/.test(pathname)
  )
}

export function hasAdvertisingContent(): boolean {
  return (
    isAdvertisingPage(window.location.pathname) &&
    document.querySelector('main [data-ad-eligible="true"]') !== null
  )
}

export function subscribeAdvertisingContent(change: () => void) {
  const observer = new MutationObserver(change)
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-ad-eligible"],
  })
  window.addEventListener("popstate", change)
  return () => {
    observer.disconnect()
    window.removeEventListener("popstate", change)
  }
}

export function useAdvertisingContent() {
  return useSyncExternalStore(
    subscribeAdvertisingContent,
    hasAdvertisingContent,
    () => false
  )
}
