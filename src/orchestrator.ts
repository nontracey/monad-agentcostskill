import type {
  PaymentRequest,
  PolicyResult,
  AuditRecord,
  PaymentResult,
  OrchestratorCtx,
  NotificationRecord,
} from "./types.js";
import { buildExplorerUrl } from "./types.js";
import { loadPolicy, evaluatePolicy, calcSpentToday } from "./policy.js";
import { loadSessionKey } from "./session-key.js";
import { auditAppend, auditRead } from "./audit.js";
import { sendDirect } from "./direct-transfer.js";
import { payWithMpp } from "./mpp-client.js";
import { fetchWithX402 } from "./x402-client.js";
import { notifyRecord, sendDiscordWebhook } from "./notifier.js";
import { resolve } from "node:path";

function getNotificationPath(): string {
  return resolve(process.cwd(), "data", "notifications.log");
}

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

  // 4. Load recent payments for rate limit check
  const recentPayments = auditRead(ctx.auditLogPath, 100);

  // 5. Evaluate policy (with new rules)
  const policyResult = evaluatePolicy(request, policy, spentToday, recentPayments);

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

    // Send notification for rejected payments
    const notifPath = getNotificationPath();
    const warning: NotificationRecord = {
      timestamp: new Date().toISOString(),
      type: "warning",
      title: "支付被拒绝",
      message: `Agent ${request.agentId} 请求 ${request.amount} ${request.token} 被拒绝: ${policyResult.reason}`,
      severity: "warning",
    };
    notifyRecord(warning, notifPath);

    // Discord webhook
    if (process.env.DISCORD_WEBHOOK_URL) {
      await sendDiscordWebhook(
        process.env.DISCORD_WEBHOOK_URL,
        "支付被拒绝",
        `${request.agentId} 请求 ${request.amount} ${request.token}\n原因: ${policyResult.reason}`,
        "warning",
      );
    }

    return { status: "rejected", policyResult };
  }

  // 6. Execute payment
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
      const response = await fetchWithX402(
        {
          sessionKey,
          rpcUrl: ctx.rpcUrl,
          chainId: ctx.chainId,
        },
        request.to,
      );
      x402Status = response.status;
      if (!response.ok) {
        throw new Error(
          `x402 request failed: HTTP ${response.status} ${response.statusText}`,
        );
      }
      x402Note = `Paid via x402 to access ${request.to}`;
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

    // Send notification for approved payments
    const notifPath = getNotificationPath();
    const paymentNotif: NotificationRecord = {
      timestamp: new Date().toISOString(),
      type: "payment",
      title: "支付成功",
      message: `${request.agentId} 支付 ${request.amount} ${request.token} → ${request.to}\n原因: ${request.reason}`,
      severity: "info",
    };
    notifyRecord(paymentNotif, notifPath);

    if (process.env.DISCORD_WEBHOOK_URL && txHash) {
      await sendDiscordWebhook(
        process.env.DISCORD_WEBHOOK_URL,
        "支付成功",
        `${request.agentId} 支付 ${request.amount} ${request.token}\n交易: ${buildExplorerUrl(txHash, ctx.chainId)}`,
        "info",
      );
    }

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

    // Send notification for failed payments
    const notifPath = getNotificationPath();
    const errorNotif: NotificationRecord = {
      timestamp: new Date().toISOString(),
      type: "warning",
      title: "支付失败",
      message: `${request.agentId} 支付 ${request.amount} ${request.token} 失败: ${errorMsg}`,
      severity: "error",
    };
    notifyRecord(errorNotif, notifPath);

    if (process.env.DISCORD_WEBHOOK_URL) {
      await sendDiscordWebhook(
        process.env.DISCORD_WEBHOOK_URL,
        "支付失败",
        `${request.agentId} 支付失败\n错误: ${errorMsg}`,
        "error",
      );
    }

    return {
      status: "failed",
      policyResult: failedResult,
      error: errorMsg,
    };
  }
}
