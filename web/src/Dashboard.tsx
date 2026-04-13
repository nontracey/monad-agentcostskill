import { useRef, useState } from "react";
import type { AuditRecord, Policy, DashboardData, TabKey } from "./types";
import { calcDailySpent, countByMode } from "./utils";
import { StatCard, ProgressBar, PolicyInfo } from "./components/DashboardCards";
import { AuditTable } from "./components/AuditTable";
import { X402Guide } from "./components/X402Guide";

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async () => {
    setError(null);
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) return;

    try {
      let auditRecords: AuditRecord[] = [];
      let policy: Policy | null = null;
      let sessionKeyAddress: string | null = null;

      for (const file of Array.from(files)) {
        const text = await file.text();

        if (file.name === "audit.log") {
          const lines = text.split("\n").filter((l) => l.trim().length > 0);
          for (const line of lines) {
            try {
              auditRecords.push(JSON.parse(line) as AuditRecord);
            } catch {
              // Skip malformed lines
            }
          }
          auditRecords.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        } else if (file.name === "policies.json") {
          policy = JSON.parse(text) as Policy;
        } else if (file.name === "session.key.json") {
          const parsed = JSON.parse(text);
          sessionKeyAddress = parsed.address || null;
        }
      }

      if (!policy && auditRecords.length === 0) {
        setError("未识别到有效数据文件（需要 audit.log 或 policies.json）");
        return;
      }

      setData({
        policy,
        auditRecords,
        sessionKeyAddress,
        importedAt: new Date().toLocaleString("zh-CN"),
      });
    } catch (err) {
      setError(`解析失败: ${err instanceof Error ? err.message : "未知错误"}`);
    }
  };

  const handleReset = () => {
    setData(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Import Screen ─────────────────────────────────────────────
  if (!data) {
    return (
      <div style={containerStyle}>
        <header style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "32px" }}>💰</span>
            <div>
              <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#111827" }}>
                Agent Cost Skill
              </h1>
              <p style={{ margin: "4px 0 0 0", color: "#6b7280", fontSize: "14px" }}>
                Dashboard — 支付数据可视化
              </p>
            </div>
          </div>
        </header>

        <main style={mainStyle}>
          <div style={importCardStyle}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📂</div>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "20px", color: "#111827" }}>
              导入数据文件
            </h2>
            <p style={{ color: "#6b7280", fontSize: "14px", margin: "0 0 24px 0" }}>
              选择 <code style={codeStyle}>audit.log</code>、<code style={codeStyle}>policies.json</code> 或{" "}
              <code style={codeStyle}>session.key.json</code> 文件（可多选）
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".log,.json"
              onChange={handleFileUpload}
              style={fileInputStyle}
            />
            {error && (
              <div
                style={{
                  background: "#fef2f2",
                  color: "#dc2626",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  marginTop: "16px",
                }}
              >
                ❌ {error}
              </div>
            )}
            <div style={{ marginTop: "24px", color: "#9ca3af", fontSize: "13px" }}>
              所有数据处理均在本地完成，不会上传任何服务器。
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Dashboard Screen ──────────────────────────────────────────
  const dailySpent = data.policy
    ? calcDailySpent(data.auditRecords, data.policy.allowedTokens[0] || "MON")
    : 0;
  const totalTx = data.auditRecords.length;
  const approvedTx = data.auditRecords.filter((r: AuditRecord) => r.status === "approved").length;
  const rejectedTx = data.auditRecords.filter((r: AuditRecord) => r.status === "rejected").length;
  const modeCounts = countByMode(data.auditRecords);

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "dashboard", label: "总览", icon: "📊" },
    { key: "x402", label: "x402 协议", icon: "⚡" },
    { key: "history", label: "交易历史", icon: "📜" },
    { key: "policy", label: "策略配置", icon: "📋" },
  ];

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "32px" }}>💰</span>
          <div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#111827" }}>
              Agent Cost Skill
            </h1>
            <p style={{ margin: "4px 0 0 0", color: "#6b7280", fontSize: "14px" }}>
              数据导入于 {data.importedAt}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                ...tabBtnStyle,
                ...(activeTab === tab.key ? tabBtnActiveStyle : {}),
              }}
            >
              {tab.icon} {tab.label}
              {tab.key === "history" && totalTx > 0 && (
                <span style={{
                  background: activeTab === tab.key ? "rgba(255,255,255,0.2)" : "#e5e7eb",
                  color: activeTab === tab.key ? "#fff" : "#6b7280",
                  borderRadius: "10px",
                  padding: "1px 7px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}>
                  {totalTx}
                </span>
              )}
            </button>
          ))}
          <button onClick={handleReset} style={resetBtnStyle}>
            🔄
          </button>
        </div>
      </header>

      <main style={mainStyle}>
        {/* ── Dashboard Tab ──────────────────────────────────── */}
        {activeTab === "dashboard" && (
          <>
            <div style={grid4Style}>
              <StatCard
                icon="💳"
                title="总交易数"
                value={String(totalTx)}
                subtitle={`${approvedTx} 批准 / ${rejectedTx} 拒绝`}
              />
              <StatCard
                icon="📊"
                title="今日已用"
                value={`${dailySpent.toFixed(4)}`}
                subtitle={data.policy ? `${data.policy.allowedTokens[0] || "MON"}` : ""}
              />
              <StatCard
                icon="🔑"
                title="Session Key"
                value={data.sessionKeyAddress ? data.sessionKeyAddress.slice(0, 10) + "..." : "未导入"}
                subtitle={data.policy?.sessionId ? data.policy.sessionId.slice(0, 10) + "..." : ""}
              />
              <StatCard
                icon="🪙"
                title="允许 Token"
                value={data.policy?.allowedTokens.join(", ") || "—"}
                subtitle={data.policy ? `单笔限额 ${data.policy.singleLimit} MON` : ""}
              />
            </div>

            {/* Payment mode breakdown */}
            {(modeCounts.direct > 0 || modeCounts.mpp > 0 || modeCounts.x402 > 0) && (
              <div style={{
                background: "#fff",
                borderRadius: "12px",
                padding: "20px 24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                border: "1px solid #f0f0f0",
              }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 600, color: "#6b7280" }}>
                  支付模式分布
                </h3>
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                  {modeCounts.direct > 0 && (
                    <span style={modeBadgeStyle}>
                      💸 直接转账 <strong>{modeCounts.direct}</strong>
                    </span>
                  )}
                  {modeCounts.mpp > 0 && (
                    <span style={modeBadgeStyle}>
                      🔄 MPP <strong>{modeCounts.mpp}</strong>
                    </span>
                  )}
                  {modeCounts.x402 > 0 && (
                    <span style={{
                      ...modeBadgeStyle,
                      background: "#eff6ff",
                      color: "#2563eb",
                    }}>
                      ⚡ x402 <strong>{modeCounts.x402}</strong>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Progress Bars */}
            {data.policy && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <ProgressBar
                  used={dailySpent}
                  limit={Number(data.policy.dailyLimit)}
                  label="今日预算使用"
                />
                <ProgressBar
                  used={data.auditRecords
                    .filter((r: AuditRecord) => r.status === "approved")
                    .reduce((s: number, r: AuditRecord) => s + Number(r.request.amount), 0)}
                  limit={Number(data.policy.dailyLimit) * 7}
                  label="近 7 日累计支出"
                  unit={data.policy.allowedTokens[0] || "MON"}
                />
              </div>
            )}

            {/* Recent transactions */}
            <AuditTable records={data.auditRecords.slice(0, 5)} />
          </>
        )}

        {/* ── x402 Tab ─────────────────────────────────────── */}
        {activeTab === "x402" && <X402Guide />}

        {/* ── History Tab ──────────────────────────────────── */}
        {activeTab === "history" && <AuditTable records={data.auditRecords} />}

        {/* ── Policy Tab ───────────────────────────────────── */}
        {activeTab === "policy" && data.policy && <PolicyInfo policy={data.policy} />}
      </main>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────
const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f8f9fb",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const headerStyle: React.CSSProperties = {
  background: "#fff",
  borderBottom: "1px solid #e5e7eb",
  padding: "16px 32px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const mainStyle: React.CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "32px 24px",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};

const importCardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: "16px",
  padding: "48px",
  textAlign: "center",
  maxWidth: "520px",
  margin: "80px auto",
  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
  border: "2px dashed #e5e7eb",
};

const codeStyle: React.CSSProperties = {
  background: "#f3f4f6",
  padding: "2px 6px",
  borderRadius: "4px",
  fontSize: "13px",
  fontFamily: "monospace",
};

const fileInputStyle: React.CSSProperties = {
  display: "block",
  margin: "0 auto",
  padding: "8px",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  cursor: "pointer",
};

const resetBtnStyle: React.CSSProperties = {
  background: "#f3f4f6",
  border: "none",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "14px",
  color: "#374151",
};

const grid4Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "16px",
};

const tabBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid transparent",
  padding: "6px 14px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "13px",
  color: "#6b7280",
  fontWeight: 500,
  display: "flex",
  alignItems: "center",
  gap: "4px",
  transition: "all 0.15s ease",
};

const tabBtnActiveStyle: React.CSSProperties = {
  background: "#6366f1",
  color: "#fff",
  borderColor: "#6366f1",
};

const modeBadgeStyle: React.CSSProperties = {
  background: "#f3f4f6",
  padding: "4px 12px",
  borderRadius: "16px",
  fontSize: "13px",
  color: "#374151",
};
