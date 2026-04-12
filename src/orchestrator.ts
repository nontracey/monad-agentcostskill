import type {
  PaymentRequest,
  PolicyResult,
  AuditRecord,
  PaymentResult,
  OrchestratorCtx,
} from "./types.js";
import { buildExplorerUrl } from "./types.js";
import { loadPolicy, evaluatePolicy, calcSpentToday } from "./policy.js";
import { loadSessionKey } from "./session-key.js";
import { auditAppend } from "./audit.js";
import { sendDirect } from "./direct-transfer.js";
import { payWithMpp } from "./mpp-client.js";
import { fetchWithX402 } from "./x402-client.js";

export async function orchestratePayment(
  request: PaymentRequest,
  ctx: OrchestratorCtx,
): Promise<PaymentResult> {
  // 1. Load policy
  const policy = loadPolicy(ctx.policyPath);

  // 2. Load session key
  const sessionKey = loadSessionKey(ctx.sessionKeyPath);
  if (!sessionKey) {
    const policyResult: PolicyResult = {
      allowed: false,
      reason: "No session key found. Run `init` first.",
      matchedRule: "no_session_key",
    };
    const record: AuditRecord = {
      timestamp: new Date().toISOString(),
      agentId: request.agentId,
      request,
      policyResult,
      status: "rejected",
      humanConfirmed: false,
    };
    auditAppend(record, ctx.auditLogPath);
    return { status: "rejected", policyResult };
  }

  // 3. Calculate spent today
  const spentToday = calcSpentToday(ctx.auditLogPath, request.token);

  // 4. Evaluate policy
  const policyResult = evaluatePolicy(request, policy, spentToday);

  if (!policyResult.allowed) {
    const record: AuditRecord = {
      timestamp: new Date().toISOString(),
      agentId: request.agentId,
      request,
      policyResult,
      status: "rejected",
      humanConfirmed: false,
    };
    auditAppend(record, ctx.auditLogPath);
    return { status: "rejected", policyResult };
  }

  // 5. Execute payment
  try {
    let txHash: string | undefined;
    let status: "success" | "reverted" = "success";
    let x402Status: number | undefined;
    let x402Note: string | undefined;

    if (request.mode === "direct") {
      const result = await sendDirect(
        sessionKey,
        request.to,
        request.amount,
        request.token,
        ctx.rpcUrl,
        ctx.chainId,
        process.env.USDC_CONTRACT,
      );
      txHash = result.txHash;
      status = result.status;
    } else if (request.mode === "mpp") {
      const mppResult = await payWithMpp(
        {
          sessionKey,
          rpcUrl: ctx.rpcUrl,
          chainId: ctx.chainId,
          usdcContract: process.env.USDC_CONTRACT,
        },
        request.to,
        request.amount,
        request.reason,
      );

      if (mppResult.status === "fallback_to_direct") {
        // Fallback to direct transfer
        const result = await sendDirect(
          sessionKey,
          request.to,
          request.amount,
          request.token,
          ctx.rpcUrl,
          ctx.chainId,
          process.env.USDC_CONTRACT,
        );
        txHash = result.txHash;
        status = result.status;
      } else {
        txHash = mppResult.txHash;
        status = "success";
      }
    } else if (request.mode === "x402") {
      // x402: fetch the URL, auto-pay on 402
      const response = await fetchWithX402(
        {
          sessionKey,
          rpcUrl: ctx.rpcUrl,
          chainId: ctx.chainId,
        },
        request.to, // in x402 mode, `to` is the API URL
      );
      x402Status = response.status;
      if (!response.ok) {
        throw new Error(
          `x402 request failed: HTTP ${response.status} ${response.statusText}`,
        );
      }
      x402Note = `Paid via x402 to access ${request.to}`;
      // x402 doesn't produce a txHash for the agent — payment is settled by the server
    } else {
      throw new Error(`Unknown payment mode: ${request.mode}`);
    }

    const approvedResult: PolicyResult = {
      allowed: true,
      reason: "All checks passed",
      matchedRule: null,
    };

    const record: AuditRecord = {
      timestamp: new Date().toISOString(),
      agentId: request.agentId,
      request,
      policyResult: approvedResult,
      txHash: txHash,
      status: status === "success" && !x402Note ? "approved" : "approved",
      humanConfirmed: false,
    };
    auditAppend(record, ctx.auditLogPath);

    return {
      status: "approved",
      txHash: txHash,
      explorerUrl: txHash ? buildExplorerUrl(txHash, ctx.chainId) : undefined,
      policyResult: approvedResult,
      x402Status,
      x402Note,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    const failedResult: PolicyResult = {
      allowed: true,
      reason: "Policy passed but execution failed",
      matchedRule: null,
    };
    const record: AuditRecord = {
      timestamp: new Date().toISOString(),
      agentId: request.agentId,
      request,
      policyResult: failedResult,
      status: "failed",
      humanConfirmed: false,
    };
    auditAppend(record, ctx.auditLogPath);

    return {
      status: "failed",
      policyResult: failedResult,
      error: errorMsg,
    };
  }
}
