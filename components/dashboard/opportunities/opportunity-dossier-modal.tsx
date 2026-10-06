"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Activity,
  ArrowRight,
  Bot,
  Building,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  Globe,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  X,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { UniversalOpportunity } from "@/lib/opportunities/types"

interface OpportunityDossierModalProps {
  opportunity: UniversalOpportunity | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onActionComplete?: () => void
}

export function OpportunityDossierModal({
  opportunity,
  open,
  onOpenChange,
  onActionComplete,
}: OpportunityDossierModalProps) {
  const [activeTab, setActiveTab] = useState<"dossier" | "conversation" | "research" | "signals">("dossier")
  const [executingAction, setExecutingAction] = useState(false)

  if (!opportunity) return null

  const { prospect, account, intent, next_best_action, conversation, research_dossier } = opportunity

  const handleExecuteAction = async () => {
    setExecutingAction(true)
    try {
      // Simulate action dispatch via SlideIn API
      await new Promise((resolve) => setTimeout(resolve, 800))
      toast.success("Next Best Action Executed!", {
        description: `Dispatched: "${next_best_action.action}" via KumoMTA`,
      })
      onActionComplete?.()
    } catch {
      toast.error("Failed to execute action")
    } finally {
      setExecutingAction(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl">
        {/* Header Ribbon */}
        <div className="relative border-b border-border/60 p-6 bg-muted/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <Avatar className="size-14 border border-border/80 shadow-md">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                  {prospect.name.split(" ").map((n) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">{prospect.name}</h2>
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs font-semibold">
                    {account.industry}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold ${
                      opportunity.stage === "booked"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : opportunity.stage === "high_intent"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                    }`}
                  >
                    {opportunity.stage.toUpperCase().replace("_", " ")}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {prospect.title} at <span className="text-foreground font-medium">{account.name}</span>
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                  <span className="flex items-center gap-1"><Mail className="size-3.5 text-primary/70" /> {prospect.email}</span>
                  {prospect.location && (
                    <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {prospect.location}</span>
                  )}
                  <span className="flex items-center gap-1"><Building className="size-3.5" /> {account.size}</span>
                </div>
              </div>
            </div>

            {/* Fit Score Gauge */}
            <div className="flex items-center gap-3 self-start md:self-auto bg-card/60 border border-border/60 rounded-xl px-4 py-2.5 shadow-xs">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-mono text-base font-bold">
                {opportunity.fit_score}%
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ICP Fit Score</div>
                <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <Flame className="size-3" /> High Buying Fit
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Callout Hero (Next Best Action) */}
        <div className="mx-6 mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                <Zap className="size-4.5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-primary uppercase tracking-wider">AI Recommended Next Best Action</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">{next_best_action.action}</div>
                <div className="text-xs text-muted-foreground mt-1">{next_best_action.reason}</div>
              </div>
            </div>
            <Button
              size="sm"
              className="shrink-0 bg-primary text-primary-foreground font-semibold shadow-md hover:bg-primary/90"
              onClick={handleExecuteAction}
              disabled={executingAction}
            >
              {executingAction ? "Executing..." : "Execute 1-Click Action"}
              <ArrowRight className="size-3.5 ml-1.5" />
            </Button>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="p-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid grid-cols-4 mb-6 bg-muted/40">
              <TabsTrigger value="dossier" className="text-xs font-medium">Why This Prospect</TabsTrigger>
              <TabsTrigger value="conversation" className="text-xs font-medium">Conversation ({conversation.messages_count})</TabsTrigger>
              <TabsTrigger value="research" className="text-xs font-medium">AI Research Brief</TabsTrigger>
              <TabsTrigger value="signals" className="text-xs font-medium">Buying Signals ({opportunity.buying_signals.length})</TabsTrigger>
            </TabsList>

            {/* TAB 1: WHY THIS PROSPECT */}
            <TabsContent value="dossier" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Target className="size-4 text-primary" />
                    ICP Match Rationale
                  </div>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    {opportunity.fit_reasons.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Sparkles className="size-4 text-amber-400" />
                    Observed Need &amp; Problem
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {opportunity.need}
                  </p>
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Detected Intent:</span>
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[11px]">
                      {intent.detected_intent} ({Math.round(intent.confidence * 100)}%)
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Vertical Attributes */}
              {opportunity.vertical_attributes && Object.keys(opportunity.vertical_attributes).length > 0 && (
                <div className="rounded-xl border border-border/60 bg-card/30 p-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Configurable Vertical Attributes ({account.industry})
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(opportunity.vertical_attributes).map(([k, v]) => (
                      <div key={k} className="bg-background/60 border border-border/40 rounded-lg p-2.5">
                        <div className="text-[11px] text-muted-foreground capitalize">{k.replace(/_/g, " ")}</div>
                        <div className="text-sm font-semibold text-foreground mt-0.5">{String(v)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: CONVERSATION THREAD */}
            <TabsContent value="conversation" className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-card/40 divide-y divide-border/40 overflow-hidden">
                {conversation.thread.map((msg) => (
                  <div key={msg.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                          msg.direction === "outbound"
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}>
                          {msg.direction === "outbound" ? "OUTBOUND VIA KUMOMTA" : "INBOUND REPLY"}
                        </span>
                        <span className="text-xs font-medium text-foreground">{msg.from}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{msg.timestamp}</span>
                    </div>
                    <div className="text-xs text-muted-foreground font-semibold">{msg.subject}</div>
                    <div className="text-xs text-foreground/90 whitespace-pre-line bg-background/50 p-3 rounded-lg border border-border/30 font-mono">
                      {msg.body}
                    </div>
                    {msg.deliverability_grade && (
                      <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
                        <ShieldCheck className="size-3.5" /> DKIM Verified • Deliverability Grade: {msg.deliverability_grade}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* TAB 3: AI RESEARCH DOSSIER */}
            <TabsContent value="research" className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Bot className="size-4 text-primary" />
                  AI Synthesis &amp; Strategic Summary
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {research_dossier.summary}
                </p>
                <div className="pt-3 border-t border-border/40">
                  <div className="text-xs font-semibold text-foreground mb-1.5">Recommended Engagement Angle:</div>
                  <div className="text-xs text-primary/90 bg-primary/5 p-2.5 rounded-lg border border-primary/20">
                    {research_dossier.recommended_angle}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 4: BUYING SIGNALS */}
            <TabsContent value="signals" className="space-y-3">
              {opportunity.buying_signals.map((sig) => (
                <div key={sig.id} className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-card/40 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                      <Flame className="size-4" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-foreground">{sig.signal}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Source: {sig.source}</div>
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono shrink-0">{sig.timestamp}</span>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
