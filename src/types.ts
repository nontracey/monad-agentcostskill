export interface AgentTier {
  agentId: string;
  singleLimit?: string;
  dailyLimit?: string;
}

export interface TimeWindow {
  enabled: boolean;
  startHour: number;  // 0-23
  endHour: number;    // 0-23
}

export interface RateLimit {
  enabled: boolean;
  maxPerMinute: number;
}

export interface Policy {
  singleLimit: string;
  dailyLimit: string;
  allowedTokens: string[];
  whitelistAddresses: string[];
  sessionId: string | null;
  // Phase 3 新增
  timeWindow: TimeWindow;
  rateLimit: RateLimit;
  agentTiers: AgentTier[];
}

export interface NotificationRecord {
  timestamp: string;
  type: "payment" | "warning" | "daily_report";
  title: string;
  message: string;
  severity: "info" | "warning" | "error";
}

export interface DailyReport {
  date: string;           // YYYY-MM-DD
  totalPayments: number;
  approvedPayments: number;
  rejectedPayments: number;
  totalSpent: Record<string, number>;  // token -> amount
  topAgents: { agentId: string; count: number; amount: number }[];
}

export interface PaymentRequest {
  mode: "direct" | "mpp" | "x402";
  to: string;             // 收款地址 (direct) 或 API URL (x402/mpp)
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

export interface SessionKey {
  privateKey: string;
  address: string;
}

export interface PaymentResult {
  status: "approved" | "rejected" | "failed";
  txHash?: string;
  explorerUrl?: string;
  policyResult: PolicyResult;
  error?: string;
  x402Status?: number;
  x402Note?: string;
}

export interface OrchestratorCtx {
  policyPath: string;
  sessionKeyPath: string;
  auditLogPath: string;
  rpcUrl: string;
  chainId: number;
  mainAddress: string;
}

export function buildExplorerUrl(txHash: string, chainId: number = 10143): string {
  const prefix = chainId === 10143 ? "testnet." : "";
  return `https://${prefix}monadexplorer.com/tx/${txHash}`;
}

export function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
