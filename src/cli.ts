#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http, formatEther } from "viem";

import { generateSessionKey, saveSessionKey, loadSessionKeyInfo, revokeSessionKey } from "./session-key.js";
import { loadPolicy, savePolicy, calcSpentToday } from "./policy.js";
import { auditRead } from "./audit.js";
import { orchestratePayment } from "./orchestrator.js";
import { getBalance } from "./direct-transfer.js";
import type { OrchestratorCtx, PaymentRequest } from "./types.js";
import { shortenAddress } from "./types.js";
import * as fmt from "./fmt.js";
import { auditTableColored } from "./fmt.js";
import { notifyRead, generateDailyReport, formatDailyReport } from "./notifier.js";

const program = new Command();
program.name("agent-cost").description("Agent-native wallet with policy enforcement and audit logging").version("0.1.0");

// Helpers
function getDataDir(): string {
  return resolve(process.cwd(), "data");
}
function getPolicyPath(): string {
  return resolve(getDataDir(), "policies.json");
}
function getSessionPath(): string {
  return resolve(getDataDir(), "session.key.json");
}
function getAuditPath(): string {
  return resolve(getDataDir(), "audit.log");
}

function getMainAddress(): string | null {
  const key = process.env.MAIN_PRIVATE_KEY?.trim();
  if (!key || key.length === 0) return null;
  return privateKeyToAccount(key as `0x${string}`).address;
}

function buildCtx(): OrchestratorCtx {
  const mainAddr = getMainAddress();
  return {
    policyPath: getPolicyPath(),
    sessionKeyPath: getSessionPath(),
    auditLogPath: getAuditPath(),
    rpcUrl: process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz/",
    chainId: Number(process.env.CHAIN_ID || 10143),
    mainAddress: mainAddr || "0x0000000000000000000000000000000000000000",
  };
}

// ── init ──────────────────────────────────────────────────────────────
program
  .command("init")
  .description("Initialize session key, policies, and audit log")
  .action(async () => {
    const dataDir = getDataDir();
    mkdirSync(dataDir, { recursive: true });

    // Generate session key
    const sessionKey = generateSessionKey();
    saveSessionKey(getSessionPath(), sessionKey);

    // Load or create policy
    const policyPath = getPolicyPath();
    let policy = existsSync(policyPath) ? loadPolicy(policyPath) : null;

    if (!policy) {
      const singleLimit = process.env.SINGLE_LIMIT || "0.5";
      const dailyLimit = process.env.DAILY_LIMIT || "1.0";
      const allowedTokens = (process.env.ALLOWED_TOKENS || "MON").split(",");
      const newPolicy = {
        singleLimit,
        dailyLimit,
        allowedTokens,
        whitelistAddresses: [],
        sessionId: sessionKey.address,
        timeWindow: { enabled: false, startHour: 9, endHour: 18 },
        rateLimit: { enabled: false, maxPerMinute: 5 },
        agentTiers: [],
      };
      savePolicy(newPolicy, policyPath);
      policy = newPolicy;
    } else {
      policy.sessionId = sessionKey.address;
      savePolicy(policy, policyPath);
    }

    // Create empty audit log
    const auditPath = getAuditPath();
    if (!existsSync(auditPath)) {
      writeFileSync(auditPath, "", "utf-8");
    }

    // Get main address
    const mainAddr = getMainAddress();
    const mainDisplay = mainAddr || "Not configured (set MAIN_PRIVATE_KEY in .env)";

    console.log(fmt.success("Agent Cost Skill 初始化完成"));
    console.log(`   ${fmt.icons.money} 主钱包:     ${fmt.monospace(shortenAddress(mainDisplay))}`);
    console.log(`   ${fmt.icons.key} Session Key: ${fmt.cyan(sessionKey.address)}`);
    console.log(`   📏 单笔限额:     ${fmt.bold(policy.singleLimit + " MON")}`);
    console.log(`   📊 日上限:       ${fmt.bold(policy.dailyLimit + " MON")}`);
    console.log(`   🪙 允许Token:    ${fmt.green(policy.allowedTokens.join(", "))}`);
    console.log(`   📁 数据目录:     ${fmt.monospace(dataDir)}`);
    console.log("");
    console.log(fmt.dim("Agent 现在可以使用 pay() 了。"));
  });

