import { describe, it, expect, beforeEach } from "vitest";
import { evaluatePolicy, loadPolicy, savePolicy, calcSpentToday } from "../src/policy.js";
import type { Policy, PaymentRequest } from "../src/types.js";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Test fixtures
const defaultPolicy: Policy = {
  singleLimit: "0.5",
  dailyLimit: "1.0",
  allowedTokens: ["MON", "USDC"],
  whitelistAddresses: [],
  sessionId: "0xSessionKey123",
  timeWindow: { enabled: false, startHour: 9, endHour: 18 },
  rateLimit: { enabled: false, maxPerMinute: 5 },
  agentTiers: [],
};

function makeRequest(overrides: Partial<PaymentRequest> = {}): PaymentRequest {
  return {
    mode: "direct",
    to: "0xaF292eEdC0e22A2Ed1b5A304AB7073fb8bdF34ED",
    amount: "0.1",
    token: "MON",
    reason: "test payment",
    agentId: "test-agent",
    ...overrides,
  };
}

// ── Policy Engine Tests ──────────────────────────────────────
describe("evaluatePolicy", () => {
  it("应该批准有效的支付请求", () => {
    const request = makeRequest();
    const result = evaluatePolicy(request, defaultPolicy, 0);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("All checks passed");
    expect(result.matchedRule).toBeNull();
  });

  it("应该拒绝不支持的 Token", () => {
    const request = makeRequest({ token: "ETH" });
    const result = evaluatePolicy(request, defaultPolicy, 0);

    expect(result.allowed).toBe(false);
    expect(result.matchedRule).toBe("token_not_allowed");
  });

  it("应该拒绝金额为 0 的请求", () => {
    const request = makeRequest({ amount: "0" });
    const result = evaluatePolicy(request, defaultPolicy, 0);

    expect(result.allowed).toBe(false);
    expect(result.matchedRule).toBe("invalid_amount");
  });

  it("应该拒绝负数金额的请求", () => {
    const request = makeRequest({ amount: "-0.5" });
    const result = evaluatePolicy(request, defaultPolicy, 0);

    expect(result.allowed).toBe(false);
    expect(result.matchedRule).toBe("invalid_amount");
  });

  it("应该拒绝超过单笔限额的请求", () => {
    const request = makeRequest({ amount: "0.6" });
    const result = evaluatePolicy(request, defaultPolicy, 0);

    expect(result.allowed).toBe(false);
    expect(result.matchedRule).toBe("exceeded_single_limit");
  });

  it("应该允许等于单笔限额的请求", () => {
    const request = makeRequest({ amount: "0.5" });
    const result = evaluatePolicy(request, defaultPolicy, 0);

    expect(result.allowed).toBe(true);
  });

  it("应该拒绝超出日上限的请求", () => {
    // 已花费 0.8，再请求 0.3 = 1.1 > 1.0
    const request = makeRequest({ amount: "0.3" });
    const result = evaluatePolicy(request, defaultPolicy, 0.8);

    expect(result.allowed).toBe(false);
    expect(result.matchedRule).toBe("exceeded_daily_limit");
  });

  it("应该允许刚好在日上限内的请求", () => {
    // 已花费 0.7，再请求 0.3 = 1.0
    const request = makeRequest({ amount: "0.3" });
    const result = evaluatePolicy(request, defaultPolicy, 0.7);

    expect(result.allowed).toBe(true);
  });

  it("应该拒绝不在白名单中的地址", () => {
    const policyWithWhitelist: Policy = {
      ...defaultPolicy,
      whitelistAddresses: ["0xAllowedAddress123"],
    };
    const request = makeRequest({ to: "0xNotInWhitelist" });
    const result = evaluatePolicy(request, policyWithWhitelist, 0);

    expect(result.allowed).toBe(false);
    expect(result.matchedRule).toBe("address_not_whitelisted");
  });

  it("应该允许白名单中的地址（忽略大小写）", () => {
    const policyWithWhitelist: Policy = {
      ...defaultPolicy,
      whitelistAddresses: ["0xAllowedAddress123"],
    };
    const request = makeRequest({ to: "0xallowedaddress123" });
    const result = evaluatePolicy(request, policyWithWhitelist, 0);

    expect(result.allowed).toBe(true);
  });

  it("应该正确处理 Token 大小写", () => {
    const request = makeRequest({ token: "mon" });
    const result = evaluatePolicy(request, defaultPolicy, 0);

    expect(result.allowed).toBe(true);
  });
});

