"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

const PREFERENCE_EVENT = "deal-hay:notification-sound-change"
const PENDING_SOUND_MAX_AGE = 30_000
const preferences = new Map<string, boolean>()

function readPreference(key: string): boolean {
  if (preferences.has(key)) return preferences.get(key) as boolean
  try {
    return window.localStorage.getItem(key) !== "muted"
  } catch {
    return preferences.get(key) ?? true
  }
}

function claimSound(key: string, eventId: string): boolean {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) || "null")
    const ids: string[] = Array.isArray(stored?.ids)
      ? stored.ids.filter((id: unknown) => typeof id === "string").slice(-99)
      : []
    if (ids.includes(eventId)) return false

    const now = Date.now()
    const previousPlayedAt =
      typeof stored?.playedAt === "number" && Number.isFinite(stored.playedAt)
        ? stored.playedAt
        : null
    const elapsed =
      previousPlayedAt === null ? Infinity : now - previousPlayedAt
    const canPlay = elapsed < 0 || elapsed >= 1000
    window.localStorage.setItem(
      key,
      JSON.stringify({
        ids: [...ids, eventId],
        playedAt: canPlay ? now : previousPlayedAt,
      })
    )
    return canPlay
  } catch {
    return true
  }
}

function playChime(context: AudioContext) {
  for (const [index, frequency] of [880, 1174].entries()) {
    const start = context.currentTime + index * 0.24
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(frequency, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.24, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.addEventListener(
      "ended",
      () => {
        oscillator.disconnect()
        gain.disconnect()
      },
      { once: true }
    )
    oscillator.start(start)
    oscillator.stop(start + 0.23)
  }
}

export function useNotificationSound(currentUserId?: string) {
  const preferenceKey = `deal-hay:notification-sound:${currentUserId ?? "guest"}`
  const [readiness, setReadiness] = useState<{
    userId: string
    ready: boolean
  } | null>(null)
  const player = useRef<{
    play: (eventId: string) => void
    test: () => Promise<boolean>
    clearPending: () => void
  } | null>(null)

  const subscribe = useCallback(
    (onChange: () => void) => {
      const handleStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === preferenceKey) {
          preferences.delete(preferenceKey)
          onChange()
        }
      }
      window.addEventListener("storage", handleStorage)
      window.addEventListener(PREFERENCE_EVENT, onChange)
      return () => {
        window.removeEventListener("storage", handleStorage)
        window.removeEventListener(PREFERENCE_EVENT, onChange)
      }
    },
    [preferenceKey]
  )
  const getSnapshot = useCallback(
    () => Boolean(currentUserId) && readPreference(preferenceKey),
    [currentUserId, preferenceKey]
  )
  const getServerSnapshot = useCallback(
    () => Boolean(currentUserId),
    [currentUserId]
  )
  const notificationSoundEnabled = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  useEffect(() => {
    if (!currentUserId) return

    let context: AudioContext | null = null
    let disposed = false
    let lastPlayedAt = -Infinity
    let pending: { id: string; receivedAt: number } | null = null
    let resuming: AudioContext | null = null
    const received = new Set<string>()
    const testWaiters = new Set<() => void>()
    const claimKey = `deal-hay:notification-sound-events:${currentUserId}`

    const updateReadiness = () => {
      if (disposed) return
      const ready = context?.state === "running"
      setReadiness((previous) =>
        previous?.userId === currentUserId && previous.ready === ready
          ? previous
          : { userId: currentUserId, ready }
      )
    }

    const flushPending = () => {
      if (!pending || context?.state !== "running") return
      const sound = pending
      pending = null
      if (performance.now() - sound.receivedAt > PENDING_SOUND_MAX_AGE) return

      const playOnce = () => {
        if (
          disposed ||
          !readPreference(preferenceKey) ||
          context?.state !== "running"
        ) {
          return
        }
        if (performance.now() - lastPlayedAt < 1000) return
        if (!claimSound(claimKey, sound.id)) return

        try {
          playChime(context)
          lastPlayedAt = performance.now()
        } catch {
          // An unsupported or blocked audio device leaves visual alerts intact.
        }
      }

      if (navigator.locks?.request) {
        void navigator.locks
          .request(claimKey, { ifAvailable: true }, (lock) => {
            if (lock) playOnce()
          })
          .catch(() => playOnce())
      } else {
        playOnce()
      }
    }

    const handleStateChange = () => {
      updateReadiness()
      flushPending()
    }

    const activate = (fromGesture = false): AudioContext | null => {
      if (disposed || !readPreference(preferenceKey)) return null
      try {
        if (!context || context.state === "closed") {
          const AudioContextConstructor =
            window.AudioContext ??
            (
              window as Window & {
                webkitAudioContext?: typeof AudioContext
              }
            ).webkitAudioContext
          if (typeof AudioContextConstructor !== "function") return null
          context?.removeEventListener("statechange", handleStateChange)
          context = new AudioContextConstructor()
          context.addEventListener("statechange", handleStateChange)
        }
        const audio = context
        updateReadiness()
        if (audio.state === "running") {
          flushPending()
        } else if (fromGesture || resuming !== audio) {
          // Call resume directly in the gesture handler, including touchend on
          // Safari. A previous autoplay-blocked resume may still be pending.
          resuming = audio
          void audio
            .resume()
            .then(() => {
              if (resuming === audio) resuming = null
              if (!disposed && context === audio) handleStateChange()
            })
            .catch(() => {
              if (resuming === audio) resuming = null
              updateReadiness()
            })
        }
        return audio
      } catch {
        // Sound availability must never interrupt navigation or chat delivery.
        return null
      }
    }

    const play = (eventId: string) => {
      if (disposed || !eventId || !readPreference(preferenceKey)) return
      if (received.has(eventId)) return
      received.add(eventId)
      if (received.size > 100) received.delete(received.values().next().value!)
      // Keep one recent alert until autoplay is unlocked; never replay a burst.
      pending = { id: eventId, receivedAt: performance.now() }
      activate()
    }

    const waitForRunning = (audio: AudioContext): Promise<boolean> => {
      if (audio.state === "running") return Promise.resolve(true)
      return new Promise((resolve) => {
        const finish = () => {
          clearTimeout(timeout)
          audio.removeEventListener("statechange", handleChange)
          testWaiters.delete(finish)
          resolve(!disposed && audio.state === "running")
        }
        const handleChange = () => {
          if (audio.state === "running" || audio.state === "closed") finish()
        }
        const timeout = setTimeout(finish, 1500)
        testWaiters.add(finish)
        audio.addEventListener("statechange", handleChange)
      })
    }

    const test = async () => {
      pending = null
      const audio = activate(true)
      if (!audio || !(await waitForRunning(audio))) return false
      if (disposed || !readPreference(preferenceKey)) return false
      try {
        playChime(audio)
        return true
      } catch {
        return false
      }
    }

    const clearPending = () => {
      pending = null
    }
    const handlePreferenceChange = () => {
      if (!readPreference(preferenceKey)) clearPending()
    }
    const unlock = () => {
      activate(true)
    }
    const recover = () => {
      if (context && document.visibilityState === "visible") activate()
    }

    player.current = { play, test, clearPending }
    for (const event of ["pointerdown", "touchend", "click", "keydown"]) {
      document.addEventListener(event, unlock, true)
    }
    document.addEventListener("visibilitychange", recover)
    window.addEventListener("focus", recover)
    window.addEventListener("pageshow", recover)
    window.addEventListener("storage", handlePreferenceChange)
    window.addEventListener(PREFERENCE_EVENT, handlePreferenceChange)
    return () => {
      disposed = true
      player.current = null
      pending = null
      for (const finish of testWaiters) finish()
      for (const event of ["pointerdown", "touchend", "click", "keydown"]) {
        document.removeEventListener(event, unlock, true)
      }
      document.removeEventListener("visibilitychange", recover)
      window.removeEventListener("focus", recover)
      window.removeEventListener("pageshow", recover)
      window.removeEventListener("storage", handlePreferenceChange)
      window.removeEventListener(PREFERENCE_EVENT, handlePreferenceChange)
      context?.removeEventListener("statechange", handleStateChange)
      if (context && context.state !== "closed") {
        void context.close().catch(() => {})
      }
    }
  }, [currentUserId, preferenceKey])

  const toggleNotificationSound = useCallback(() => {
    if (!currentUserId) return
    const enabled = !readPreference(preferenceKey)
    try {
      window.localStorage.setItem(preferenceKey, enabled ? "enabled" : "muted")
      preferences.delete(preferenceKey)
    } catch {
      preferences.set(preferenceKey, enabled)
      // Keep the preference for this tab when browser storage is unavailable.
    }
    window.dispatchEvent(new Event(PREFERENCE_EVENT))
    if (enabled) void player.current?.test()
    else player.current?.clearPending()
  }, [currentUserId, preferenceKey])

  const playNotificationSound = useCallback((eventId: string) => {
    player.current?.play(eventId)
  }, [])

  const testNotificationSound = useCallback(
    () => player.current?.test() ?? Promise.resolve(false),
    []
  )

  return {
    notificationSoundEnabled,
    soundReady:
      notificationSoundEnabled &&
      readiness?.userId === currentUserId &&
      readiness?.ready === true,
    toggleNotificationSound,
    playNotificationSound,
    testNotificationSound,
  }
}