// ── pay ───────────────────────────────────────────────────────────────
program
  .command("pay")
  .description("Request a payment (policy enforced)")
  .requiredOption("--mode <direct|mpp|x402>", "Payment mode")
  .requiredOption("--to <address>", "Recipient address (direct/mpp) or API URL (x402)")
  .requiredOption("--amount <amount>", "Amount to send")
  .requiredOption("--token <token>", "Token symbol (e.g. MON)")
  .requiredOption("--reason <text>", "Reason for payment (audit trail)")
  .option("--agent <id>", "Agent identifier", "cli-user")
  .action(async (opts: {
    mode: "direct" | "mpp" | "x402";
    to: string;
    amount: string;
    token: string;
    reason: string;
    agent: string;
  }) => {
    const ctx = buildCtx();

    // Validate session key exists
    if (!existsSync(ctx.sessionKeyPath)) {
      console.error("❌ 错误: 未初始化。请先运行 `agent-cost init`");
      process.exit(1);
    }

    const request: PaymentRequest = {
      mode: opts.mode,
      to: opts.to,
      amount: opts.amount,
      token: opts.token,
      reason: opts.reason,
      agentId: opts.agent,
    };

    const result = await orchestratePayment(request, ctx);

    if (result.status === "approved") {
      console.log(fmt.success("支付已批准"));
      console.log(`   ${fmt.icons.key} Agent:   ${fmt.bold(request.agentId)}`);
      console.log(`   ${fmt.icons.money} 收款:   ${fmt.monospace(request.to)}`);
      console.log(`   💵 金额:   ${fmt.bold(request.amount + " " + request.token)}`);
      console.log(`   📝 原因:   ${request.reason}`);
      if (result.explorerUrl) {
        console.log(`   🔗 交易:   ${fmt.formatExplorerUrl(result.txHash!)}`);
      }
      if (result.x402Note) {
        console.log(`   ⚡ x402:   ${result.x402Note}`);
      }
      if (result.x402Status) {
        console.log(`   🌐 HTTP:   ${result.x402Status}`);
      }
      console.log(`   ${fmt.dim("已记录到审计日志")}`);
    } else if (result.status === "rejected") {
      console.log(fmt.error("支付被策略引擎拒绝"));
      console.log(`   ${fmt.icons.error} 原因:     ${fmt.red(result.policyResult.reason)}`);
      const spent = calcSpentToday(ctx.auditLogPath, request.token);
      const policy = loadPolicy(ctx.policyPath);
      console.log(`   📊 当前已花费: ${fmt.yellow(spent.toFixed(4))} / ${policy.dailyLimit} ${request.token}`);
      console.log(fmt.dim("   请调整策略或等待次日重置"));
    } else {
      console.log(fmt.warning("支付执行失败"));
      console.log(`   ${fmt.icons.error} 错误:     ${fmt.red(result.error!)}`);
      console.log(fmt.dim("   已记录到审计日志"));
    }
  });

// ── audit ─────────────────────────────────────────────────────────────
program
  .command("audit")
  .description("View payment history")
  .option("-l, --limit <n>", "Number of recent records to show", "10")
  .action((opts: { limit: string }) => {
    const auditPath = getAuditPath();
    const records = auditRead(auditPath, Number(opts.limit));
    console.log(auditTableColored(records));
  });

// ── revoke ────────────────────────────────────────────────────────────
program
  .command("revoke")
  .description("Revoke current session key and generate a new one")
  .action(async () => {
    const ctx = buildCtx();

    if (!existsSync(ctx.sessionKeyPath)) {
      console.error("❌ 错误: 未初始化。请先运行 `agent-cost init`");
      process.exit(1);
    }

    const oldKey = loadSessionKeyInfo(ctx.sessionKeyPath);
    if (!oldKey) {
      console.error("❌ 错误: 无法读取旧 session key");
      process.exit(1);
    }

    console.log(`${fmt.icons.refresh} 正在撤销 Session Key: ${fmt.monospace(shortenAddress(oldKey.address))}`);

    const result = await revokeSessionKey(
      ctx.sessionKeyPath,
      ctx.mainAddress,
      ctx.rpcUrl,
      ctx.chainId,
    );

    if (result.drained) {
      console.log(`   ${fmt.success} 旧 key 余额已转回主钱包 (tx: ${fmt.monospace(result.txHash!)})`);
    } else {
      console.log(`   ${fmt.info}  旧 key 无余额，直接轮换`);
    }
    console.log(`   ${fmt.success} 新 Session Key: ${fmt.cyan(result.newKey.address)}`);
    console.log("");
    console.log(fmt.dim("Agent 现在无法再使用旧 key 发起支付。"));
  });

