import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { NotificationRecord, DailyReport, AuditRecord } from "./types.js";

export function notifyRecord(record: NotificationRecord, logPath: string): void {
  const dir = dirname(logPath);
  mkdirSync(dir, { recursive: true });
  const line = JSON.stringify(record) + "\n";
  appendFileSync(logPath, line, "utf-8");
}

export function notifyRead(logPath: string, limit?: number): NotificationRecord[] {
  if (!existsSync(logPath)) return [];
  const raw = readFileSync(logPath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const records: NotificationRecord[] = [];
  for (const line of lines) {
    try {
      records.push(JSON.parse(line) as NotificationRecord);
    } catch {
      // Skip malformed lines
    }
  }
  records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  if (limit) return records.slice(0, limit);
  return records;
}

export async function sendDiscordWebhook(
  webhookUrl: string,
  title: string,
  message: string,
  severity: "info" | "warning" | "error" = "info",
): Promise<void> {
  const colorMap = {
    info: 0x6366f1,
    warning: 0xf59e0b,
    error: 0xef4444,
  };

  const payload = {
    embeds: [
      {
        title: `💰 Agent Cost Skill — ${title}`,
        description: message,
        color: colorMap[severity],
        timestamp: new Date().toISOString(),
        footer: { text: "Agent Cost Skill | Monad Testnet" },
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Silently fail — notification should not block payment flow
  }
}

export function generateDailyReport(
  records: AuditRecord[],
  date: string,
): DailyReport {
  const filtered = records.filter((r) => r.timestamp.slice(0, 10) === date);
  const approved = filtered.filter((r) => r.status === "approved");
  const rejected = filtered.filter((r) => r.status === "rejected");

  const totalSpent: Record<string, number> = {};
  for (const r of approved) {
    const token = r.request.token.toUpperCase();
    totalSpent[token] = (totalSpent[token] || 0) + Number(r.request.amount);
  }

  const agentMap = new Map<string, { count: number; amount: number }>();
  for (const r of approved) {
    const existing = agentMap.get(r.agentId) || { count: 0, amount: 0 };
    existing.count += 1;
    existing.amount += Number(r.request.amount);
    agentMap.set(r.agentId, existing);
  }

  const topAgents = Array.from(agentMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([agentId, data]) => ({ agentId, ...data }));

  return {
    date,
    totalPayments: filtered.length,
    approvedPayments: approved.length,
    rejectedPayments: rejected.length,
    totalSpent,
    topAgents,
  };
}

export function formatDailyReport(report: DailyReport): string {
  const lines: string[] = [];
  lines.push(`📊 每日预算报告 — ${report.date}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`总支付: ${report.totalPayments} | ✅ ${report.approvedPayments} | ❌ ${report.rejectedPayments}`);
  lines.push("");

  for (const [token, amount] of Object.entries(report.totalSpent)) {
    lines.push(`💵 支出 (${token}): ${amount.toFixed(4)}`);
  }

  if (report.topAgents.length > 0) {
    lines.push("");
    lines.push("🔝 Top Agents:");
    for (const agent of report.topAgents) {
      lines.push(`   • ${agent.agentId}: ${agent.count} 笔, ${agent.amount.toFixed(4)} MON`);
    }
  }

  return lines.join("\n");
}
