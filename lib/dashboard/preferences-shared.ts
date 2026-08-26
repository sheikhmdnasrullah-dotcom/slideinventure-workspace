import type { DashboardSectionId } from "@/lib/dashboard/navigation"
import { DEFAULT_NAVIGATION_ORDER, isValidLandingPageRoute, mergeNavigationOrder } from "@/lib/dashboard/navigation"

export type DashboardThemePreference = "system" | "light" | "dark"
export type SaveLifecycleState = "idle" | "saving" | "saved" | "error"

export type DashboardPreferences = {
  theme: DashboardThemePreference
  defaultLandingPage: string
  navigationOrder: DashboardSectionId[]
}

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  theme: "system",
  defaultLandingPage: "/dashboard",
  navigationOrder: DEFAULT_NAVIGATION_ORDER,
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
