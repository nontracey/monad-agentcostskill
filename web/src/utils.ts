export function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function getStatusBadge(status: string): { label: string; color: string } {
  switch (status) {
    case "approved":
      return { label: "已批准", color: "#22c55e" };
    case "rejected":
      return { label: "已拒绝", color: "#ef4444" };
    case "failed":
      return { label: "失败", color: "#f59e0b" };
    default:
      return { label: status, color: "#6b7280" };
  }
}

export function getModeLabel(mode: string): string {
  switch (mode) {
    case "direct":
      return "直接转账";
    case "mpp":
      return "MPP";
    case "x402":
      return "x402";
    default:
      return mode;
  }
}

export function formatAmount(amount: string, token: string): string {
  const num = Number(amount);
  if (isNaN(num)) return amount;

  // USDC has 6 decimals, display properly
  if (token.toUpperCase() === "USDC") {
    // If amount looks like smallest units (> 1000), convert
    if (num > 1000 && !amount.includes(".")) {
      return (num / 1e6).toFixed(6);
    }
    return num.toFixed(6);
  }
  // MON and others: standard display
  if (num < 0.0001 && num > 0) return num.toExponential(4);
  return num.toFixed(4);
}

export function calcDailySpent(
  records: import("./types").AuditRecord[],
  token: string = "MON"
): number {
  const today = new Date().toISOString().slice(0, 10);
  return records
    .filter(
      (r) =>
        r.timestamp.slice(0, 10) === today &&
        r.status === "approved" &&
        r.request.token.toUpperCase() === token.toUpperCase()
    )
    .reduce((sum, r) => sum + Number(r.request.amount), 0);
}

export function exportExplorerUrl(txHash: string): string {
  return `https://testnet.monadexplorer.com/tx/${txHash}`;
}

export function countByMode(
  records: import("./types").AuditRecord[]
): Record<string, number> {
  const counts: Record<string, number> = { direct: 0, mpp: 0, x402: 0 };
  records.forEach((r) => {
    counts[r.request.mode] = (counts[r.request.mode] || 0) + 1;
  });
  return counts;
}

export function usdcToHuman(usdcUnits: string): string {
  // Convert from smallest units (6 decimals) to human readable
  const num = Number(usdcUnits);
  if (isNaN(num)) return usdcUnits;
  if (num > 1000) return (num / 1e6).toFixed(6);
  return usdcUnits;
}
