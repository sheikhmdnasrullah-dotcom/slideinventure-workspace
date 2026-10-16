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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header Ribbon */}
        <div className="relative rounded-t-xl border-b border-rule bg-surface-2 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <Avatar className="size-14">
                <AvatarFallback className="bg-flame-wash font-semibold text-flame text-lg">
                  {prospect.name.split(" ").map((n) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display-soft text-lg text-ink-strong">{prospect.name}</h2>
                  <Badge variant="outline">
                    {account.industry}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`border-transparent ${
                      opportunity.stage === "booked"
                        ? "bg-status-live-bg text-status-live"
                        : opportunity.stage === "high_intent"
                        ? "bg-status-warn-bg text-status-warn"
                        : "bg-status-neutral-bg text-status-neutral"
                    }`}
                  >
                    {opportunity.stage.toUpperCase().replace("_", " ")}
                  </Badge>
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {prospect.title} at <span className="font-medium text-ink-strong">{account.name}</span>
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                  <span className="flex items-center gap-1"><Mail className="size-3.5 text-ink-faint" /> {prospect.email}</span>
                  {prospect.location && (
                    <span className="flex items-center gap-1"><MapPin className="size-3.5 text-ink-faint" /> {prospect.location}</span>
                  )}
                  <span className="flex items-center gap-1"><Building className="size-3.5 text-ink-faint" /> {account.size}</span>
                </div>
              </div>
            </div>

            {/* Fit Score Gauge */}
            <div className="flex items-center gap-3 self-start rounded-lg border border-rule bg-surface-2 px-4 py-2.5 md:self-auto">
              <div className="flex size-10 items-center justify-center rounded-[10px] bg-flame-wash font-value text-base text-flame">
                {opportunity.fit_score}%
              </div>
              <div>
                <div className="font-label text-ink-muted">ICP Fit Score</div>
                <div className="flex items-center gap-1 text-xs font-semibold text-status-live">
                  <Flame className="size-3.5" /> High Buying Fit
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Callout Hero (Next Best Action) */}
        <div className="mx-6 mt-6 rounded-lg border border-transparent bg-flame-highlight p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-button-primary text-on-button-primary">
                <Zap className="size-[18px]" />
              </div>
              <div>
                <div className="font-label text-flame">AI Recommended Next Best Action</div>
                <div className="mt-0.5 text-[15px] font-semibold text-ink-strong">{next_best_action.action}</div>
                <div className="mt-1 text-[13px] text-ink-muted">{next_best_action.reason}</div>
              </div>
            </div>
            <Button
              size="sm"
              dot
              loading={executingAction}
              className="shrink-0"
              onClick={handleExecuteAction}
              disabled={executingAction}
            >
              {executingAction ? "Executing..." : "Execute 1-Click Action"}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="p-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="dossier">Why This Prospect</TabsTrigger>
              <TabsTrigger value="conversation">Conversation ({conversation.messages_count})</TabsTrigger>
              <TabsTrigger value="research">AI Research Brief</TabsTrigger>
              <TabsTrigger value="signals">Buying Signals ({opportunity.buying_signals.length})</TabsTrigger>
            </TabsList>

            {/* TAB 1: WHY THIS PROSPECT */}
            <TabsContent value="dossier" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-md border border-rule bg-surface-2 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-[15px] font-semibold text-ink-strong">
                    <Target className="size-[18px] text-ink-strong" />
                    ICP Match Rationale
                  </div>
                  <ul className="space-y-2 text-[13px] text-ink-muted">
                    {opportunity.fit_reasons.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-status-live" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-md border border-rule bg-surface-2 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-[15px] font-semibold text-ink-strong">
                    <Sparkles className="size-[18px] text-status-warn" />
                    Observed Need &amp; Problem
                  </div>
                  <p className="text-[13px] leading-relaxed text-ink-muted">
                    {opportunity.need}
                  </p>
                  <div className="flex items-center justify-between border-t border-rule pt-3 text-xs">
                    <span className="text-ink-muted">Detected Intent:</span>
                    <Badge variant="outline" className="border-transparent bg-status-warn-bg text-status-warn">
                      {intent.detected_intent} ({Math.round(intent.confidence * 100)}%)
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Vertical Attributes */}
              {opportunity.vertical_attributes && Object.keys(opportunity.vertical_attributes).length > 0 && (
                <div className="rounded-md border border-rule bg-surface-2 p-4">
                  <div className="font-label mb-3 text-ink-muted">
                    Configurable Vertical Attributes ({account.industry})
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(opportunity.vertical_attributes).map(([k, v]) => (
                      <div key={k} className="rounded-sm border border-rule bg-surface p-2.5">
                        <div className="text-xs text-ink-muted capitalize">{k.replace(/_/g, " ")}</div>
                        <div className="mt-0.5 text-sm font-semibold text-ink-strong">{String(v)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: CONVERSATION THREAD */}
            <TabsContent value="conversation" className="space-y-4">
              <div className="rounded-md border border-rule bg-surface-2 divide-y divide-rule-soft overflow-hidden">
                {conversation.thread.map((msg) => (
                  <div key={msg.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex h-[26px] items-center rounded-pill px-2.5 text-xs font-medium ${
                          msg.direction === "outbound"
                            ? "bg-flame-wash text-flame"
                            : "bg-status-live-bg text-status-live"
                        }`}>
                          {msg.direction === "outbound" ? "OUTBOUND VIA KUMOMTA" : "INBOUND REPLY"}
                        </span>
                        <span className="text-[13px] font-medium text-ink-strong">{msg.from}</span>
                      </div>
                      <span className="text-xs tabular-nums text-ink-muted">{msg.timestamp}</span>
                    </div>
                    <div className="text-xs font-semibold text-ink-muted">{msg.subject}</div>
                    <div className="rounded-md border border-rule bg-surface p-3 text-[13px] whitespace-pre-line text-ink-strong">
                      {msg.body}
                    </div>
                    {msg.deliverability_grade && (
                      <div className="flex items-center gap-2 text-xs text-status-live">
                        <ShieldCheck className="size-4" /> DKIM Verified • Deliverability Grade: {msg.deliverability_grade}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* TAB 3: AI RESEARCH DOSSIER */}
            <TabsContent value="research" className="space-y-4">
              <div className="rounded-md border border-rule bg-surface-2 p-4 space-y-3">
                <div className="flex items-center gap-2 text-[15px] font-semibold text-ink-strong">
                  <Bot className="size-[18px] text-ink-strong" />
                  AI Synthesis &amp; Strategic Summary
                </div>
                <p className="text-[13px] leading-relaxed text-ink-muted">
                  {research_dossier.summary}
                </p>
                <div className="pt-3 border-t border-border/40">
                  <div className="mb-1.5 text-xs font-semibold text-ink-strong">Recommended Engagement Angle:</div>
                  <div className="rounded-md border border-transparent bg-flame-wash p-2.5 text-[13px] text-ink-strong">
                    {research_dossier.recommended_angle}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 4: BUYING SIGNALS */}
            <TabsContent value="signals" className="space-y-3">
              {opportunity.buying_signals.map((sig) => (
                <div key={sig.id} className="flex items-start justify-between gap-4 rounded-md border border-rule bg-surface-2 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-status-warn-bg text-status-warn">
                      <Flame className="size-4" />
                    </div>
                    <div>
                      <div className="text-[13px] font-medium text-ink-strong">{sig.signal}</div>
                      <div className="mt-0.5 text-xs text-ink-muted">Source: {sig.source}</div>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-ink-muted">{sig.timestamp}</span>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
