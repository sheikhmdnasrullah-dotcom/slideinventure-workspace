"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { ActiveTabIndicator } from "@/components/system/motion"
import {
  Search,
  Building2,
  ChevronRight,
  FileSpreadsheet,
  Plus,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/system/states"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  UniversalOpportunity,
  OpportunityStage,
  OpportunityVertical,
} from "@/lib/opportunities/types"
import { MOCK_OPPORTUNITIES } from "@/lib/opportunities/mock-data"
import { OpportunityDossierModal } from "./opportunity-dossier-modal"

const STAGES: { id: OpportunityStage | "all"; label: string; count?: number }[] = [
  { id: "all", label: "All Opportunities" },
  { id: "discovered", label: "Discovered" },
  { id: "researched", label: "Researched" },
  { id: "qualified", label: "Qualified" },
  { id: "outreach_active", label: "Outreach Active" },
  { id: "replied", label: "Replied" },
  { id: "meeting_booked", label: "Meeting Booked" },
]

const VERTICALS: { id: OpportunityVertical | "all"; label: string }[] = [
  { id: "all", label: "All Verticals" },
  { id: "saas", label: "B2B SaaS" },
  { id: "agency", label: "Agencies & Growth" },
  { id: "mortgage_lending", label: "Mortgage & Lending" },
  { id: "real_estate", label: "Commercial Real Estate" },
  { id: "professional_services", label: "Professional Services" },
]

