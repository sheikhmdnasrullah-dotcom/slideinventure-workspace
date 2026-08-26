"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import type { DashboardSectionId } from "@/lib/dashboard/navigation"
import {
  DEFAULT_DASHBOARD_PREFERENCES,
  mergeDashboardPreferences,
  normalizeDashboardPreferences,
  type DashboardPreferences,
  type SaveLifecycleState,
} from "@/lib/dashboard/preferences-shared"

type DashboardPreferencesContextValue = {
  preferences: DashboardPreferences
  saveState: SaveLifecycleState
  retrySave: () => void
  updatePreferences: (patch: Partial<DashboardPreferences>) => void
  setNavigationOrder: (order: DashboardSectionId[]) => void
  moveNavigationItem: (id: DashboardSectionId, direction: "up" | "down") => void
  resetNavigationOrder: () => void
}

const DashboardPreferencesContext = createContext<DashboardPreferencesContextValue | null>(null)

function isBrowser() {
  return typeof window !== "undefined"
}

function makeStorageKey(userEmail: string) {
  return `dashboard-preferences:${userEmail}`
}

export function DashboardPreferencesProvider({
  userEmail,
  initialPreferences,
  children,
}: {
  userEmail: string
  initialPreferences: DashboardPreferences
  children: ReactNode
}) {
  const { setTheme } = useTheme()
  const storageKey = useMemo(() => makeStorageKey(userEmail), [userEmail])
  const [preferences, setPreferences] = useState(() =>
    normalizeDashboardPreferences(initialPreferences)
  )
  const [saveState, setSaveState] = useState<SaveLifecycleState>("idle")
  const flushTimerRef = useRef<number | null>(null)
  const savingRef = useRef(false)
  const pendingRef = useRef<Partial<DashboardPreferences> | null>(null)
  const failedRef = useRef<Partial<DashboardPreferences> | null>(null)
  const savedStateTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isBrowser()) return
    window.localStorage.setItem(storageKey, JSON.stringify(preferences))
  }, [preferences, storageKey])

  // Apply the locally-cached preferences after mount so the first client
  // render matches the server (no hydration mismatch), then layers the
  // browser copy on top.
  useEffect(() => {
    if (!isBrowser()) return
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      setPreferences((current) => mergeDashboardPreferences(current, parsed))
    } catch {
      window.localStorage.removeItem(storageKey)
    }
  }, [storageKey])

  useEffect(() => {
    setTheme(preferences.theme)
  }, [preferences.theme, setTheme])

  const flushPending = useCallback(async () => {
    if (savingRef.current) return
    if (!pendingRef.current) return

    savingRef.current = true
    setSaveState("saving")

    try {
      while (pendingRef.current) {
        const patch = pendingRef.current
        pendingRef.current = null

        const res = await fetch("/api/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        })

        if (!res.ok) {
          const json = await res.json().catch(() => null)
          throw new Error(json?.error?.message || json?.message || "Could not save preferences")
        }

        failedRef.current = null
      }

      setSaveState("saved")
      if (savedStateTimerRef.current) window.clearTimeout(savedStateTimerRef.current)
      savedStateTimerRef.current = window.setTimeout(() => setSaveState("idle"), 1800)
    } catch (error) {
      failedRef.current = {
        ...(failedRef.current ?? {}),
        ...(pendingRef.current ?? {}),
      }
      if (!pendingRef.current) {
        pendingRef.current = failedRef.current
      }
      setSaveState("error")
      toast.error((error as Error).message || "Could not save preferences")
    } finally {
      savingRef.current = false
      if (pendingRef.current && saveState !== "error") {
        void flushPending()
      }
    }
  }, [saveState])

  const schedulePersist = useCallback((patch: Partial<DashboardPreferences>) => {
    pendingRef.current = {
      ...(pendingRef.current ?? {}),
      ...patch,
    }
    failedRef.current = null

    if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current)
    flushTimerRef.current = window.setTimeout(() => {
      void flushPending()
    }, 150)
  }, [flushPending])

  const updatePreferences = useCallback((patch: Partial<DashboardPreferences>) => {
    setPreferences((current) => mergeDashboardPreferences(current, patch))
    schedulePersist(patch)
  }, [schedulePersist])

  const setNavigationOrder = useCallback((order: DashboardSectionId[]) => {
    updatePreferences({ navigationOrder: order })
  }, [updatePreferences])

  const moveNavigationItem = useCallback((id: DashboardSectionId, direction: "up" | "down") => {
    setPreferences((current) => {
      const index = current.navigationOrder.indexOf(id)
      if (index === -1) return current
      const targetIndex = direction === "up" ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= current.navigationOrder.length) return current
      const nextOrder = [...current.navigationOrder]
      const [item] = nextOrder.splice(index, 1)
      nextOrder.splice(targetIndex, 0, item)
      schedulePersist({ navigationOrder: nextOrder })
      return mergeDashboardPreferences(current, { navigationOrder: nextOrder })
    })
  }, [schedulePersist])

  const resetNavigationOrder = useCallback(() => {
    updatePreferences({ navigationOrder: DEFAULT_DASHBOARD_PREFERENCES.navigationOrder })
  }, [updatePreferences])

  const retrySave = useCallback(() => {
    if (!failedRef.current && !pendingRef.current) return
    pendingRef.current = {
      ...(failedRef.current ?? {}),
      ...(pendingRef.current ?? {}),
    }
    failedRef.current = null
    void flushPending()
  }, [flushPending])

  const value = useMemo<DashboardPreferencesContextValue>(() => ({
    preferences,
    saveState,
    retrySave,
    updatePreferences,
    setNavigationOrder,
    moveNavigationItem,
    resetNavigationOrder,
  }), [preferences, retrySave, saveState, updatePreferences, setNavigationOrder, moveNavigationItem, resetNavigationOrder])

  return (
    <DashboardPreferencesContext.Provider value={value}>
      {children}
    </DashboardPreferencesContext.Provider>
  )
}

export function useDashboardPreferences() {
  const value = useContext(DashboardPreferencesContext)
  if (!value) throw new Error("useDashboardPreferences must be used within DashboardPreferencesProvider")
  return value
}
