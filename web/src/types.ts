export interface Policy {
  singleLimit: string;
  dailyLimit: string;
  allowedTokens: string[];
  whitelistAddresses: string[];
  sessionId: string | null;
  timeWindow: TimeWindow;
  rateLimit: RateLimit;
  agentTiers: AgentTier[];
}

export interface TimeWindow {
  enabled: boolean;
  startHour: number;
  endHour: number;
}

export interface RateLimit {
  enabled: boolean;
  maxPerMinute: number;
}

export interface AgentTier {
  agentId: string;
  singleLimit?: string;
  dailyLimit?: string;
}

export interface NotificationRecord {
  timestamp: string;
  type: "payment" | "warning" | "daily_report";
  title: string;
  message: string;
  severity: "info" | "warning" | "error";
}

export interface DailyReport {
  date: string;
  totalPayments: number;
  approvedPayments: number;
  rejectedPayments: number;
  totalSpent: Record<string, number>;
  topAgents: { agentId: string; count: number; amount: number }[];
}

export interface PaymentRequest {
  mode: "direct" | "mpp" | "x402";
  to: string;
  amount: string;
  token: string;
  reason: string;
  agentId: string;
}

export interface PolicyResult {
  allowed: boolean;
  reason: string;
  matchedRule: string | null;
}

export interface AuditRecord {
  timestamp: string;
  agentId: string;
  request: PaymentRequest;
  policyResult: PolicyResult;
  txHash?: string;
  status: "approved" | "rejected" | "failed";
  humanConfirmed: boolean;
}

export interface DashboardData {
  policy: Policy | null;
  auditRecords: AuditRecord[];
  sessionKeyAddress: string | null;
  importedAt: string;
  x402ServerUrl?: string;
  x402Price?: string;
  notifications?: NotificationRecord[];
  dailyReports?: DailyReport[];
}

export type TabKey = "dashboard" | "x402" | "history" | "policy" | "notifications";
