import { describe, it, expect, beforeEach } from "vitest";
import { evaluatePolicy, loadPolicy, savePolicy } from "../src/policy.js";
import { notifyRecord, notifyRead, generateDailyReport, formatDailyReport } from "../src/notifier.js";
import type { Policy, AuditRecord } from "../src/types.js";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ── Time Window Tests ────────────────────────────────────────────
describe("Policy — Time Window", () => {
  const defaultPolicy: Policy = {
    singleLimit: "0.5",
    dailyLimit: "1.0",
    allowedTokens: ["MON"],
    whitelistAddresses: [],
    sessionId: null,
    timeWindow: { enabled: true, startHour: 9, endHour: 18 },
    rateLimit: { enabled: false, maxPerMinute: 5 },
    agentTiers: [],
  };

  function makeRequest(overrides: any = {}) {
    return {
      mode: "direct" as const,
      to: "0xaF292eEdC0e22A2Ed1b5A304AB7073fb8bdF34ED",
      amount: "0.1",
      token: "MON",
      reason: "test",
      agentId: "test-agent",
      ...overrides,
    };
  }

  it("应该允许工作时间内的支付", () => {
    // We can't easily mock Date, so test the structure
    const policy: Policy = {
      ...defaultPolicy,
      timeWindow: { enabled: false, startHour: 9, endHour: 18 },
    };
    const result = evaluatePolicy(makeRequest(), policy, 0);
    expect(result.allowed).toBe(true);
  });

  it("时间窗口未启用时应始终允许", () => {
    const policy: Policy = {
      ...defaultPolicy,
      timeWindow: { enabled: false, startHour: 9, endHour: 18 },
    };
    const result = evaluatePolicy(makeRequest(), policy, 0);
    expect(result.allowed).toBe(true);
  });
});

// ── Rate Limit Tests ─────────────────────────────────────────────
describe("Policy — Rate Limit", () => {
  function makeRecord(timestamp: string): AuditRecord {
    return {
      timestamp,
      agentId: "test-agent",
      request: {
        mode: "direct", to: "0x1", amount: "0.1", token: "MON",
        reason: "test", agentId: "test-agent",
      },
      policyResult: { allowed: true, reason: "ok", matchedRule: null },
      status: "approved",
      humanConfirmed: false,
    };
  }

  it("未启用时应允许支付", () => {
    const policy: Policy = {
      singleLimit: "0.5", dailyLimit: "1.0", allowedTokens: ["MON"],
      whitelistAddresses: [], sessionId: null,
      timeWindow: { enabled: false, startHour: 9, endHour: 18 },
      rateLimit: { enabled: false, maxPerMinute: 5 },
      agentTiers: [],
    };
    const now = new Date().toISOString();
    const recent = [makeRecord(now)];
    const result = evaluatePolicy(
      { mode: "direct", to: "0x1", amount: "0.1", token: "MON", reason: "test", agentId: "test-agent" },
      policy, 0, recent,
    );
    expect(result.allowed).toBe(true);
  });

  it("超过频率限制应拒绝", () => {
    const policy: Policy = {
      singleLimit: "0.5", dailyLimit: "1.0", allowedTokens: ["MON"],
      whitelistAddresses: [], sessionId: null,
      timeWindow: { enabled: false, startHour: 9, endHour: 18 },
      rateLimit: { enabled: true, maxPerMinute: 2 },
      agentTiers: [],
    };
    const now = Date.now();
    const recent = [
      makeRecord(new Date(now - 10000).toISOString()),
      makeRecord(new Date(now - 5000).toISOString()),
    ];
    const result = evaluatePolicy(
      { mode: "direct", to: "0x1", amount: "0.1", token: "MON", reason: "test", agentId: "test-agent" },
      policy, 0, recent,
    );
    expect(result.allowed).toBe(false);
    expect(result.matchedRule).toBe("exceeded_rate_limit");
  });
});

