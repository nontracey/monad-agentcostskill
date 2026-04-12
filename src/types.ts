export interface Policy {
  singleLimit: string;
  dailyLimit: string;
  allowedTokens: string[];
  whitelistAddresses: string[];
  sessionId: string | null;
}

export interface PaymentRequest {
  mode: "direct" | "mpp";
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
