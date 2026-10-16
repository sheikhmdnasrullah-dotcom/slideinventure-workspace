"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Activity,
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Play,
  Plus,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

import { SiteHeader } from "@/components/dashboard/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { OpportunityDossierModal } from "@/components/dashboard/opportunities/opportunity-dossier-modal"
import { MOCK_OPPORTUNITIES } from "@/lib/opportunities/mock-data"
import type { UniversalOpportunity } from "@/lib/opportunities/types"

export function AcquisitionCommandCenter() {
  const [selectedOpportunity, setSelectedOpportunity] = useState<UniversalOpportunity | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [verticalFilter, setVerticalFilter] = useState<string>("all")

  const handleOpenDossier = (opp: UniversalOpportunity) => {
    setSelectedOpportunity(opp)
    setModalOpen(true)
  }

  const filteredOpportunities = verticalFilter === "all"
    ? MOCK_OPPORTUNITIES
    : MOCK_OPPORTUNITIES.filter((o) => o.account.industry.toLowerCase().includes(verticalFilter.toLowerCase()))

  return (
    <>
      <SiteHeader
        crumbs={[{ label: "Command Center" }]}
        subtitle="Universal Acquisition Operating System"
      />

      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 px-5 py-5 md:px-10 md:py-10">
        {/* Workspace Top Banner & Vertical Switcher */}
        <div className="flex flex-col justify-between gap-4 border-b border-rule pb-8 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-[28px] leading-[34px] text-ink-strong">Acquisition Command Center</h1>
              <span className="flex h-[26px] items-center gap-1.5 rounded-full bg-status-live-bg px-2.5 text-xs font-medium text-status-live">
                <span className="size-1.5 rounded-full bg-status-live animate-pulse" />
                Autonomous Engine Active
              </span>
            </div>
            <p className="mt-1 max-w-[640px] text-sm text-ink-muted">
              Your AI-powered acquisition department. Researching prospects, generating context-aware messaging, and booking meetings.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={verticalFilter === "all" ? "default" : "outline"}
              size="xs"
              onClick={() => setVerticalFilter("all")}
              className="text-xs"
            >
              All Verticals
            </Button>
            <Button
              variant={verticalFilter === "saas" ? "default" : "outline"}
              size="xs"
              onClick={() => setVerticalFilter("saas")}
              className="text-xs"
            >
              B2B SaaS
            </Button>
            <Button
              variant={verticalFilter === "agency" ? "default" : "outline"}
              size="xs"
              onClick={() => setVerticalFilter("agency")}
              className="text-xs"
            >
              Agency / DTC
            </Button>
            <Button
              variant={verticalFilter === "lending" ? "default" : "outline"}
              size="xs"
              onClick={() => setVerticalFilter("lending")}
              className="text-xs"
            >
              Lending &amp; Real Estate
            </Button>
          </div>
        </div>

        {/* 1. TODAY'S PULSE METRICS BAR */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardDescription className="font-label text-ink-muted">New Opportunities</CardDescription>
              <CardTitle className="font-value text-2xl text-ink-strong">14</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-status-live font-medium">+4 qualified today</CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardDescription className="font-label text-ink-muted">Active Threads</CardDescription>
              <CardTitle className="font-value text-2xl text-ink-strong">8</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-primary font-medium">Two-way conversational AI</CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardDescription className="font-label text-ink-muted">High-Intent Leads</CardDescription>
              <CardTitle className="font-value text-2xl text-status-warn">3</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-status-warn/90 font-medium">Ready to book</CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardDescription className="font-label text-ink-muted">Meetings Scheduled</CardDescription>
              <CardTitle className="font-value text-2xl text-status-live">5</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-status-live font-medium">2 calls today</CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardDescription className="font-label text-ink-muted">Deliverability Score</CardDescription>
              <CardTitle className="font-value text-2xl text-ink-strong">100 / 100</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-status-live font-medium">100% Primary Inbox</CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardDescription className="font-label text-ink-muted">AI Workforce</CardDescription>
              <CardTitle className="font-value text-2xl text-flame">8 Agents</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-muted-foreground font-medium">124 jobs completed</CardContent>
          </Card>
        </div>

        {/* 2. MAIN GRID: TOP OPPORTUNITIES & NEEDS ATTENTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: TOP OPPORTUNITIES MATRIX */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Target className="size-4.5 text-primary" />
                  Top Priority Opportunities
                </h2>
                <p className="text-xs text-muted-foreground">
                  High-intent prospects with verified buying signals and AI-recommended next actions.
                </p>
              </div>
              <Button size="xs" variant="outline" className="text-xs" onClick={() => window.location.href = "/leads"}>
                View All Opportunities &rarr;
              </Button>
            </div>

            <div className="space-y-3">
              {filteredOpportunities.map((opp) => (
                <motion.div
                  key={opp.id}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => handleOpenDossier(opp)}
                  className="group relative flex cursor-pointer flex-col justify-between gap-4 rounded-lg border border-rule bg-surface p-6 shadow-raised transition-shadow duration-[150ms] hover:shadow-float sm:flex-row sm:items-center"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-transparent bg-flame-wash text-sm font-semibold text-flame">
                      {opp.fit_score}%
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                          {opp.prospect.name}
                        </span>
                        <span className="text-xs text-muted-foreground">• {opp.prospect.title} at <strong className="text-foreground">{opp.account.name}</strong></span>
                        <Badge
                          variant="outline"
                          className={`text-xs font-semibold ${
                            opp.stage === "booked"
                              ? "bg-status-live-bg text-status-live border-status-live-border"
                              : opp.stage === "high_intent"
                              ? "bg-amber-500/10 text-status-warn border-amber-500/30"
                              : "border-transparent bg-status-info-bg text-status-info"
                          }`}
                        >
                          {opp.stage.toUpperCase().replace("_", " ")}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {opp.need}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 text-primary">
                          <Zap className="size-3" /> Next: {opp.next_best_action.action}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/40">
                    <span className="text-xs tabular-nums text-ink-muted">{opp.conversation.latest_message.timestamp}</span>
                    <Button size="xs" variant="ghost" className="text-xs text-primary group-hover:translate-x-0.5 transition-transform">
                      Inspect Dossier &rarr;
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* LIVE AI ACTIVITY STREAM */}
            <div className="mt-6 rounded-lg border border-rule bg-surface p-6 shadow-raised space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Activity className="size-4 text-status-live" />
                  Live AI Workforce Execution Stream
                </h3>
                <span className="text-xs text-ink-muted">Real-time KumoMTA &amp; LLM Mesh</span>
              </div>

              <div className="space-y-3 font-code text-xs">
                <div className="flex items-start gap-3 rounded-md border border-rule bg-surface-2 p-2.5">
                  <span className="shrink-0 font-bold text-status-live">[10:09 AM]</span>
                  <div className="flex-1">
                    <span className="font-semibold text-ink-strong">Booking Agent:</span> Dispatched live Cal.com confirmation link to <span className="text-foreground font-medium">borrower.austin.miller@gmail.com</span> (RFC Message-ID verified).
                  </div>
                  <Badge variant="outline" className="text-xs bg-status-live-bg text-status-live border-status-live-border">Success</Badge>
                </div>

                <div className="flex items-start gap-3 rounded-md border border-rule bg-surface-2 p-2.5">
                  <span className="text-status-live font-bold shrink-0">[10:08 AM]</span>
                  <div className="flex-1">
                    <span className="text-primary font-semibold">Conversation Agent:</span> Ingested reply from Austin Miller; intent classified as <span className="text-status-warn font-medium">READY_TO_BOOK</span> (Confidence: 96%).
                  </div>
                  <Badge variant="outline" className="border-transparent bg-status-info-bg text-status-info">Intent 0.96</Badge>
                </div>

                <div className="flex items-start gap-3 rounded-md border border-rule bg-surface-2 p-2.5">
                  <span className="text-muted-foreground font-bold shrink-0">[09:45 AM]</span>
                  <div className="flex-1">
                    <span className="text-primary font-semibold">Deliverability Agent:</span> Pre-send safety gate passed for Marcus Vance draft (<span className="text-status-live font-medium">Grade A, 100/100, 0 spam triggers</span>).
                  </div>
                  <Badge variant="outline" className="text-xs bg-status-live-bg text-status-live border-status-live-border">Grade A</Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: NEEDS ATTENTION & ACQUISITION HEALTH */}
          <div className="space-y-6">
            {/* Needs Attention Widget */}
            <div className="rounded-lg border border-transparent bg-status-warn-bg p-6 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Flame className="size-4 text-status-warn" />
                  Requires Attention (3)
                </h3>
                <Badge variant="outline" className="bg-amber-500/10 text-status-warn border-amber-500/20 text-xs">Action Required</Badge>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-start justify-between gap-3 rounded-lg border border-rule bg-surface p-3">
                  <div>
                    <div className="font-semibold text-foreground">Marcus Vance requested 15-min call</div>
                    <div className="text-muted-foreground text-xs mt-0.5">High-intent SaaS buyer waiting for booking link.</div>
                  </div>
                  <Button size="xs" variant="default" className="shrink-0 text-xs" onClick={() => handleOpenDossier(MOCK_OPPORTUNITIES[0])}>
                    Approve
                  </Button>
                </div>

                <div className="flex items-start justify-between gap-3 rounded-lg border border-rule bg-surface p-3">
                  <div>
                    <div className="font-semibold text-foreground">Elena Rostova evaluated pricing</div>
                    <div className="text-muted-foreground text-xs mt-0.5">Agency partner asked about 10-workspace provisioning.</div>
                  </div>
                  <Button size="xs" variant="outline" className="shrink-0 text-xs" onClick={() => handleOpenDossier(MOCK_OPPORTUNITIES[1])}>
                    Review
                  </Button>
                </div>

                <div className="flex items-start justify-between gap-3 rounded-lg border border-rule bg-surface p-3">
                  <div>
                    <div className="font-semibold text-foreground">Cloudflare DNS Verification</div>
                    <div className="text-muted-foreground text-xs mt-0.5">DMARC policy strictness verified across all 3 domains.</div>
                  </div>
                  <Badge variant="outline" className="text-xs text-status-live bg-status-live-bg border-status-live-border shrink-0">Pass</Badge>
                </div>
              </div>
            </div>

            {/* Universal Acquisition Health Index */}
            <div className="rounded-lg border border-rule bg-surface p-6 shadow-raised space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Acquisition Health Index</h3>
                  <p className="text-xs text-muted-foreground">Universal 10-point system audit</p>
                </div>
                <div className="font-value text-2xl text-status-live">94 <span className="text-xs text-muted-foreground font-normal">/ 100</span></div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Discovery &amp; Research Health</span>
                    <span className="text-foreground font-semibold">96%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-status-live rounded-full" style={{ width: "96%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Deliverability &amp; DKIM Placement</span>
                    <span className="text-foreground font-semibold">100%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-status-live rounded-full" style={{ width: "100%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Conversational Intent Velocity</span>
                    <span className="text-foreground font-semibold">91%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-status-live rounded-full" style={{ width: "91%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Automations &amp; Webhook Health</span>
                    <span className="text-foreground font-semibold">98%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-status-live rounded-full" style={{ width: "98%" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Upcoming Meetings Intelligence */}
            <div className="rounded-xl border border-border/60 bg-card/50 p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Calendar className="size-4 text-primary" />
                  Upcoming Meetings
                </h3>
                <span className="text-xs text-muted-foreground">Cal.com Sync</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="rounded-lg border border-rule bg-surface p-3">
                  <div className="flex items-center justify-between font-semibold text-foreground">
                    <span>Austin Miller</span>
                    <span className="text-xs font-medium tabular-nums text-flame">Thursday 11:00 AM</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pre-Call Dossier: $620k purchase scenario, 760 credit score, pre-approval comparison.
                  </p>
                </div>

                <div className="rounded-lg border border-rule bg-surface p-3">
                  <div className="flex items-center justify-between font-semibold text-foreground">
                    <span>Marcus Vance</span>
                    <span className="text-xs font-medium tabular-nums text-flame">Tomorrow 2:30 PM</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pre-Call Dossier: DataBridge Enterprise MTA migration &amp; KumoMTA shaping.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 360-Degree Opportunity Dossier Modal */}
      <OpportunityDossierModal
        opportunity={selectedOpportunity}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onActionComplete={() => {
          toast.success("Pipeline updated successfully!")
        }}
      />
    </>
  )
}