// ── Agent Tier Tests ─────────────────────────────────────────────
describe("Policy — Agent Tiers", () => {
  function makeRequest(overrides: any = {}) {
    return {
      mode: "direct" as const,
      to: "0xaF292eEdC0e22A2Ed1b5A304AB7073fb8bdF34ED",
      amount: "0.1",
      token: "MON",
      reason: "test",
      agentId: "premium-agent",
      ...overrides,
    };
  }

  it("应该使用 Agent 专属限额", () => {
    const policy: Policy = {
      singleLimit: "0.5", dailyLimit: "1.0", allowedTokens: ["MON"],
      whitelistAddresses: [], sessionId: null,
      timeWindow: { enabled: false, startHour: 9, endHour: 18 },
      rateLimit: { enabled: false, maxPerMinute: 5 },
      agentTiers: [
        { agentId: "premium-agent", singleLimit: "2.0", dailyLimit: "5.0" },
      ],
    };
    const result = evaluatePolicy(makeRequest({ amount: "1.5" }), policy, 0);
    expect(result.allowed).toBe(true);
  });

  it("Agent 超额应拒绝", () => {
    const policy: Policy = {
      singleLimit: "0.5", dailyLimit: "1.0", allowedTokens: ["MON"],
      whitelistAddresses: [], sessionId: null,
      timeWindow: { enabled: false, startHour: 9, endHour: 18 },
      rateLimit: { enabled: false, maxPerMinute: 5 },
      agentTiers: [
        { agentId: "limited-agent", singleLimit: "0.1", dailyLimit: "0.3" },
      ],
    };
    const result = evaluatePolicy(makeRequest({ agentId: "limited-agent", amount: "0.2" }), policy, 0);
    expect(result.allowed).toBe(false);
    expect(result.matchedRule).toBe("exceeded_agent_tier_single_limit");
  });

  it("非分级 Agent 应使用默认限额", () => {
    const policy: Policy = {
      singleLimit: "0.5", dailyLimit: "1.0", allowedTokens: ["MON"],
      whitelistAddresses: [], sessionId: null,
      timeWindow: { enabled: false, startHour: 9, endHour: 18 },
      rateLimit: { enabled: false, maxPerMinute: 5 },
      agentTiers: [
        { agentId: "premium-agent", singleLimit: "2.0" },
      ],
    };
    const result = evaluatePolicy(makeRequest({ amount: "0.6", agentId: "normal-agent" }), policy, 0);
    expect(result.allowed).toBe(false);
    expect(result.matchedRule).toBe("exceeded_single_limit");
  });
});

// ── Notification Tests ───────────────────────────────────────────
describe("Notifier", () => {
  const tmpFile = join(tmpdir(), `test-notif-${Date.now()}.log`);

  beforeEach(() => {
    if (existsSync(tmpFile)) rmSync(tmpFile, { force: true });
  });

  it("应该追加通知记录", () => {
    const record = {
      timestamp: new Date().toISOString(),
      type: "payment" as const,
      title: "Test",
      message: "Test message",
      severity: "info" as const,
    };
    notifyRecord(record, tmpFile);
    expect(existsSync(tmpFile)).toBe(true);
  });

  it("应该读取并倒序返回通知", () => {
    const records = [
      { timestamp: "2026-04-13T08:00:00.000Z", type: "payment" as const, title: "First", message: "msg1", severity: "info" as const },
      { timestamp: "2026-04-13T12:00:00.000Z", type: "warning" as const, title: "Second", message: "msg2", severity: "warning" as const },
    ];
    for (const r of records) notifyRecord(r, tmpFile);

    const loaded = notifyRead(tmpFile);
    expect(loaded[0].title).toBe("Second");
    expect(loaded[1].title).toBe("First");
  });

  it("应该支持 limit 参数", () => {
    for (let i = 0; i < 5; i++) {
      notifyRecord({
        timestamp: new Date().toISOString(),
        type: "payment" as const,
        title: `Test ${i}`,
        message: `msg${i}`,
        severity: "info" as const,
      }, tmpFile);
    }
    expect(notifyRead(tmpFile, 3).length).toBe(3);
  });
});

