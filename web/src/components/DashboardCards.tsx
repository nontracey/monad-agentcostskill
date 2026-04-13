import type { Policy } from "../types";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: string;
}

export function StatCard({ title, value, subtitle, icon }: StatCardProps) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "12px",
        padding: "24px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        border: "1px solid #f0f0f0",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "20px" }}>{icon}</span>
        <span style={{ color: "#6b7280", fontSize: "14px", fontWeight: 500 }}>{title}</span>
      </div>
      <div style={{ fontSize: "28px", fontWeight: 700, color: "#111827" }}>{value}</div>
      {subtitle && (
        <div style={{ fontSize: "13px", color: "#9ca3af" }}>{subtitle}</div>
      )}
    </div>
  );
}

interface ProgressBarProps {
  used: number;
  limit: number;
  label: string;
  unit?: string;
}

export function ProgressBar({ used, limit, label, unit = "MON" }: ProgressBarProps) {
  const pct = limit > 0 ? Math.min((used / Number(limit)) * 100, 100) : 0;
  const color = pct > 90 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#22c55e";

  return (
    <div style={{ background: "#fff", borderRadius: "12px", padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #f0f0f0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ fontSize: "14px", color: "#6b7280", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: "14px", color: "#111827", fontWeight: 600 }}>
          {used.toFixed(4)} / {Number(limit).toFixed(2)} {unit}
        </span>
      </div>
      <div
        style={{
          width: "100%",
          height: "8px",
          background: "#f3f4f6",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: "4px",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
        已使用 {pct.toFixed(1)}%
      </div>
    </div>
  );
}

interface PolicyInfoProps {
  policy: Policy;
}

export function PolicyInfo({ policy }: PolicyInfoProps) {
  // 兼容旧数据
  const timeWindow = policy.timeWindow || { enabled: false, startHour: 9, endHour: 18 };
  const rateLimit = policy.rateLimit || { enabled: false, maxPerMinute: 5 };
  const agentTiers = policy.agentTiers || [];

  return (
    <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #f0f0f0" }}>
      <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: 600, color: "#111827" }}>
        📋 策略配置
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        <div>
          <div style={{ fontSize: "12px", color: "#9ca3af" }}>单笔限额</div>
          <div style={{ fontSize: "18px", fontWeight: 600, color: "#111827" }}>{policy.singleLimit} MON</div>
        </div>
        <div>
          <div style={{ fontSize: "12px", color: "#9ca3af" }}>日上限</div>
          <div style={{ fontSize: "18px", fontWeight: 600, color: "#111827" }}>{policy.dailyLimit} MON</div>
        </div>
        <div>
          <div style={{ fontSize: "12px", color: "#9ca3af" }}>允许 Token</div>
          <div style={{ fontSize: "18px", fontWeight: 600, color: "#111827" }}>{policy.allowedTokens.join(", ")}</div>
        </div>
        <div>
          <div style={{ fontSize: "12px", color: "#9ca3af" }}>白名单地址</div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>
            {policy.whitelistAddresses.length > 0
              ? `${policy.whitelistAddresses.length} 个地址`
              : "无限制"}
          </div>
        </div>
      </div>

      {/* Phase 3: New rules */}
      <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #f3f4f6" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "#6b7280", marginBottom: "12px" }}>新增策略规则</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <div style={{ padding: "12px", background: "#f9fafb", borderRadius: "8px" }}>
            <div style={{ fontSize: "12px", color: "#9ca3af" }}>⏰ 时间窗口</div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: timeWindow.enabled ? "#22c55e" : "#9ca3af" }}>
              {timeWindow.enabled
                ? `${timeWindow.startHour}:00 - ${timeWindow.endHour}:00`
                : "未启用"}
            </div>
          </div>
          <div style={{ padding: "12px", background: "#f9fafb", borderRadius: "8px" }}>
            <div style={{ fontSize: "12px", color: "#9ca3af" }}>⚡ 频率限制</div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: rateLimit.enabled ? "#22c55e" : "#9ca3af" }}>
              {rateLimit.enabled
                ? `${rateLimit.maxPerMinute} 次/分钟`
                : "未启用"}
            </div>
          </div>
          <div style={{ padding: "12px", background: "#f9fafb", borderRadius: "8px" }}>
            <div style={{ fontSize: "12px", color: "#9ca3af" }}>👥 Agent 分级</div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: agentTiers.length > 0 ? "#22c55e" : "#9ca3af" }}>
              {agentTiers.length > 0
                ? `${agentTiers.length} 个 Agent`
                : "无"}
            </div>
          </div>
        </div>
        {agentTiers.length > 0 && (
          <div style={{ marginTop: "12px" }}>
            {agentTiers.map((tier, i) => (
              <div key={i} style={{ padding: "8px 12px", background: "#f9fafb", borderRadius: "6px", marginBottom: "4px", fontSize: "13px", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, color: "#111827" }}>{tier.agentId}</span>
                <span style={{ color: "#6b7280" }}>单笔 {tier.singleLimit || "默认"} / 每日 {tier.dailyLimit || "默认"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {policy.sessionId && (
        <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: "12px", color: "#9ca3af" }}>Session Key</div>
          <div style={{ fontSize: "13px", fontWeight: 500, color: "#6366f1", fontFamily: "monospace" }}>
            {policy.sessionId}
          </div>
        </div>
      )}
    </div>
  );
}
