import "server-only"

import { Query } from "node-appwrite"

import { APPWRITE } from "@/lib/appwrite/config"
import { databases, ID } from "@/lib/appwrite/server"
import {
  DEFAULT_DASHBOARD_PREFERENCES,
  mergeDashboardPreferences,
  normalizeDashboardPreferences,
  type DashboardPreferences,
  type DashboardThemePreference,
} from "@/lib/dashboard/preferences-shared"

const DB = APPWRITE.databaseId
const COL = APPWRITE.collections.userPreferences
const REQUIRED_KEYS = [
  "user_email",
  "theme",
  "default_landing_page",
  "navigation_order",
  "labels",
  "created_at",
  "updated_at",
] as const

type AppwriteAttribute = {
  key: string
  status?: string
}

type PreferencesDocument = Record<string, unknown> & {
  $id?: string
  created_at?: string
  updated_at?: string
  theme?: string
  default_landing_page?: string
  navigation_order?: string
  labels?: string
}

let ensurePromise: Promise<void> | null = null

function isAppwriteError(error: unknown, code?: number) {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (code === undefined || Number((error as { code?: number }).code) === code)
  )
}

async function waitForCollectionShape() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const attributes = await databases.listAttributes(DB, COL)
    const availableKeys = new Set(
      (attributes.attributes as AppwriteAttribute[])
        .filter((attribute) => attribute.status === undefined || attribute.status === "available")
        .map((attribute) => attribute.key)
    )

    if (REQUIRED_KEYS.every((key) => availableKeys.has(key))) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error("Timed out preparing user preferences collection")
}

async function ensurePreferencesCollectionInner() {
  try {
    await databases.getCollection(DB, COL)
  } catch (error) {
    if (!isAppwriteError(error, 404)) throw error
    try {
      await databases.createCollection(DB, COL, "User Preferences", [], false, true)
    } catch (createError) {
      if (!isAppwriteError(createError, 409)) throw createError
    }
  }

  const attributes = await databases.listAttributes(DB, COL)
  const existing = new Set((attributes.attributes as AppwriteAttribute[]).map((attribute) => attribute.key))

  const tasks: Promise<unknown>[] = []

  if (!existing.has("user_email")) {
    tasks.push(databases.createStringAttribute(DB, COL, "user_email", 320, true))
  }
  if (!existing.has("theme")) {
    tasks.push(databases.createEnumAttribute(DB, COL, "theme", ["system", "light", "dark"], false, "light"))
  }
  if (!existing.has("default_landing_page")) {
    tasks.push(databases.createStringAttribute(DB, COL, "default_landing_page", 255, false, DEFAULT_DASHBOARD_PREFERENCES.defaultLandingPage))
  }
  if (!existing.has("navigation_order")) {
    tasks.push(databases.createStringAttribute(DB, COL, "navigation_order", 8192, false, JSON.stringify(DEFAULT_DASHBOARD_PREFERENCES.navigationOrder)))
  }
  if (!existing.has("labels")) {
    tasks.push(databases.createStringAttribute(DB, COL, "labels", 8192, false, "{}"))
  }
  if (!existing.has("created_at")) {
    tasks.push(databases.createDatetimeAttribute(DB, COL, "created_at", true))
  }
  if (!existing.has("updated_at")) {
    tasks.push(databases.createDatetimeAttribute(DB, COL, "updated_at", true))
  }

  await Promise.all(
    tasks.map((task) =>
      task.catch((error) => {
        if (!isAppwriteError(error, 409)) throw error
      })
    )
  )

  await waitForCollectionShape()
}

export async function ensurePreferencesCollection() {
  if (!ensurePromise) {
    ensurePromise = ensurePreferencesCollectionInner().catch((error) => {
      ensurePromise = null
      throw error
    })
  }

  return ensurePromise
}

function parseNavigationOrder(value: unknown) {
  if (typeof value !== "string") return undefined
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function parseLabels(value: unknown) {
  if (typeof value !== "string") return undefined
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" ? parsed : undefined
  } catch {
    return undefined
  }
}

function serializePreferences(doc: PreferencesDocument | null): DashboardPreferences {
  if (!doc) return DEFAULT_DASHBOARD_PREFERENCES

  return normalizeDashboardPreferences({
    theme: doc.theme as DashboardThemePreference | undefined,
    defaultLandingPage: doc.default_landing_page,
    navigationOrder: parseNavigationOrder(doc.navigation_order),
    labels: parseLabels(doc.labels),
  })
}

async function fetchPreferenceDocument(userEmail: string): Promise<PreferencesDocument | null> {
  await ensurePreferencesCollection()
  const res = await databases.listDocuments(DB, COL, [
    Query.equal("user_email", userEmail),
    Query.orderDesc("updated_at"),
    Query.limit(5),
  ])

  return res.documents[0] ?? null
}

export async function getDashboardPreferencesForUser(userEmail: string): Promise<DashboardPreferences> {
  try {
    const doc = await fetchPreferenceDocument(userEmail)
    return serializePreferences(doc)
  } catch {
    return DEFAULT_DASHBOARD_PREFERENCES
  }
}

export async function upsertDashboardPreferencesForUser(
  userEmail: string,
  patch: Partial<DashboardPreferences>
): Promise<DashboardPreferences> {
  await ensurePreferencesCollection()

  const existingDoc = await fetchPreferenceDocument(userEmail)
  const current = serializePreferences(existingDoc)
  const next = mergeDashboardPreferences(current, patch)
  const now = new Date().toISOString()

  const payload = {
    user_email: userEmail,
    theme: next.theme,
    default_landing_page: next.defaultLandingPage,
    navigation_order: JSON.stringify(next.navigationOrder),
    labels: JSON.stringify(next.labels),
    created_at: existingDoc?.created_at ?? now,
    updated_at: now,
  }

  if (existingDoc) {
    await databases.updateDocument(DB, COL, existingDoc.$id!, payload)
  } else {
    await databases.createDocument(DB, COL, ID.unique(), payload)
  }

  return next
}
