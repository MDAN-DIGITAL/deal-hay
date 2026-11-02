"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  BACKGROUND_NOTIFICATIONS_CHANGED,
  backgroundNotificationAvailability,
  backgroundNotificationOwner,
  backgroundNotificationPendingOwner,
  clearBackgroundNotificationOwner,
  enableBackgroundNotifications,
  loadPushConfig,
  notificationWorker,
  restoreBackgroundNotifications,
  type PushConfig,
} from "@/modules/realtime/lib/background-notifications"

const initial = {
  supported: false,
  installRequired: false,
  permission: "unsupported" as NotificationPermission | "unsupported",
  enabled: false,
  configured: false,
  loading: false,
  error: undefined as string | undefined,
}

export function useBackgroundNotifications(currentUserId?: string) {
  const [state, setState] = useState(initial)
  const config = useRef<PushConfig | null>(null)
  const revision = useRef(0)
  const action = useRef(0)
  const busy = useRef(false)
  const owner = useRef(currentUserId)
  const mounted = useRef(false)
  owner.current = currentUserId
  const invalidateRequests = useCallback(() => {
    action.current++
    revision.current++
    busy.current = false
  }, [])

  useEffect(() => {
    let disposed = false
    mounted.current = true
    const availability = backgroundNotificationAvailability()
    setState({
      ...initial,
      ...availability,
      loading: !!currentUserId && availability.supported,
    })
    config.current = null
    if (!currentUserId || !availability.supported)
      return () => {
        mounted.current = false
      }
    // Registration requires no permission; preparing it here preserves the enable click's gesture.
    void notificationWorker().catch(() => {})
    const previousOwner =
      backgroundNotificationOwner() ?? backgroundNotificationPendingOwner()
    const prepared =
      previousOwner && previousOwner !== currentUserId
        ? clearBackgroundNotificationOwner(previousOwner)
        : Promise.resolve()
    const refresh = () => {
      if (document.visibilityState === "hidden" || busy.current) return
      const request = ++revision.current
      const current = backgroundNotificationAvailability()
      setState((previous) => ({
        ...previous,
        ...current,
        enabled:
          previous.enabled &&
          backgroundNotificationOwner() === currentUserId &&
          current.permission === "granted",
      }))
      void prepared
        .then(loadPushConfig)
        .then(async (value) => {
          if (disposed || request !== revision.current) return
          config.current = value
          const enabled =
            current.permission === "granted" &&
            (await restoreBackgroundNotifications(currentUserId, value))
          if (!disposed && request === revision.current)
            setState({
              ...current,
              enabled,
              configured: value.enabled,
              loading: false,
              error: undefined,
            })
        })
        .catch((error: unknown) => {
          if (!disposed && request === revision.current)
            setState((previous) => ({
              ...previous,
              loading: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Không thể tải cài đặt thông báo nền.",
            }))
        })
    }
    refresh()
    window.addEventListener("focus", refresh)
    window.addEventListener("storage", refresh)
    window.addEventListener(BACKGROUND_NOTIFICATIONS_CHANGED, refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      disposed = true
      mounted.current = false
      invalidateRequests()
      window.removeEventListener("focus", refresh)
      window.removeEventListener("storage", refresh)
      window.removeEventListener(BACKGROUND_NOTIFICATIONS_CHANGED, refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [currentUserId, invalidateRequests])

  const enable = useCallback(async (): Promise<boolean> => {
    if (!currentUserId || !backgroundNotificationAvailability().supported)
      return false
    // Safari requires the permission prompt to start directly inside the click handler.
    ++revision.current
    const operation = ++action.current
    busy.current = true
    const isCurrent = () =>
      mounted.current &&
      owner.current === currentUserId &&
      action.current === operation
    setState((previous) => ({ ...previous, loading: true, error: undefined }))
    try {
      const permissionRequest =
        Notification.permission === "granted"
          ? Promise.resolve("granted" as const)
          : Notification.requestPermission()
      const permission = await permissionRequest
      if (!isCurrent()) return false
      if (permission !== "granted") {
        setState((previous) => ({
          ...previous,
          permission,
          enabled: false,
          loading: false,
          error:
            permission === "denied"
              ? "Thông báo đang bị chặn. Hãy cho phép trong cài đặt trình duyệt."
              : "Bạn chưa cho phép thông báo.",
        }))
        return false
      }
      const value = config.current ?? (await loadPushConfig())
      if (!isCurrent()) return false
      config.current = value
      await enableBackgroundNotifications(currentUserId, value, isCurrent)
      if (!isCurrent()) {
        await clearBackgroundNotificationOwner(currentUserId)
        return false
      }
      setState((previous) => ({
        ...previous,
        permission,
        enabled: true,
        configured: value.enabled,
        loading: false,
        error: undefined,
      }))
      return true
    } catch (error) {
      if (isCurrent())
        setState((previous) => ({
          ...previous,
          permission: Notification.permission,
          enabled: false,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Không thể bật thông báo nền.",
        }))
      return false
    } finally {
      if (action.current === operation) busy.current = false
    }
  }, [currentUserId])

  const disable = useCallback(async () => {
    ++revision.current
    const operation = ++action.current
    busy.current = true
    const isCurrent = () =>
      mounted.current &&
      owner.current === currentUserId &&
      action.current === operation
    setState((previous) => ({ ...previous, loading: true, error: undefined }))
    try {
      await clearBackgroundNotificationOwner(currentUserId)
      if (isCurrent())
        setState((previous) => ({
          ...previous,
          enabled: false,
          loading: false,
        }))
    } catch (error) {
      if (isCurrent())
        setState((previous) => ({
          ...previous,
          enabled: false,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Không thể tắt thông báo nền.",
        }))
    } finally {
      if (action.current === operation) busy.current = false
    }
  }, [currentUserId])

  return { ...state, enable, disable }
}
