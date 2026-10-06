"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  Filter,
  Sparkles,
  Building2,
  Calendar,
  Clock,
  TrendingUp,
  Mail,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative min-w-[280px] flex-1 lg:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by prospect, company, ICP signal, need..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background/80"
            />
          </div>

          <Select
            value={selectedVertical}
            onValueChange={(val) => setSelectedVertical(val as OpportunityVertical | "all")}
          >
            <SelectTrigger className="w-[180px] bg-background/80">
              <Building2 className="mr-2 size-3.5 text-muted-foreground" />
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
          <Badge variant="outline" className="px-3 py-1 font-mono text-xs border-primary/20 bg-primary/5 text-primary">
            {filteredOpportunities.length} Active Pursuits
          </Badge>
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileSpreadsheet className="size-3.5" />
            Export
          </Button>
          <Button size="sm" className="gap-1.5 shadow-sm">
            <Plus className="size-3.5" />
            New Pursuit
          </Button>
        </div>
      </div>

      {/* Stage Navigation Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-sm scrollbar-none">
        {STAGES.map((s) => {
          const count = stageCounts[s.id] || 0
          const isActive = selectedStage === s.id
          return (
            <button
              key={s.id}
              onClick={() => setSelectedStage(s.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-xs font-medium transition-all whitespace-nowrap ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card/50 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
            >
              <span>{s.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
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
        <AnimatePresence mode="popLayout">
          {filteredOpportunities.map((opp) => {
            const hasReply = opp.thread?.messages?.some((m) => m.direction === "inbound") ?? false
            const isBooked = opp.stage === "meeting_booked"

            return (
              <motion.div
                key={opp.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                onClick={() => handleOpenDossier(opp)}
                className="group relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4.5 rounded-xl border border-border bg-card/70 hover:bg-card hover:border-primary/40 transition-all cursor-pointer shadow-xs hover:shadow-md"
              >
                {/* Left: Contact, Company, Vertical */}
                <div className="flex items-start gap-3.5 min-w-[280px]">
                  <div className="relative size-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary shrink-0">
                    {(opp.prospect?.first_name?.[0] ?? "P").toUpperCase()}
                    {(opp.prospect?.last_name?.[0] ?? "").toUpperCase()}
                    {hasReply && (
                      <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {[opp.prospect?.first_name, opp.prospect?.last_name].filter(Boolean).join(" ") || "Prospect"}
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                        {(opp.vertical || "general").replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span>{opp.prospect?.job_title || "Lead"}</span>
                      <span>•</span>
                      <span className="font-medium text-foreground/80">{opp.account?.company_name || "Company"}</span>
                    </div>
                  </div>
                </div>

                {/* Middle: Core Buying Signal & Intent */}
                <div className="flex-1 max-w-xl text-xs space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] font-mono px-1.5 py-0 ${
                        opp.intent.level === "high"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      }`}
                    >
                      <Zap className="mr-1 size-2.5 inline" />
                      {opp.intent.level.toUpperCase()} INTENT ({opp.fit.score}% FIT)
                    </Badge>
                    <span className="text-[11px] text-muted-foreground line-clamp-1">
                      {opp.intent.signal_summary}
                    </span>
                  </div>
                  <div className="text-muted-foreground line-clamp-1 italic text-[11px]">
                    "{opp.need.core_problem}"
                  </div>
                </div>

                {/* Right: Stage, Value, Action */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border">
                  <div className="text-right flex flex-col items-end">
                    <div className="text-xs font-mono font-semibold text-foreground">
                      ${opp.estimated_deal_value.toLocaleString()}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono mt-0.5 ${
                        isBooked
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/30 font-bold"
                          : hasReply
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {opp.stage.replace("_", " ").toUpperCase()}
                    </Badge>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="size-8 p-0 rounded-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {filteredOpportunities.length === 0 && (
          <div className="p-12 text-center rounded-xl border border-dashed border-border bg-card/30">
            <Sparkles className="size-8 mx-auto text-muted-foreground/50 mb-3" />
            <div className="text-sm font-medium text-foreground">No matching opportunities</div>
            <div className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Try changing your search keywords or switching vertical filters to explore other active pursuits.
            </div>
          </div>
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
