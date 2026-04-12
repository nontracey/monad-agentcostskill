import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AuditRecord } from "./types.js";

export function auditAppend(record: AuditRecord, logPath: string): void {
  // Ensure directory exists
  const dir = dirname(logPath);
  mkdirSync(dir, { recursive: true });

  const line = JSON.stringify(record) + "\n";
  appendFileSync(logPath, line, "utf-8");
}

export function auditRead(logPath: string, limit?: number): AuditRecord[] {
  if (!existsSync(logPath)) return [];

  const raw = readFileSync(logPath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);

  const records: AuditRecord[] = [];
  for (const line of lines) {
    try {
      records.push(JSON.parse(line) as AuditRecord);
    } catch {
      // Skip malformed lines
    }
  }

  // Sort by timestamp descending (newest first)
  records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (limit) {
    return records.slice(0, limit);
  }
  return records;
}

export function auditFormat(records: AuditRecord[]): string {
  if (records.length === 0) {
    return "暂无审计记录。";
  }

  const header = `${pad("时间", 22)} ${pad("Agent", 20)} ${pad("收款人", 12)} ${pad("金额", 12)} ${pad("原因", 24)} ${pad("策略结果", 22)} ${pad("状态", 10)}`;
  const separator = "─".repeat(header.length);

  const rows = records.map((r) => {
    const time = r.timestamp.slice(0, 19).replace("T", " ");
    const agent = shorten(r.agentId, 20);
    const to = shorten(r.request.to, 12);
    const amount = `${r.request.amount} ${r.request.token}`;
    const reason = shorten(r.request.reason, 24);
    const policy = shorten(r.policyResult.reason, 22);
    const status = r.status === "approved" ? "✅ approved" : r.status === "rejected" ? "❌ rejected" : "⚠️ failed";

    return `${pad(time, 22)} ${pad(agent, 20)} ${pad(to, 12)} ${pad(amount, 12)} ${pad(reason, 24)} ${pad(policy, 22)} ${status}`;
  });

  return [header, separator, ...rows].join("\n");
}

function pad(str: string, len: number): string {
  if (str.length >= len) return str.slice(0, len);
  return str + " ".repeat(len - str.length);
}

function shorten(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}
