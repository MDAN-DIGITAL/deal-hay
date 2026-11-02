"use client"

import { useEffect } from "react"

import { useAdvertisingContent } from "@/hooks/use-advertising-content"
import { initializeGoogleAdsense } from "@/lib/google-adsense"

export function StorefrontAdvertising() {
  const contentReady = useAdvertisingContent()

  useEffect(() => {
    if (contentReady) initializeGoogleAdsense(document)
  }, [contentReady])

  return null
}
