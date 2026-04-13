export interface Policy {
  singleLimit: string;
  dailyLimit: string;
  allowedTokens: string[];
  whitelistAddresses: string[];
  sessionId: string | null;
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
}

export interface X402Config {
  port: number;
  price: string;
  priceDisplay: string;
  usdcContract: string;
  payTo: string;
  chainId: number;
  facilitatorUrl: string;
}

export type TabKey = "dashboard" | "x402" | "history" | "policy";