export function OpportunityPipelineView() {
  const [search, setSearch] = React.useState("")
  const [selectedVertical, setSelectedVertical] = React.useState<OpportunityVertical | "all">("all")
  const [selectedStage, setSelectedStage] = React.useState<OpportunityStage | "all">("all")
  const [activeOpportunity, setActiveOpportunity] = React.useState<UniversalOpportunity | null>(null)
  const [isDossierOpen, setIsDossierOpen] = React.useState(false)
  const [firstPaint, setFirstPaint] = React.useState(true)
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setFirstPaint(false))
    return () => cancelAnimationFrame(id)
  }, [])

  const filteredOpportunities = React.useMemo(() => {
    return MOCK_OPPORTUNITIES.filter((opp) => {
      if (selectedVertical !== "all" && opp.vertical !== selectedVertical) return false
      if (selectedStage !== "all" && opp.stage !== selectedStage) return false
      if (search.trim()) {
        const query = search.toLowerCase()
        const matchName = `${opp.prospect.first_name} ${opp.prospect.last_name}`.toLowerCase().includes(query)
        const matchCompany = opp.account.company_name.toLowerCase().includes(query)
        const matchTitle = opp.prospect.job_title.toLowerCase().includes(query)
        const matchNeed = opp.need.core_problem.toLowerCase().includes(query)
        if (!matchName && !matchCompany && !matchTitle && !matchNeed) return false
      }
      return true
    })
  }, [search, selectedVertical, selectedStage])

  const stageCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: MOCK_OPPORTUNITIES.length }
    for (const opp of MOCK_OPPORTUNITIES) {
      counts[opp.stage] = (counts[opp.stage] || 0) + 1
    }
    return counts
  }, [])

  const handleOpenDossier = (opp: UniversalOpportunity) => {
    setActiveOpportunity(opp)
    setIsDossierOpen(true)
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Controls */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-lg border border-rule bg-surface p-4 shadow-raised lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative min-w-[280px] flex-1 lg:flex-initial">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-[18px] text-ink-faint" />
            <Input
              placeholder="Search by prospect, company, ICP signal, need..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            value={selectedVertical}
            onValueChange={(val) => setSelectedVertical(val as OpportunityVertical | "all")}
          >
            <SelectTrigger className="w-[180px]">
              <Building2 className="mr-2 size-4 text-ink-faint" />
              <SelectValue placeholder="Vertical" />
            </SelectTrigger>
            <SelectContent>
              {VERTICALS.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 self-end lg:self-auto">
          <Badge variant="outline" className="tabular-nums">
            {filteredOpportunities.length} Active Pursuits
          </Badge>
          <Button variant="outline" size="sm">
            <FileSpreadsheet className="size-4" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="size-4" />
            New Pursuit
          </Button>
        </div>
      </div>

      {/* Stage Navigation Pills */}
      <div className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-pill bg-surface-2 p-1 text-sm scrollbar-none">
        {STAGES.map((s) => {
          const count = stageCounts[s.id] || 0
          const isActive = selectedStage === s.id
          return (
            <button
              key={s.id}
              onClick={() => setSelectedStage(s.id)}
              className={`relative flex h-8 shrink-0 items-center gap-2 rounded-pill px-4 text-[13px] font-medium whitespace-nowrap transition-colors duration-[220ms] ${
                isActive ? "text-ink-strong" : "text-ink-muted hover:text-ink-strong"
              }`}
            >
              {isActive && <ActiveTabIndicator />}
              <span className="relative z-10">{s.label}</span>
              <span
                className={`relative z-10 rounded-pill px-1.5 py-0.5 text-xs tabular-nums ${
                  isActive ? "bg-surface-2 text-ink-strong" : "text-ink-faint"
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Opportunities List */}
      <div className="grid grid-cols-1 gap-3">
          {filteredOpportunities.map((opp, index) => {
            const hasReply = opp.thread?.messages?.some((m) => m.direction === "inbound") ?? false
            const isBooked = opp.stage === "meeting_booked"

            return (
              <motion.div
                key={opp.id}
                initial={firstPaint ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.24,
                  ease: [0.22, 1, 0.36, 1],
                  delay: firstPaint ? Math.min(index, 5) * 0.03 : 0,
                }}
                onClick={() => handleOpenDossier(opp)}
                className="group relative flex cursor-pointer flex-col items-start justify-between gap-4 rounded-lg border border-rule bg-surface p-6 shadow-raised transition-[box-shadow] duration-[150ms] hover:shadow-float md:flex-row md:items-center"
              >
                {/* Left: Contact, Company, Vertical */}
                <div className="flex items-start gap-3.5 min-w-[280px]">
                  <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-status-neutral-bg font-semibold text-status-neutral">
                    {(opp.prospect?.first_name?.[0] ?? "P").toUpperCase()}
                    {(opp.prospect?.last_name?.[0] ?? "").toUpperCase()}
                    {hasReply && (
                      <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-status-live ring-2 ring-surface animate-pulse" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink-strong">
                        {[opp.prospect?.first_name, opp.prospect?.last_name].filter(Boolean).join(" ") || "Prospect"}
                      </span>
                      <Badge variant="outline">
                        {(opp.vertical || "general").replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-muted">
                      <span>{opp.prospect?.job_title || "Lead"}</span>
                      <span>•</span>
                      <span className="font-medium text-ink-strong">{opp.account?.company_name || "Company"}</span>
                    </div>
                  </div>
                </div>

                {/* Middle: Core Buying Signal & Intent */}
                <div className="flex-1 max-w-xl text-xs space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={`border-transparent ${
                        (opp.intent?.level || "medium") === "high"
                          ? "bg-status-live-bg text-status-live"
                          : "bg-status-neutral-bg text-status-neutral"
                      }`}
                    >
                      <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current" aria-hidden />
                      {(opp.intent?.level || "HIGH").toUpperCase()} INTENT ({opp.fit?.score ?? opp.fit_score ?? 90}% FIT)
                    </Badge>
                    <span className="text-xs text-ink-muted line-clamp-1">
                      {opp.intent?.signal_summary || "Active buying signal detected"}
                    </span>
                  </div>
                  <div className="text-ink-muted line-clamp-1 italic text-xs">
                    "{opp.need?.core_problem || (typeof opp.need === "string" ? opp.need : "Pipeline acceleration")}"
                  </div>
                </div>

                {/* Right: Stage, Value, Action */}
                <div className="flex w-full shrink-0 items-center justify-between gap-3 border-t border-rule pt-4 md:w-auto md:justify-end md:border-t-0 md:pt-0">
                  <div className="text-right flex flex-col items-end">
                    <div className="font-value text-sm text-ink-strong">
                      ${(opp.estimated_deal_value ?? 24000).toLocaleString()}
                    </div>
                    <Badge
                      variant="outline"
                      className={`mt-0.5 border-transparent ${
                        isBooked || hasReply
                          ? "bg-status-live-bg text-status-live"
                          : "bg-status-neutral-bg text-status-neutral"
                      }`}
                    >
                      <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current" aria-hidden />
                      {(opp.stage || "prospecting").replace("_", " ").toUpperCase()}
                    </Badge>
                  </div>

                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="rounded-full"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </motion.div>
            )
          })}

        {filteredOpportunities.length === 0 && (
          <Card>
            <EmptyState
              icon="search"
              title="No matching opportunities"
              description="Try changing your search keywords or switching vertical filters to explore other active pursuits."
            />
          </Card>
        )}
      </div>

      {/* 360-Degree Universal Dossier Modal */}
      <OpportunityDossierModal
        opportunity={activeOpportunity}
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
      />
    </div>
  )
}
