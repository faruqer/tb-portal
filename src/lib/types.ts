export type Role = 'admin' | 'agent';

export type GameStatus = 'pending' | 'completed';
export type IdStatus = 'pending' | 'sent';
export type PaymentStatus = 'unpaid' | 'pending_verify' | 'paid';
export type VerifyStatus = 'pending' | 'approved' | 'rejected';
export type SimSortMode = 'ascending' | 'grouped' | 'by-agent' | 'by-agent-group';

export interface SessionPayload {
  role: Role;
  username: string;
  agentId?: string;
  agentName?: string;
}

export interface GameTotals {
  wonProfit: number;
  netProfit: number;
  expectedToReceive: number;
  received: number;
  count: number;
}
