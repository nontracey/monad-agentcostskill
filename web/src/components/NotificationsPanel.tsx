import type { NotificationRecord, AuditRecord, Policy } from "../types";
import { formatTimestamp, shortenAddress } from "../utils";

interface NotificationsProps {
  notifications: NotificationRecord[];
  auditRecords: AuditRecord[];
  policy: Policy | null;
}

export function NotificationsPanel({ notifications, auditRecords, policy }: NotificationsProps) {
  // Generate daily report from audit records
  const today = new Date().toISOString().slice(0, 10);
  const todayRecords = auditRecords.filter((r) => r.timestamp.slice(0, 10) === today);
  const approved = todayRecords.filter((r) => r.status === "approved");
  const rejected = todayRecords.filter((r) => r.status === "rejected");

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Daily Budget Report */}
      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>📊 今日预算报告</h3>
        <div style={reportHeaderStyle}>
          <span style={{ fontSize: "14px", color: "#6b7280" }}>{today}</span>
        </div>
        <div style={statsGridStyle}>
          <div style={statItemStyle}>
            <div style={statLabelStyle}>总支付</div>
            <div style={statValueStyle}>{todayRecords.length}</div>
          </div>
          <div style={statItemStyle}>
            <div style={statLabelStyle}>✅ 批准</div>
            <div style={{ ...statValueStyle, color: "#22c55e" }}>{approved.length}</div>
          </div>
          <div style={statItemStyle}>
            <div style={statLabelStyle}>❌ 拒绝</div>
            <div style={{ ...statValueStyle, color: "#ef4444" }}>{rejected.length}</div>
          </div>
        </div>

        {Object.entries(totalSpent).length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>支出明细</div>
            {Object.entries(totalSpent).map(([token, amount]) => (
              <div key={token} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f9fafb", borderRadius: "6px", marginBottom: "4px" }}>
                <span style={{ fontSize: "14px", color: "#374151" }}>{token}</span>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>{amount.toFixed(4)}</span>
              </div>
            ))}
          </div>
        )}

        {policy && (
          <div style={{ marginTop: "16px" }}>
            <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>预算使用</div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ flex: 1, height: "8px", background: "#f3f4f6", borderRadius: "4px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.min((totalSpent[policy.allowedTokens[0] || "MON"] || 0) / Number(policy.dailyLimit) * 100, 100)}%`,
                    height: "100%",
                    background: (totalSpent[policy.allowedTokens[0] || "MON"] || 0) / Number(policy.dailyLimit) > 0.8 ? "#ef4444" : "#22c55e",
                    borderRadius: "4px",
                  }}
                />
              </div>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>
                {((totalSpent[policy.allowedTokens[0] || "MON"] || 0) / Number(policy.dailyLimit) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        {topAgents.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>Top Agents</div>
            {topAgents.map((agent, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", background: "#f9fafb", borderRadius: "6px", marginBottom: "4px", fontSize: "13px" }}>
                <span style={{ color: "#374151" }}>{shortenAddress(agent.agentId)}</span>
                <span style={{ color: "#6b7280" }}>{agent.count} 笔 / {agent.amount.toFixed(4)} MON</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notifications List */}
      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>🔔 通知记录 ({notifications.length})</h3>
        {notifications.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>
            暂无通知记录
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {notifications.slice(0, 50).map((n, i) => {
              const icon = n.severity === "error" ? "❌" : n.severity === "warning" ? "⚠️" : "ℹ️";
              const borderColor = n.severity === "error" ? "#fecaca" : n.severity === "warning" ? "#fef3c7" : "#e0e7ff";
              const bgColor = n.severity === "error" ? "#fef2f2" : n.severity === "warning" ? "#fffbeb" : "#eef2ff";
              return (
                <div
                  key={i}
                  style={{
                    padding: "12px 16px",
                    background: bgColor,
                    border: `1px solid ${borderColor}`,
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>
                      {icon} {n.title}
                    </span>
                    <span style={{ fontSize: "12px", color: "#9ca3af" }}>{formatTimestamp(n.timestamp)}</span>
                  </div>
                  <div style={{ fontSize: "13px", color: "#4b5563", whiteSpace: "pre-wrap" }}>{n.message}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: "12px",
  padding: "24px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  border: "1px solid #f0f0f0",
};

const cardTitleStyle: React.CSSProperties = {
  margin: "0 0 16px 0",
  fontSize: "16px",
  fontWeight: 600,
  color: "#111827",
};

const reportHeaderStyle: React.CSSProperties = {
  marginBottom: "16px",
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "12px",
};

const statItemStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "12px",
  background: "#f9fafb",
  borderRadius: "8px",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#9ca3af",
  marginBottom: "4px",
};

const statValueStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
  color: "#111827",
};