// ── Policy Load/Save Tests ───────────────────────────────────
describe("loadPolicy / savePolicy", () => {
  const tmpFile = join(tmpdir(), `test-policy-${Date.now()}.json`);

  beforeEach(() => {
    if (existsSync(tmpFile)) rmSync(tmpFile);
  });

  it("应该在文件不存在时创建默认策略", () => {
    const policy = loadPolicy(tmpFile);
    expect(policy.singleLimit).toBe("0.5");
    expect(policy.dailyLimit).toBe("1.0");
    expect(policy.allowedTokens).toEqual(["MON"]);
  });

  it("应该保存并加载自定义策略", () => {
    const customPolicy: Policy = {
      singleLimit: "2.0",
      dailyLimit: "5.0",
      allowedTokens: ["MON", "USDC"],
      whitelistAddresses: ["0xABC"],
      sessionId: "0xSession",
    };
    savePolicy(customPolicy, tmpFile);

    const loaded = loadPolicy(tmpFile);
    expect(loaded.singleLimit).toBe("2.0");
    expect(loaded.dailyLimit).toBe("5.0");
    expect(loaded.allowedTokens).toEqual(["MON", "USDC"]);
    expect(loaded.whitelistAddresses).toEqual(["0xABC"]);
  });

  it("应该为缺失的字段填充默认值", () => {
    writeFileSync(tmpFile, JSON.stringify({ singleLimit: "1.0" }));
    const loaded = loadPolicy(tmpFile);
    expect(loaded.singleLimit).toBe("1.0");
    expect(loaded.dailyLimit).toBe("1.0"); // default
  });
});

// ── calcSpentToday Tests ─────────────────────────────────────
describe("calcSpentToday", () => {
  const tmpFile = join(tmpdir(), `test-audit-${Date.now()}.log`);
  const today = new Date().toISOString().slice(0, 10);

  beforeEach(() => {
    if (existsSync(tmpFile)) rmSync(tmpFile);
  });

  it("空文件应返回 0", () => {
    writeFileSync(tmpFile, "");
    expect(calcSpentToday(tmpFile, "MON")).toBe(0);
  });

  it("应计算今日已批准的支出", () => {
    const records = [
      {
        timestamp: `${today}T10:00:00.000Z`,
        agentId: "agent-1",
        request: { mode: "direct" as const, to: "0x1", amount: "0.2", token: "MON", reason: "test", agentId: "agent-1" },
        policyResult: { allowed: true, reason: "ok", matchedRule: null },
        txHash: "0xtx1",
        status: "approved" as const,
        humanConfirmed: false,
      },
      {
        timestamp: `${today}T11:00:00.000Z`,
        agentId: "agent-2",
        request: { mode: "direct" as const, to: "0x2", amount: "0.3", token: "MON", reason: "test", agentId: "agent-2" },
        policyResult: { allowed: true, reason: "ok", matchedRule: null },
        txHash: "0xtx2",
        status: "approved" as const,
        humanConfirmed: false,
      },
    ];
    writeFileSync(tmpFile, records.map((r) => JSON.stringify(r)).join("\n"));
    expect(calcSpentToday(tmpFile, "MON")).toBe(0.5);
  });

  it("不应包含被拒绝的交易", () => {
    const records = [
      {
        timestamp: `${today}T10:00:00.000Z`,
        agentId: "agent-1",
        request: { mode: "direct" as const, to: "0x1", amount: "0.5", token: "MON", reason: "test", agentId: "agent-1" },
        policyResult: { allowed: false, reason: "no", matchedRule: "limit" },
        status: "rejected" as const,
        humanConfirmed: false,
      },
    ];
    writeFileSync(tmpFile, records.map((r) => JSON.stringify(r)).join("\n"));
    expect(calcSpentToday(tmpFile, "MON")).toBe(0);
  });

  it("不应包含昨日的交易", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const records = [
      {
        timestamp: `${yesterday}T10:00:00.000Z`,
        agentId: "agent-1",
        request: { mode: "direct" as const, to: "0x1", amount: "0.9", token: "MON", reason: "test", agentId: "agent-1" },
        policyResult: { allowed: true, reason: "ok", matchedRule: null },
        txHash: "0xtx1",
        status: "approved" as const,
        humanConfirmed: false,
      },
    ];
    writeFileSync(tmpFile, records.map((r) => JSON.stringify(r)).join("\n"));
    expect(calcSpentToday(tmpFile, "MON")).toBe(0);
  });
});
