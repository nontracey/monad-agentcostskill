import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { Policy, PaymentRequest, PolicyResult, AuditRecord } from "./types.js";
import { auditRead } from "./audit.js";

const DEFAULT_POLICY: Policy = {
  singleLimit: "0.5",
  dailyLimit: "1.0",
  allowedTokens: ["MON"],
  whitelistAddresses: [],
  sessionId: null,
};

export function evaluatePolicy(
  request: PaymentRequest,
  policy: Policy,
  spentToday: number,
): PolicyResult {
  // 1. Check token allowed
  if (!policy.allowedTokens.includes(request.token.toUpperCase())) {
    return {
      allowed: false,
      reason: `Token ${request.token} not allowed. Allowed: ${policy.allowedTokens.join(", ")}`,
      matchedRule: "token_not_allowed",
    };
  }

  // 2. Check amount > 0
  const amount = Number(request.amount);
  if (isNaN(amount) || amount <= 0) {
    return {
      allowed: false,
      reason: "Invalid amount. Must be greater than 0.",
      matchedRule: "invalid_amount",
    };
  }

  // 3. Check single limit
  if (amount > Number(policy.singleLimit)) {
    return {
      allowed: false,
      reason: `Amount ${amount} exceeds single limit ${policy.singleLimit}`,
      matchedRule: "exceeded_single_limit",
    };
  }

  // 4. Check daily limit
  if (spentToday + amount > Number(policy.dailyLimit)) {
    return {
      allowed: false,
      reason: `Would exceed daily limit. Already spent ${spentToday} / ${policy.dailyLimit}, requested ${amount}`,
      matchedRule: "exceeded_daily_limit",
    };
  }

  // 5. Check whitelist (only if non-empty)
  if (policy.whitelistAddresses.length > 0) {
    const normalizedTo = request.to.toLowerCase();
    const whitelisted = policy.whitelistAddresses.some(
      (addr) => addr.toLowerCase() === normalizedTo,
    );
    if (!whitelisted) {
      return {
        allowed: false,
        reason: `Address ${request.to} not in whitelist`,
        matchedRule: "address_not_whitelisted",
      };
    }
  }

  return {
    allowed: true,
    reason: "All checks passed",
    matchedRule: null,
  };
}

export function loadPolicy(configPath: string): Policy {
  try {
    if (!existsSync(configPath)) {
      savePolicy(DEFAULT_POLICY, configPath);
      return { ...DEFAULT_POLICY };
    }
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Policy>;
    // Fill missing fields with defaults
    return {
      singleLimit: parsed.singleLimit ?? DEFAULT_POLICY.singleLimit,
      dailyLimit: parsed.dailyLimit ?? DEFAULT_POLICY.dailyLimit,
      allowedTokens: parsed.allowedTokens ?? DEFAULT_POLICY.allowedTokens,
      whitelistAddresses: parsed.whitelistAddresses ?? DEFAULT_POLICY.whitelistAddresses,
      sessionId: parsed.sessionId ?? DEFAULT_POLICY.sessionId,
    };
  } catch {
    return { ...DEFAULT_POLICY };
  }
}

export function savePolicy(policy: Policy, configPath: string): void {
  writeFileSync(configPath, JSON.stringify(policy, null, 2) + "\n", "utf-8");
}

export function calcSpentToday(auditLogPath: string, token: string = "MON"): number {
  if (!existsSync(auditLogPath)) return 0;

  const records = auditRead(auditLogPath);
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  let total = 0;
  for (const record of records) {
    const recordDate = record.timestamp.slice(0, 10);
    if (
      recordDate === today &&
      record.status === "approved" &&
      record.request.token.toUpperCase() === token.toUpperCase()
    ) {
      total += Number(record.request.amount);
    }
  }
  return total;
}