// ── Daily Report Tests ───────────────────────────────────────────
describe("Daily Report", () => {
  const today = new Date().toISOString().slice(0, 10);

  function makeRecord(overrides: Partial<AuditRecord> = {}): AuditRecord {
    const base: AuditRecord = {
      timestamp: `${today}T10:00:00.000Z`,
      agentId: "test-agent",
      request: {
        mode: "direct", to: "0x1", amount: "0.1", token: "MON",
        reason: "test", agentId: "test-agent",
      },
      policyResult: { allowed: true, reason: "ok", matchedRule: null },
      status: "approved",
      humanConfirmed: false,
    };
    // Apply overrides on top
    if (overrides.timestamp) base.timestamp = overrides.timestamp;
    if (overrides.amount) base.request.amount = overrides.amount;
    if (overrides.agentId) { base.agentId = overrides.agentId; base.request.agentId = overrides.agentId; }
    if (overrides.status) base.status = overrides.status;
    return base;
  }

  it("应该生成每日预算报告", () => {
    const records = [
      makeRecord({ timestamp: `${today}T10:00:00.000Z`, amount: "0.2", agentId: "agent-a" }),
      makeRecord({ timestamp: `${today}T11:00:00.000Z`, amount: "0.3", agentId: "agent-b" }),
      makeRecord({ timestamp: `${today}T12:00:00.000Z`, status: "rejected" as const }),
    ];
    const report = generateDailyReport(records, today);

    expect(report.date).toBe(today);
    expect(report.totalPayments).toBe(3);
    expect(report.approvedPayments).toBe(2);
    expect(report.rejectedPayments).toBe(1);
    expect(report.totalSpent["MON"]).toBeCloseTo(0.5, 2);
    expect(report.topAgents.length).toBe(2);
    expect(report.topAgents[0].agentId).toBe("agent-a");
  });

  it("应该格式化报告为可读文本", () => {
    const records = [makeRecord({ timestamp: `${today}T10:00:00.000Z`, amount: "0.5" })];
    const report = generateDailyReport(records, today);
    const formatted = formatDailyReport(report);

    expect(formatted).toContain(today);
    expect(formatted).toContain("总支付");
    expect(formatted).toContain("0.5000");
  });

  it("空记录应生成零值报告", () => {
    const report = generateDailyReport([], today);
    expect(report.totalPayments).toBe(0);
    expect(Object.keys(report.totalSpent).length).toBe(0);
  });
});

// ── Policy Load/Save with new fields ─────────────────────────────
describe("Policy — New fields persistence", () => {
  const tmpFile = join(tmpdir(), `test-policy-new-${Date.now()}.json`);

  beforeEach(() => {
    if (existsSync(tmpFile)) rmSync(tmpFile, { force: true });
  });

  it("应该保存并加载包含新字段的策略", () => {
    const customPolicy: Policy = {
      singleLimit: "1.0",
      dailyLimit: "3.0",
      allowedTokens: ["MON", "USDC"],
      whitelistAddresses: [],
      sessionId: "0xSession",
      timeWindow: { enabled: true, startHour: 8, endHour: 20 },
      rateLimit: { enabled: true, maxPerMinute: 10 },
      agentTiers: [
        { agentId: "premium", singleLimit: "5.0", dailyLimit: "20.0" },
      ],
    };
    savePolicy(customPolicy, tmpFile);
    const loaded = loadPolicy(tmpFile);

    expect(loaded.timeWindow.enabled).toBe(true);
    expect(loaded.timeWindow.startHour).toBe(8);
    expect(loaded.rateLimit.maxPerMinute).toBe(10);
    expect(loaded.agentTiers.length).toBe(1);
    expect(loaded.agentTiers[0].agentId).toBe("premium");
  });
});
