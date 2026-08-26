import type { DashboardSectionId } from "@/lib/dashboard/navigation"
import {
  DEFAULT_NAVIGATION_ORDER,
  isValidLandingPageRoute,
  mergeNavigationOrder,
  NAVIGATION_SECTION_IDS,
} from "@/lib/dashboard/navigation"

export type DashboardThemePreference = "system" | "light" | "dark"
export type SaveLifecycleState = "idle" | "saving" | "saved" | "error"

export type DashboardPreferences = {
  theme: DashboardThemePreference
  defaultLandingPage: string
  navigationOrder: DashboardSectionId[]
  labels: Record<string, string>
}

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  theme: "light",
  defaultLandingPage: "/dashboard",
  navigationOrder: DEFAULT_NAVIGATION_ORDER,
  labels: {},
}

function sanitizeLabels(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") return {}
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!NAVIGATION_SECTION_IDS.has(key as DashboardSectionId)) continue
    if (typeof value !== "string") continue
    const trimmed = value.trim()
    if (!trimmed) continue
    result[key] = trimmed
  }
  return result
}

export function normalizeDashboardPreferences(
  input: Partial<DashboardPreferences> | null | undefined
): DashboardPreferences {
  const theme = input?.theme
  const defaultLandingPage = isValidLandingPageRoute(input?.defaultLandingPage)
    ? input!.defaultLandingPage!
    : DEFAULT_DASHBOARD_PREFERENCES.defaultLandingPage

  return {
    theme: theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : DEFAULT_DASHBOARD_PREFERENCES.theme,
    defaultLandingPage,
    navigationOrder: mergeNavigationOrder(input?.navigationOrder ?? DEFAULT_NAVIGATION_ORDER),
    labels: sanitizeLabels(input?.labels),
  }
}

export function mergeDashboardPreferences(
  current: DashboardPreferences,
  patch: Partial<DashboardPreferences>
): DashboardPreferences {
  return normalizeDashboardPreferences({
    ...current,
    ...patch,
  })
}
