"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ChevronDown, RotateCcw } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DASHBOARD_SECTIONS, getOrderedSections } from "@/lib/dashboard/navigation"
import { useDashboardPreferences } from "@/components/dashboard/preferences/preferences-provider"
import { SiteHeader } from "@/components/dashboard/site-header"
import { PageHeader } from "@/components/system"

const themeOptions = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const

function SettingsSection({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string
  description?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-md border border-rule bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-2)]/50"
      >
        <div>
          <p className="font-body-tight text-sm font-medium text-ink-strong">{title}</p>
          {description ? <p className="font-body text-xs text-ink-muted">{description}</p> : null}
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-ink-faint transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="grid gap-4 border-t border-rule px-4 py-4">{children}</div>
      ) : null}
    </div>
  )
}

export function SettingsControlCenter() {
  const {
    preferences,
    saveState,
    updatePreferences,
    moveNavigationItem,
    resetNavigationOrder,
    retrySave,
  } = useDashboardPreferences()

  const orderedSections = getOrderedSections(preferences.navigationOrder, preferences.labels)
  const defaultLabels = useMemo(
    () => Object.fromEntries(DASHBOARD_SECTIONS.map((section) => [section.id, section.label])),
    []
  )

  function setSectionLabel(id: string, value: string) {
    const trimmed = value.trim()
    const nextLabels = { ...preferences.labels }
    if (!trimmed || trimmed === defaultLabels[id]) {
      delete nextLabels[id]
    } else {
      nextLabels[id] = trimmed
    }
    updatePreferences({ labels: nextLabels })
  }

  return (
    <>
      <SiteHeader crumbs={[{ label: "Settings" }]} subtitle="Control center" />
      <div className="flex flex-1 flex-col gap-4 p-6">
      <PageHeader eyebrow="Workspace" title="Settings" meta="Control your workspace, theme, and navigation from one place" />

      <SettingsSection title="Appearance" description="Theme is applied immediately and remembered across refreshes.">
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
      </SettingsSection>

      <SettingsSection title="Workspace" description="Choose where the app opens for you by default.">
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
      </SettingsSection>

      <SettingsSection title="Section names" description="Rename any section to match how you think. Names are saved and stay after refresh or logout.">
        <div className="flex items-center justify-between rounded-md border border-rule bg-[var(--surface-2)] px-3 py-2 font-body text-sm text-ink-muted">
          <span>
            {saveState === "saving" ? "Saving names" : saveState === "saved" ? "Names saved" : saveState === "error" ? "Couldn’t save yet" : "Names save automatically"}
          </span>
          <Button size="sm" variant="outline" onClick={() => updatePreferences({ labels: {} })}>
            <RotateCcw className="mr-2 size-4" />
            Reset names
          </Button>
        </div>
        <div className="grid gap-2">
          {orderedSections.map((section) => (
            <div key={section.id} className="flex items-center justify-between gap-3 rounded-md border border-rule px-3 py-2">
              <div className="flex items-center gap-3">
                <section.icon className="size-4 text-ink-faint" />
                <div>
                  <p className="font-label text-ink-faint">{section.route}</p>
                </div>
              </div>
              <Input
                aria-label={`Rename ${defaultLabels[section.id]}`}
                value={section.label}
                key={section.id}
                placeholder={defaultLabels[section.id]}
                className="max-w-xs"
                onChange={(event) => setSectionLabel(section.id, event.target.value)}
              />
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Navigation" description="Drag in the sidebar for the fastest path, or reorder here with buttons.">
        <div className="flex items-center justify-between rounded-md border border-rule bg-[var(--surface-2)] px-3 py-2 font-body text-sm text-ink-muted">
          <span>
            {saveState === "saving" ? "Saving navigation" : saveState === "saved" ? "Navigation saved" : saveState === "error" ? "Couldn’t save navigation yet" : "Navigation saves automatically"}
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
            <div key={section.id} className="flex items-center justify-between rounded-md border border-rule px-3 py-2">
              <div className="flex items-center gap-3">
                <section.icon className="size-4 text-ink-faint" />
                <div>
                  <p className="text-sm font-medium">{section.label}</p>
                  <p className="font-label text-ink-faint">{section.route}</p>
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
      </SettingsSection>

      <SettingsSection title="Integrations" description="Integrations now live as a first-class section in the main workspace navigation.">
        <p className="font-body text-sm text-ink-muted">
          Open <span className="font-medium text-ink-strong">Integrations</span> from the sidebar to manage connection records and statuses.
        </p>
      </SettingsSection>
      </div>
    </>
  )
}
