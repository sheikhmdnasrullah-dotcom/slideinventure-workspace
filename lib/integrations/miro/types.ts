export type Provider = 'notion' | 'miro'

export type ConnectedAccountStatus = 'active' | 'needs_reauth' | 'revoked'

export type ActivitySource = 'webhook' | 'reconciliation_poll' | 'in_app_action'

export type ActivityAction =
  | 'board.updated'
  | 'board.created'
  | 'sticky_note.created'
  | 'sticky_note.updated'
  | 'sticky_note.deleted'
  | 'text.created'
  | 'text.updated'
  | 'text.deleted'
  | 'image.created'
  | 'image.updated'
  | 'image.deleted'
  | 'shape.created'
  | 'shape.updated'
  | 'shape.deleted'
  | 'frame.created'
  | 'frame.updated'
  | 'frame.deleted'
  | 'mind_map.created'
  | 'mind_map.updated'
  | 'mind_map.deleted'
  | 'reconciled_edit'

export interface ConnectedAccount {
  id: string
  provider: Provider
  ownerUserId: string
  externalAccountId: string
  externalWorkspaceOrTeamId: string
  externalWorkspaceOrTeamName: string
  accessToken: string
  refreshToken?: string
  scopes: string[]
  connectedAt: string
  status: ConnectedAccountStatus
}

export interface ActivityLogEntry {
  id: string
  provider: Provider
  connectedAccountId: string
  workspaceOrBoard: { id: string; name: string }
  target: { id: string; name: string; url: string }
  action: ActivityAction
  timestamp: string
  actor: { id: string; name?: string; isConnectedUser: boolean | 'unknown' }
  source: ActivitySource
  summary: string
}

export type ActivityFilter = 'notion' | 'miro' | 'all'

export interface ActivityRow {
  id: string
  provider: Provider
  targetName: string
  targetUrl: string
  action: string
  timestamp: string
  actorName: string | 'unknown'
  summary: string
}