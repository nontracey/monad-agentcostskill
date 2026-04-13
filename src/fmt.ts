import chalk from "chalk";
import Table from "cli-table3";
import type { AuditRecord } from "./types.js";

export const icons = {
  success: chalk.green("✅"),
  error: chalk.red("❌"),
  warning: chalk.yellow("⚠️"),
  info: chalk.blue("ℹ️"),
  refresh: "🔄",
  key: "🔑",
  money: "💰",
  clipboard: "📋",
  scroll: "📜",
};

export function success(msg: string): string {
  return `${icons.success} ${chalk.green(msg)}`;
}

export function error(msg: string): string {
  return `${icons.error} ${chalk.red(msg)}`;
}

export function warning(msg: string): string {
  return `${icons.warning} ${chalk.yellow(msg)}`;
}

export function info(msg: string): string {
  return `${icons.info} ${chalk.blue(msg)}`;
}

export function bold(msg: string): string {
  return chalk.bold(msg);
}

export function dim(msg: string): string {
  return chalk.dim(msg);
}

export function green(msg: string): string {
  return chalk.green(msg);
}

export function red(msg: string): string {
  return chalk.red(msg);
}

export function yellow(msg: string): string {
  return chalk.yellow(msg);
}

export function cyan(msg: string): string {
  return chalk.cyan(msg);
}

export function monospace(msg: string): string {
  return chalk.gray(msg);
}

export function formatExplorerUrl(txHash: string): string {
  // ANSI hyperlink转义序列（终端可点击）
  const url = `https://testnet.monadexplorer.com/tx/${txHash}`;
  return `\x1b]8;;${url}\x1b\\${chalk.cyan.underline(url)}\x1b]8;;\x1b\\`;
}

export function auditTableColored(records: AuditRecord[]): string {
  if (records.length === 0) {
    return chalk.gray("暂无审计记录。");
  }

  const table = new Table({
    head: [
      chalk.bold("时间"),
      chalk.bold("Agent"),
      chalk.bold("收款人"),
      chalk.bold("金额"),
      chalk.bold("原因"),
      chalk.bold("策略结果"),
      chalk.bold("状态"),
    ],
    style: {
      head: [],
      border: [chalk.gray("─")],
    },
    wordWrap: true,
    wrapOnWordBoundary: true,
  });

  for (const r of records) {
    const time = r.timestamp.slice(0, 19).replace("T", " ");
    const agent = shorten(r.agentId, 18);
    const to = shorten(r.request.to, 12);
    const amount = `${r.request.amount} ${r.request.token}`;
    const reason = shorten(r.request.reason, 22);
    const policyReason = shorten(r.policyResult.reason, 20);

    let status: string;
    switch (r.status) {
      case "approved":
        status = chalk.green("✅ approved");
        break;
      case "rejected":
        status = chalk.red("❌ rejected");
        break;
      case "failed":
        status = chalk.yellow("⚠️ failed");
        break;
      default:
        status = r.status;
    }

    const policyColor = r.policyResult.allowed ? chalk.green : chalk.red;

    table.push([
      time,
      agent,
      to,
      chalk.bold(amount),
      reason,
      policyColor(policyReason),
      status,
    ]);
  }

  return table.toString();
}

function shorten(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}
