import type { AuditRecord } from "../types";
import { shortenAddress, formatTimestamp, getStatusBadge, getModeLabel, exportExplorerUrl, formatAmount } from "../utils";

interface AuditTableProps {
  records: AuditRecord[];
}

export function AuditTable({ records }: AuditTableProps) {
  if (records.length === 0) {
    return (
      <div style={{ background: "#fff", borderRadius: "12px", padding: "48px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #f0f0f0" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>📭</div>
        <div style={{ color: "#6b7280", fontSize: "15px" }}>暂无交易记录</div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #f0f0f0", overflowX: "auto" }}>
      <h3 style={{ margin: "0 0 20px 0", fontSize: "16px", fontWeight: 600, color: "#111827" }}>
        📜 交易历史 ({records.length} 条)
      </h3>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "14px",
          minWidth: "800px",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "2px solid #f3f4f6" }}>
            <th style={thStyle}>时间</th>
            <th style={thStyle}>Agent</th>
            <th style={thStyle}>模式</th>
            <th style={thStyle}>收款人</th>
            <th style={thStyle}>金额</th>
            <th style={thStyle}>原因</th>
            <th style={thStyle}>策略结果</th>
            <th style={thStyle}>状态</th>
            <th style={thStyle}>交易</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => {
            const badge = getStatusBadge(r.status);
            return (
              <tr
                key={i}
                style={{
                  borderBottom: "1px solid #f9fafb",
                  background: i % 2 === 0 ? "#fff" : "#fafafa",
                }}
              >
                <td style={tdStyle}>{formatTimestamp(r.timestamp)}</td>
                <td style={tdStyle}>{shortenAddress(r.agentId)}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      background: "#f3f4f6",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: 500,
                    }}
                  >
                    {getModeLabel(r.request.mode)}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "13px" }}>
                  {shortenAddress(r.request.to)}
                </td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>
                  {formatAmount(r.request.amount, r.request.token)} {r.request.token}
                </td>
                <td style={{ ...tdStyle, maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={r.request.reason}
                >
                  {r.request.reason}
                </td>
                <td style={{ ...tdStyle, fontSize: "12px", color: r.policyResult.allowed ? "#22c55e" : "#ef4444" }}>
                  {shortenAddress(r.policyResult.reason)}
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      background: badge.color + "18",
                      color: badge.color,
                      padding: "2px 10px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    {badge.label}
                  </span>
                </td>
                <td style={tdStyle}>
                  {r.txHash ? (
                    <a
                      href={exportExplorerUrl(r.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#6366f1", textDecoration: "none", fontSize: "12px" }}
                    >
                      🔗 查看
                    </a>
                  ) : (
                    <span style={{ color: "#d1d5db" }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  color: "#6b7280",
  fontWeight: 500,
  fontSize: "13px",
};

const tdStyle: React.CSSProperties = {
  padding: "12px",
  color: "#374151",
};
