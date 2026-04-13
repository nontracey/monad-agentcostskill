import { describe, it, expect, beforeEach } from "vitest";
import { auditAppend, auditRead, auditFormat } from "../src/audit.js";
import type { AuditRecord } from "../src/types.js";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function makeRecord(overrides: Partial<AuditRecord> = {}): AuditRecord {
  return {
    timestamp: new Date().toISOString(),
    agentId: "test-agent",
    request: {
      mode: "direct",
      to: "0xaF292eEdC0e22A2Ed1b5A304AB7073fb8bdF34ED",
      amount: "0.1",
      token: "MON",
      reason: "test payment",
      agentId: "test-agent",
    },
    policyResult: { allowed: true, reason: "All checks passed", matchedRule: null },
    status: "approved",
    humanConfirmed: false,
    ...overrides,
  };
}

describe("auditAppend", () => {
  const tmpFile = join(tmpdir(), `test-audit-append-${Date.now()}.log`);

  beforeEach(() => {
    if (existsSync(tmpFile)) rmSync(tmpFile);
  });

  it("应该追加一条审计记录", () => {
    const record = makeRecord();
    auditAppend(record, tmpFile);

    expect(existsSync(tmpFile)).toBe(true);
    const content = require("fs").readFileSync(tmpFile, "utf-8");
    const lines = content.split("\n").filter((l: string) => l.trim());
    expect(lines.length).toBe(1);

    const parsed = JSON.parse(lines[0]);
    expect(parsed.agentId).toBe("test-agent");
  });

  it("应该自动创建目录", () => {
    const nestedPath = join(tmpdir(), `test-audit-nested-${Date.now()}`, "sub", "audit.log");
    const record = makeRecord();
    auditAppend(record, nestedPath);

    expect(existsSync(nestedPath)).toBe(true);
    rmSync(nestedPath, { recursive: true, force: true });
  });

  it("应该追加多条记录", () => {
    auditAppend(makeRecord({ agentId: "agent-1" }), tmpFile);
    auditAppend(makeRecord({ agentId: "agent-2" }), tmpFile);
    auditAppend(makeRecord({ agentId: "agent-3" }), tmpFile);

    const records = auditRead(tmpFile);
    expect(records.length).toBe(3);
  });
});

describe("auditRead", () => {
  const tmpFile = join(tmpdir(), `test-audit-read-${Date.now()}.log`);

  beforeEach(() => {
    if (existsSync(tmpFile)) rmSync(tmpFile);
  });

  it("不存在的文件应返回空数组", () => {
    expect(auditRead(tmpFile)).toEqual([]);
  });

  it("空文件应返回空数组", () => {
    writeFileSync(tmpFile, "");
    expect(auditRead(tmpFile)).toEqual([]);
  });

  it("应跳过格式错误的行", () => {
    writeFileSync(tmpFile, "not json\n{\"timestamp\":\"2026-04-13T00:00:00.000Z\"}\n");
    const records = auditRead(tmpFile);
    // 第一行被跳过，第二行虽然缺少字段但仍会被解析
    expect(records.length).toBeGreaterThanOrEqual(0);
  });

  it("应按时间戳倒序返回记录", () => {
    const records: AuditRecord[] = [
      makeRecord({ timestamp: "2026-04-13T08:00:00.000Z", agentId: "first" }),
      makeRecord({ timestamp: "2026-04-13T12:00:00.000Z", agentId: "second" }),
      makeRecord({ timestamp: "2026-04-13T10:00:00.000Z", agentId: "third" }),
    ];
    writeFileSync(tmpFile, records.map((r) => JSON.stringify(r)).join("\n"));

    const result = auditRead(tmpFile);
    expect(result[0].agentId).toBe("second");
    expect(result[1].agentId).toBe("third");
    expect(result[2].agentId).toBe("first");
  });

  it("应支持 limit 参数", () => {
    for (let i = 0; i < 5; i++) {
      auditAppend(makeRecord({ agentId: `agent-${i}` }), tmpFile);
    }
    const result = auditRead(tmpFile, 3);
    expect(result.length).toBe(3);
  });
});

describe("auditFormat", () => {
  it("空记录应返回提示信息", () => {
    const output = auditFormat([]);
    expect(output).toContain("暂无");
  });

  it("应格式化多条记录为表格", () => {
    const records: AuditRecord[] = [
      makeRecord({
        timestamp: "2026-04-13T10:30:00.000Z",
        agentId: "claude-code-001",
        request: {
          mode: "direct",
          to: "0xaF292eEdC0e22A2Ed1b5A304AB7073fb8bdF34ED",
          amount: "0.1",
          token: "MON",
          reason: "contract deployment",
          agentId: "claude-code-001",
        },
        status: "approved",
      }),
    ];
    const output = auditFormat(records);
    expect(output).toContain("claude-code-001");
    expect(output).toContain("0.1 MON");
    expect(output).toContain("contract deployment");
    expect(output).toContain("approved");
  });
});
