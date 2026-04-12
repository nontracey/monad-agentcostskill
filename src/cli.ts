#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http, formatEther } from "viem";

import { generateSessionKey, saveSessionKey, loadSessionKeyInfo, revokeSessionKey } from "./session-key.js";
import { loadPolicy, savePolicy, calcSpentToday } from "./policy.js";
import { auditRead, auditFormat } from "./audit.js";
import { orchestratePayment } from "./orchestrator.js";
import { getBalance } from "./direct-transfer.js";
import type { OrchestratorCtx, PaymentRequest } from "./types.js";
import { shortenAddress } from "./types.js";

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
      policy = {
        singleLimit,
        dailyLimit,
        allowedTokens,
        whitelistAddresses: [],
        sessionId: sessionKey.address,
      };
      savePolicy(policy, policyPath);
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

    console.log("✅ Agent Cost Skill 初始化完成");
    console.log(`   主钱包: ${shortenAddress(mainDisplay)}`);
    console.log(`   Session Key: ${sessionKey.address}`);
    console.log(`   单笔限额: ${policy.singleLimit} MON`);
    console.log(`   日上限:   ${policy.dailyLimit} MON`);
    console.log(`   允许Token: ${policy.allowedTokens.join(", ")}`);
    console.log(`   数据目录: ${dataDir}`);
    console.log("");
    console.log("Agent 现在可以使用 pay() 了。");
  });

// ── pay ───────────────────────────────────────────────────────────────
program
  .command("pay")
  .description("Request a payment (policy enforced)")
  .requiredOption("--mode <direct|mpp>", "Payment mode")
  .requiredOption("--to <address>", "Recipient address")
  .requiredOption("--amount <amount>", "Amount to send")
  .requiredOption("--token <token>", "Token symbol (e.g. MON)")
  .requiredOption("--reason <text>", "Reason for payment (audit trail)")
  .option("--agent <id>", "Agent identifier", "cli-user")
  .action(async (opts: {
    mode: "direct" | "mpp";
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
      console.log("✅ 支付已批准");
      console.log(`   Agent:  ${request.agentId}`);
      console.log(`   收款:   ${request.to}`);
      console.log(`   金额:   ${request.amount} ${request.token}`);
      console.log(`   原因:   ${request.reason}`);
      console.log(`   交易:   ${result.explorerUrl}`);
      console.log("   已记录到审计日志");
    } else if (result.status === "rejected") {
      console.log("❌ 支付被策略引擎拒绝");
      console.log(`   原因:   ${result.policyResult.reason}`);
      const spent = calcSpentToday(ctx.auditLogPath, request.token);
      const policy = loadPolicy(ctx.policyPath);
      console.log(`   当前已花费: ${spent} / ${policy.dailyLimit} ${request.token}`);
      console.log("   请调整策略或等待次日重置");
    } else {
      console.log("⚠️  支付执行失败");
      console.log(`   错误:   ${result.error}`);
      console.log("   已记录到审计日志");
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
    console.log(auditFormat(records));
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

    console.log(`🔄 正在撤销 Session Key: ${shortenAddress(oldKey.address)}`);

    const result = await revokeSessionKey(
      ctx.sessionKeyPath,
      ctx.mainAddress,
      ctx.rpcUrl,
      ctx.chainId,
    );

    if (result.drained) {
      console.log(`   ✅ 旧 key 余额已转回主钱包 (tx: ${result.txHash})`);
    } else {
      console.log("   ℹ️  旧 key 无余额，直接轮换");
    }
    console.log(`   ✅ 新 Session Key: ${result.newKey.address}`);
    console.log("");
    console.log("Agent 现在无法再使用旧 key 发起支付。");
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
      console.log(`主钱包 (${shortenAddress(mainAddress)}): ${Number(mainBal).toFixed(4)} MON`);
    } else {
      console.log("主钱包: 未配置 MAIN_PRIVATE_KEY");
    }

    // Session key
    const sessionInfo = loadSessionKeyInfo(ctx.sessionKeyPath);
    if (sessionInfo) {
      const sessionBal = await getBalance(sessionInfo.address, "MON", ctx.rpcUrl, usdcContract);
      console.log(`Session Key (${shortenAddress(sessionInfo.address)}): ${Number(sessionBal).toFixed(4)} MON`);
    } else {
      console.log("Session Key: 未初始化（运行 `init`）");
    }
  });

// ── policy ────────────────────────────────────────────────────────────
program
  .command("policy")
  .description("View current policy configuration")
  .action(() => {
    const policyPath = getPolicyPath();
    if (!existsSync(policyPath)) {
      console.log("暂无策略配置。请先运行 `agent-cost init`");
      return;
    }
    const policy = loadPolicy(policyPath);
    console.log("📋 当前策略配置：");
    console.log(`   单笔限额:       ${policy.singleLimit} MON`);
    console.log(`   日上限:         ${policy.dailyLimit} MON`);
    console.log(`   允许Token:      ${policy.allowedTokens.join(", ")}`);
    console.log(`   白名单地址:     ${policy.whitelistAddresses.length > 0 ? policy.whitelistAddresses.join(", ") : "(无限制)"}`);
    console.log(`   Session Key ID: ${policy.sessionId || "(未设置)"}`);
  });

program.parse();
