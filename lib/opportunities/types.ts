/**
 * SlideIn Universal Acquisition OS - Opportunity Primitives & Domain Types
 *
 * Universal data structures for prospects, accounts, intent signals,
 * AI research dossiers, conversation threads, and Next Best Actions.
 */

export type OpportunityStage =
  | "captured"
  | "researched"
  | "qualified"
  | "engaged"
  | "high_intent"
  | "booked"
  | "won"
  | "lost"

export type IntentLevel = "high" | "medium" | "low" | "none"

export interface BuyingSignal {
  id: string
  signal: string
  source: string
  confidence: "high" | "medium" | "low"
  timestamp: string
}

export interface ResearchDossier {
  summary: string
  key_initiatives: string[]
  pain_points: string[]
  recommended_angle: string
  evidence: Array<{ title: string; quote: string; url?: string }>
}

export interface ThreadMessage {
  id: string
  direction: "inbound" | "outbound"
  from: string
  to: string
  subject: string
  body: string
  timestamp: string
  deliverability_grade?: string
  intent_detected?: string
}

export interface NextBestAction {
  action: string
  reason: string
  suggested_draft?: {
    subject: string
    body: string
    deliverability_score: number
  }
  cta_type: "send_booking_link" | "send_followup" | "confirm_meeting" | "escalate_to_human" | "qualify_prospect"
}

export interface UniversalOpportunity {
  id: string
  prospect: {
    name: string
    title: string
    email: string
    phone?: string
    linkedin_url?: string
    location?: string
    avatar?: string
  }
  account: {
    name: string
    domain: string
    industry: string
    size: string
    revenue_range?: string
    tech_stack: string[]
    description: string
  }
  fit_score: number
  fit_reasons: string[]
  need: string
  buying_signals: BuyingSignal[]
  intent: {
    level: IntentLevel
    detected_intent: string
    confidence: number
  }
  stage: OpportunityStage
  research_dossier: ResearchDossier
  conversation: {
    thread_id: string
    messages_count: number
    latest_message: {
      from: string
      text: string
      timestamp: string
      direction: "inbound" | "outbound"
    }
    thread: ThreadMessage[]
  }
  next_best_action: NextBestAction
  vertical_attributes?: Record<string, unknown>
  assigned_agent?: string
  created_at: string
  updated_at: string
}
