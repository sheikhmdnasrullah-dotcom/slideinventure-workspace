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

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {/* Workspace Top Banner & Vertical Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Acquisition Command Center</h1>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Autonomous Engine Active
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
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
          <Card className="border-border/60 bg-card/50 shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">New Opportunities</CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground">14</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-emerald-400 font-medium">+4 qualified today</CardContent>
          </Card>

          <Card className="border-border/60 bg-card/50 shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Active Threads</CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground">8</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-primary font-medium">Two-way conversational AI</CardContent>
          </Card>

          <Card className="border-border/60 bg-card/50 shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">High-Intent Leads</CardDescription>
              <CardTitle className="text-2xl font-bold text-amber-400">3</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-amber-400/90 font-medium">Ready to book</CardContent>
          </Card>

          <Card className="border-border/60 bg-card/50 shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Meetings Scheduled</CardDescription>
              <CardTitle className="text-2xl font-bold text-emerald-400">5</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-emerald-400 font-medium">2 calls today</CardContent>
          </Card>

          <Card className="border-border/60 bg-card/50 shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Deliverability Score</CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground">100 / 100</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-emerald-400 font-medium">100% Primary Inbox</CardContent>
          </Card>

          <Card className="border-border/60 bg-card/50 shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">AI Workforce</CardDescription>
              <CardTitle className="text-2xl font-bold text-primary">8 Agents</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground font-medium">124 jobs completed</CardContent>
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
                  className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/60 p-4 transition-all hover:border-primary/40 hover:bg-card/90 shadow-xs cursor-pointer"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm border border-primary/20 shadow-xs">
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
                          className={`text-[10px] font-semibold ${
                            opp.stage === "booked"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : opp.stage === "high_intent"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          }`}
                        >
                          {opp.stage.toUpperCase().replace("_", " ")}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {opp.need}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 text-primary">
                          <Zap className="size-3" /> Next: {opp.next_best_action.action}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/40">
                    <span className="text-[11px] text-muted-foreground font-mono">{opp.conversation.latest_message.timestamp}</span>
                    <Button size="xs" variant="ghost" className="text-xs text-primary group-hover:translate-x-0.5 transition-transform">
                      Inspect Dossier &rarr;
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* LIVE AI ACTIVITY STREAM */}
            <div className="rounded-xl border border-border/60 bg-card/40 p-5 mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Activity className="size-4 text-emerald-400" />
                  Live AI Workforce Execution Stream
                </h3>
                <span className="text-[11px] text-muted-foreground font-mono">Real-time KumoMTA &amp; LLM Mesh</span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-start gap-3 p-2.5 rounded-lg bg-background/50 border border-border/40">
                  <span className="text-emerald-400 font-bold shrink-0">[10:09 AM]</span>
                  <div className="flex-1">
                    <span className="text-primary font-semibold">Booking Agent:</span> Dispatched live Cal.com confirmation link to <span className="text-foreground font-medium">borrower.austin.miller@gmail.com</span> (RFC Message-ID verified).
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Success</Badge>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-lg bg-background/50 border border-border/40">
                  <span className="text-emerald-400 font-bold shrink-0">[10:08 AM]</span>
                  <div className="flex-1">
                    <span className="text-primary font-semibold">Conversation Agent:</span> Ingested reply from Austin Miller; intent classified as <span className="text-amber-400 font-medium">READY_TO_BOOK</span> (Confidence: 96%).
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">Intent 0.96</Badge>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-lg bg-background/50 border border-border/40">
                  <span className="text-muted-foreground font-bold shrink-0">[09:45 AM]</span>
                  <div className="flex-1">
                    <span className="text-primary font-semibold">Deliverability Agent:</span> Pre-send safety gate passed for Marcus Vance draft (<span className="text-emerald-400 font-medium">Grade A, 100/100, 0 spam triggers</span>).
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Grade A</Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: NEEDS ATTENTION & ACQUISITION HEALTH */}
          <div className="space-y-6">
            {/* Needs Attention Widget */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Flame className="size-4 text-amber-400" />
                  Requires Attention (3)
                </h3>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">Action Required</Badge>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-lg bg-card/80 border border-border/60 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-foreground">Marcus Vance requested 15-min call</div>
                    <div className="text-muted-foreground text-[11px] mt-0.5">High-intent SaaS buyer waiting for booking link.</div>
                  </div>
                  <Button size="xs" variant="default" className="shrink-0 text-xs" onClick={() => handleOpenDossier(MOCK_OPPORTUNITIES[0])}>
                    Approve
                  </Button>
                </div>

                <div className="p-3 rounded-lg bg-card/80 border border-border/60 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-foreground">Elena Rostova evaluated pricing</div>
                    <div className="text-muted-foreground text-[11px] mt-0.5">Agency partner asked about 10-workspace provisioning.</div>
                  </div>
                  <Button size="xs" variant="outline" className="shrink-0 text-xs" onClick={() => handleOpenDossier(MOCK_OPPORTUNITIES[1])}>
                    Review
                  </Button>
                </div>

                <div className="p-3 rounded-lg bg-card/80 border border-border/60 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-foreground">Cloudflare DNS Verification</div>
                    <div className="text-muted-foreground text-[11px] mt-0.5">DMARC policy strictness verified across all 3 domains.</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shrink-0">Pass</Badge>
                </div>
              </div>
            </div>

            {/* Universal Acquisition Health Index */}
            <div className="rounded-xl border border-border/60 bg-card/50 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Acquisition Health Index</h3>
                  <p className="text-[11px] text-muted-foreground">Universal 10-point system audit</p>
                </div>
                <div className="text-2xl font-bold text-emerald-400">94 <span className="text-xs text-muted-foreground font-normal">/ 100</span></div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground">Discovery &amp; Research Health</span>
                    <span className="text-foreground font-semibold">96%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: "96%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground">Deliverability &amp; DKIM Placement</span>
                    <span className="text-foreground font-semibold">100%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: "100%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground">Conversational Intent Velocity</span>
                    <span className="text-foreground font-semibold">91%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: "91%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground">Automations &amp; Webhook Health</span>
                    <span className="text-foreground font-semibold">98%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: "98%" }} />
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
                <span className="text-[11px] text-muted-foreground">Cal.com Sync</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-lg bg-background/60 border border-border/40">
                  <div className="flex items-center justify-between font-semibold text-foreground">
                    <span>Austin Miller</span>
                    <span className="text-primary font-mono text-[11px]">Thursday 11:00 AM</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Pre-Call Dossier: $620k purchase scenario, 760 credit score, pre-approval comparison.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-background/60 border border-border/40">
                  <div className="flex items-center justify-between font-semibold text-foreground">
                    <span>Marcus Vance</span>
                    <span className="text-primary font-mono text-[11px]">Tomorrow 2:30 PM</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
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
