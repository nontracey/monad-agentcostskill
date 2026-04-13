export function X402Guide() {
  const x402Config = {
    port: 3456,
    price: "10000",
    priceDisplay: "0.01 USDC",
    usdcContract: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
    payTo: "0x1234567890123456789012345678901234567890",
    chainId: 10143,
    facilitatorUrl: "https://x402-facilitator.molandak.org",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontSize: "32px" }}>⚡</span>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#111827" }}>
            x402 微支付协议
          </h2>
          <p style={{ margin: "4px 0 0 0", color: "#6b7280", fontSize: "14px" }}>
            按次付费的资源访问 — 每次 API 调用自动支付 USDC
          </p>
        </div>
      </div>

      {/* How it works */}
      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>📖 工作原理</h3>
        <div style={stepsStyle}>
          {steps.map((step, i) => (
            <div key={i} style={stepStyle}>
              <div style={stepNumberStyle}>{i + 1}</div>
              <div>
                <div style={stepTitleStyle}>{step.title}</div>
                <div style={stepDescStyle}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Deploy */}
      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>🚀 快速部署测试服务</h3>
        <div style={{ marginBottom: "16px" }}>
          <div style={labelStyle}>Step 1: 启动 x402 测试服务器</div>
          <div style={codeBlockStyle}>
            <code>npx tsx test/x402-test-server-real.ts</code>
          </div>
          <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "8px" }}>
            服务器将在 <code style={inlineCodeStyle}>http://localhost:{x402Config.port}</code> 启动
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <div style={labelStyle}>Step 2: 使用 CLI 发起 x402 支付</div>
          <div style={codeBlockStyle}>
            <code>{cliCommand}</code>
          </div>
        </div>

        <div>
          <div style={labelStyle}>配置说明</div>
          <div style={configGridStyle}>
            {configItems.map((item, i) => (
              <div key={i} style={configItemStyle}>
                <div style={configLabelStyle}>{item.label}</div>
                <div style={configValueStyle}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Price Display */}
      <div style={priceCardStyle}>
        <div style={{ fontSize: "14px", color: "#6b7280" }}>每次调用价格</div>
        <div style={{ fontSize: "32px", fontWeight: 700, color: "#2563eb" }}>
          {x402Config.priceDisplay}
        </div>
        <div style={{ fontSize: "13px", color: "#9ca3af" }}>
          USDC (6 位小数) · Monad 测试网 · {x402Config.chainId}
        </div>
      </div>

      {/* USDC Token Info */}
      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>🪙 USDC Token 信息</h3>
        <div style={configGridStyle}>
          <div style={configItemStyle}>
            <div style={configLabelStyle}>合约地址</div>
            <div style={{ ...configValueStyle, fontSize: "12px", wordBreak: "break-all" }}>
              {x402Config.usdcContract}
            </div>
          </div>
          <div style={configItemStyle}>
            <div style={configLabelStyle}>收款地址</div>
            <div style={{ ...configValueStyle, fontSize: "12px", wordBreak: "break-all" }}>
              {x402Config.payTo}
            </div>
          </div>
          <div style={configItemStyle}>
            <div style={configLabelStyle}>Facilitator</div>
            <div style={{ ...configValueStyle, fontSize: "12px", wordBreak: "break-all" }}>
              {x402Config.facilitatorUrl}
            </div>
          </div>
          <div style={configItemStyle}>
            <div style={configLabelStyle}>金额单位</div>
            <div style={configValueStyle}>最小单位 (10000 = 0.01 USDC)</div>
          </div>
        </div>
      </div>

      {/* Environment Variables */}
      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>⚙️ 环境变量配置</h3>
        <div style={codeBlockStyle}>
          <code>{envExample}</code>
        </div>
        <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "8px" }}>
          在 <code style={inlineCodeStyle}>.env</code> 文件中设置这些变量
        </div>
      </div>
    </div>
  );
}

// ── Data ──────────────────────────────────────────────────────────────
const steps = [
  {
    title: "客户端请求 API",
    desc: "Agent 向 x402 服务器发起 HTTP 请求",
  },
  {
    title: "服务器返回 402",
    desc: "响应包含 PAYMENT-REQUIRED header，描述支付要求（USDC 金额、收款地址）",
  },
  {
    title: "Agent 自动签名",
    desc: "@x402/fetch 使用 Session Key 签名 EIP-712 授权（ERC-3009）",
  },
  {
    title: "附加支付重试",
    desc: "请求附加 PAYMENT-SIGNATURE header 重新发送",
  },
  {
    title: "Facilitator 验证 & 结算",
    desc: "服务端调用 Facilitator /verify → /settle，链上完成 USDC 转账",
  },
  {
    title: "返回 200 OK",
    desc: "支付验证后，服务器返回请求的资源",
  },
];

const cliCommand = `npx tsx src/cli.ts pay --mode x402 \\
  --to http://localhost:3456/api/paid-content \\
  --amount 0.01 --token USDC \\
  --reason "x402 api call" \\
  --agent test-agent`;

const configItems = [
  { label: "端口", value: "3456" },
  { label: "价格", value: "0.01 USDC" },
  { label: "网络", value: "Monad Testnet (10143)" },
  { label: "协议版本", value: "x402 v2" },
];

const envExample = `# x402 配置
FACILITATOR_URL=https://x402-facilitator.molandak.org
PAY_TO=0x1234567890123456789012345678901234567890
PORT=3456

# USDC 合约 (Monad 测试网)
USDC_CONTRACT=0x534b2f3A21130d7a60830c2Df862319e593943A3`;

// ── Styles ────────────────────────────────────────────────────────────
const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  marginBottom: "8px",
};

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

const stepsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "12px",
};

const stepStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  alignItems: "flex-start",
};

const stepNumberStyle: React.CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  background: "#6366f1",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "13px",
  fontWeight: 600,
  flexShrink: 0,
};

const stepTitleStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#111827",
};

const stepDescStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b7280",
  marginTop: "2px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: "#374151",
  marginBottom: "8px",
};

const codeBlockStyle: React.CSSProperties = {
  background: "#f8f9fb",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "16px",
  fontSize: "13px",
  fontFamily: "monospace",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  color: "#1e293b",
  lineHeight: 1.6,
};

const inlineCodeStyle: React.CSSProperties = {
  background: "#f3f4f6",
  padding: "2px 6px",
  borderRadius: "4px",
  fontSize: "13px",
  fontFamily: "monospace",
};

const configGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "12px",
};

const configItemStyle: React.CSSProperties = {
  background: "#f9fafb",
  borderRadius: "8px",
  padding: "12px",
};

const configLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#9ca3af",
  marginBottom: "4px",
};

const configValueStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 500,
  color: "#111827",
  fontFamily: "monospace",
};

const priceCardStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%)",
  borderRadius: "12px",
  padding: "24px",
  textAlign: "center",
  border: "1px solid #bfdbfe",
};
