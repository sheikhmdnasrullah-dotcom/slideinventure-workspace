"use client"

import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { DASHBOARD_SECTIONS } from "@/lib/dashboard/navigation"
import { useDashboardPreferences } from "@/components/dashboard/preferences/preferences-provider"

const themeOptions = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const

export function SettingsControlCenter() {
  const {
    preferences,
    saveState,
    updatePreferences,
    moveNavigationItem,
    resetNavigationOrder,
    retrySave,
  } = useDashboardPreferences()

  const orderedSections = preferences.navigationOrder
    .map((id) => DASHBOARD_SECTIONS.find((section) => section.id === id))
    .filter((section): section is (typeof DASHBOARD_SECTIONS)[number] => Boolean(section))

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-sm font-medium tracking-wide text-foreground/60 uppercase">Settings</h1>
        <p className="text-xs text-foreground/40">Control your workspace, theme, and navigation from one place.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Theme is applied immediately and remembered across refreshes.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Label htmlFor="theme">Theme</Label>
          <Select value={preferences.theme} onValueChange={(value) => updatePreferences({ theme: value as typeof preferences.theme })}>
            <SelectTrigger id="theme" className="max-w-sm">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              {themeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Choose where the app opens for you by default.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Label htmlFor="landing-page">Default landing page</Label>
          <Select value={preferences.defaultLandingPage} onValueChange={(value) => value && updatePreferences({ defaultLandingPage: value })}>
            <SelectTrigger id="landing-page" className="max-w-sm">
              <SelectValue placeholder="Select page" />
            </SelectTrigger>
            <SelectContent>
              {DASHBOARD_SECTIONS.map((section) => (
                <SelectItem key={section.id} value={section.route}>{section.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Navigation</CardTitle>
          <CardDescription>Drag in the sidebar for the fastest path, or reorder here with buttons.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm">
            <span>
              {saveState === "saving" ? "Saving navigation…" : saveState === "saved" ? "Navigation saved" : saveState === "error" ? "Couldn’t save navigation yet" : "Navigation saves automatically"}
            </span>
            {saveState === "error" ? (
              <Button size="sm" variant="outline" onClick={retrySave}>Retry</Button>
            ) : (
              <Button size="sm" variant="outline" onClick={resetNavigationOrder}>
                <RotateCcw className="mr-2 size-4" />
                Reset to default
              </Button>
            )}
          </div>
          <div className="grid gap-2">
            {orderedSections.map((section, index) => (
              <div key={section.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div className="flex items-center gap-3">
                  <section.icon className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{section.label}</p>
                    <p className="text-xs text-muted-foreground">{section.route}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon-sm" variant="ghost" aria-label={`Move ${section.label} up`} disabled={index === 0} onClick={() => moveNavigationItem(section.id, "up")}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Move ${section.label} down`} disabled={index === orderedSections.length - 1} onClick={() => moveNavigationItem(section.id, "down")}>
                    <ArrowDown className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Integrations now live as a first-class section in the main workspace navigation.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Open <span className="font-medium text-foreground">Integrations</span> from the sidebar to manage connection records and statuses.
        </CardContent>
      </Card>

      <Separator />
    </div>
  )
}