// ── balance ───────────────────────────────────────────────────────────
program
  .command("balance")
  .description("View wallet balances")
  .action(async () => {
    const ctx = buildCtx();
    const usdcContract = process.env.USDC_CONTRACT;

    // Main wallet
    const mainAddress = getMainAddress();
    if (mainAddress) {
      const mainBal = await getBalance(mainAddress, "MON", ctx.rpcUrl, usdcContract);
      console.log(`${fmt.bold(fmt.icons.money)} 主钱包 ${fmt.monospace(shortenAddress(mainAddress))}: ${fmt.bold(Number(mainBal).toFixed(4))} MON`);
    } else {
      console.log(`${fmt.warning} 主钱包: ${fmt.dim("未配置 MAIN_PRIVATE_KEY")}`);
    }

    // Session key
    const sessionInfo = loadSessionKeyInfo(ctx.sessionKeyPath);
    if (sessionInfo) {
      const sessionBal = await getBalance(sessionInfo.address, "MON", ctx.rpcUrl, usdcContract);
      console.log(`${fmt.bold(fmt.icons.key)} Session Key ${fmt.monospace(shortenAddress(sessionInfo.address))}: ${fmt.bold(Number(sessionBal).toFixed(4))} MON`);
    } else {
      console.log(`${fmt.warning} Session Key: ${fmt.dim("未初始化（运行 init）")}`);
    }
  });

// ── policy ────────────────────────────────────────────────────────────
program
  .command("policy")
  .description("View current policy configuration")
  .action(() => {
    const policyPath = getPolicyPath();
    if (!existsSync(policyPath)) {
      console.log(fmt.dim("暂无策略配置。请先运行 `agent-cost init`"));
      return;
    }
    const policy = loadPolicy(policyPath);
    console.log(fmt.bold(`${fmt.icons.clipboard} 当前策略配置：`));
    console.log(`   📏 单笔限额:       ${fmt.bold(policy.singleLimit + " MON")}`);
    console.log(`   📊 日上限:         ${fmt.bold(policy.dailyLimit + " MON")}`);
    console.log(`   🪙 允许Token:      ${fmt.green(policy.allowedTokens.join(", "))}`);
    console.log(`   📋 白名单地址:     ${policy.whitelistAddresses.length > 0 ? fmt.cyan(policy.whitelistAddresses.join(", ")) : fmt.dim("(无限制)")}`);
    console.log(`   🔑 Session Key ID: ${policy.sessionId ? fmt.monospace(policy.sessionId) : fmt.dim("(未设置)")}`);
    console.log("");
    console.log(fmt.dim("📋 新增策略规则："));
    console.log(`   ⏰ 时间窗口:       ${policy.timeWindow.enabled ? fmt.green(`${policy.timeWindow.startHour}:00-${policy.timeWindow.endHour}:00`) : fmt.dim("未启用")}`);
    console.log(`   ⚡ 频率限制:       ${policy.rateLimit.enabled ? fmt.green(`${policy.rateLimit.maxPerMinute} 次/分钟`) : fmt.dim("未启用")}`);
    console.log(`   👥 Agent 分级:     ${policy.agentTiers.length > 0 ? fmt.cyan(`${policy.agentTiers.length} 个 Agent`) : fmt.dim("无")}`);
    if (policy.agentTiers.length > 0) {
      for (const tier of policy.agentTiers) {
        console.log(`      • ${tier.agentId}: 单笔 ${tier.singleLimit || "默认"}, 每日 ${tier.dailyLimit || "默认"}`);
      }
    }
  });

// ── report ────────────────────────────────────────────────────────
program
  .command("report")
  .description("Generate daily budget report")
  .option("-d, --date <YYYY-MM-DD>", "Report date (default: today)")
  .action((opts: { date?: string }) => {
    const auditPath = getAuditPath();
    const records = auditRead(auditPath);
    const date = opts.date || new Date().toISOString().slice(0, 10);
    const report = generateDailyReport(records, date);
    console.log(formatDailyReport(report));

    // Save notification
    const notifPath = resolve(getDataDir(), "notifications.log");
    notifyRead(notifPath); // Ensure file exists
  });

// ── notifications ─────────────────────────────────────────────────
program
  .command("notifications")
  .description("View notification history")
  .option("-l, --limit <n>", "Number of recent records", "20")
  .action((opts: { limit: string }) => {
    const notifPath = resolve(getDataDir(), "notifications.log");
    const records = notifyRead(notifPath, Number(opts.limit));
    if (records.length === 0) {
      console.log(fmt.dim("暂无通知记录。"));
      return;
    }
    for (const r of records) {
      const icon = r.severity === "error" ? "❌" : r.severity === "warning" ? "⚠️" : "ℹ️";
      const time = r.timestamp.slice(0, 19).replace("T", " ");
      console.log(`${icon} [${fmt.dim(time)}] ${fmt.bold(r.title)}`);
      console.log(`   ${r.message}`);
      console.log("");
    }
  });

program.parse();
