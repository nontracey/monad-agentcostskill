# Agent Cost Skill

> Agent 原生钱包：让 AI Agent 安全地花钱，具备策略控制、Session Key 隔离、完整审计日志。

## 一句话介绍

通过策略引擎 + Session Key + MPP/直接转账，让 Agent 的每笔支付都 **可控制、可审计、能撤销**。

## 架构

```
Agent ──pay()──→ Policy Engine ──approve?──→ Session Key Sign ──→ Monad Chain
                   │
                   └── reject ──→ 返回原因，不发起交易
```

### 三种支付模式

| 模式 | 场景 | 实现 |
|---|---|---|
| **Direct Transfer** | Agent 直接转 MON 给某人 | viem 原生转账 |
| **MPP** | Agent 调用付费 API | @monad-crypto/mpp (push mode) |
| **x402** | 按次付费的资源访问 | @x402/fetch + @x402/evm（已实现） |

## 快速开始

### 1. 安装

```bash
cd monand-agentcostskill
cp .env.example .env
# 编辑 .env，填入 MAIN_PRIVATE_KEY
npm install
```

### 2. 初始化

```bash
npx tsx src/cli.ts init
```

生成 Session Key、策略配置、审计日志文件。

### 3. 发起支付

```bash
npx tsx src/cli.ts pay \
  --mode direct \
  --to 0xRecipientAddress \
  --amount 0.1 \
  --token MON \
  --reason "contract deployment gas" \
  --agent claude-code-001
```

### 4. 查看审计日志

```bash
npx tsx src/cli.ts audit
```

### 5. 撤销权限

```bash
npx tsx src/cli.ts revoke
```

旧 Session Key 余额转回主钱包，生成新 key。Agent 无法再使用旧 key。

## 命令说明

| 命令 | 说明 |
|---|---|
| `init` | 初始化 Session Key + 策略 + 审计日志 |
| `pay --mode <direct\|mpp> --to <addr> --amount <amt> --token <tok> --reason <text> [--agent <id>]` | 请求支付（策略 enforced） |
| `audit [--limit <n>]` | 查看最近 N 条支付记录 |
| `revoke` | 撤销当前 Session Key，生成新的 |
| `balance` | 查看主钱包和 Session Key 余额 |
| `policy` | 查看当前策略配置 |

## 策略配置

初始化后生成 `data/policies.json`：

```json
{
  "singleLimit": "0.5",
  "dailyLimit": "1.0",
  "allowedTokens": ["MON"],
  "whitelistAddresses": [],
  "sessionId": "0x..."
}
```

| 字段 | 说明 |
|---|---|
| `singleLimit` | 单笔支付上限（MON） |
| `dailyLimit` | 每日预算上限（MON） |
| `allowedTokens` | 允许支付的 Token 列表 |
| `whitelistAddresses` | 白名单收款地址（空 = 不限制） |
| `sessionId` | 当前 Session Key 地址 |

## 审计日志格式

`data/audit.log` 采用 JSON Lines 格式，每行一条记录：

```json
{
  "timestamp": "2026-04-12T10:30:00.000Z",
  "agentId": "claude-code-001",
  "request": {
    "mode": "direct",
    "to": "0xabc...",
    "amount": "0.1",
    "token": "MON",
    "reason": "contract deployment gas",
    "agentId": "claude-code-001"
  },
  "policyResult": { "allowed": true, "reason": "All checks passed", "matchedRule": null },
  "txHash": "0x123...",
  "status": "approved",
  "humanConfirmed": false
}
```

## 与 MonSkills 集成

此项目兼容 MonSkills 规范。AI Agent 可通过以下方式安装：

```bash
npx skills add <your-org>/agent-cost-skill
```

安装后，Agent 会读取 `SKILL.md` 并理解如何调用 `pay()`、`audit()` 等函数。

## 安全注意事项

1. **主私钥绝不暴露给 Agent**：Agent 只使用 Session Key，用户持有主钱包
2. **策略 enforced**：每笔支付都经过策略引擎，超限自动拒绝
3. **可随时撤销**：`revoke` 命令立即撤销 Agent 权限
4. **完整审计**：每笔支付记录 Agent、原因、策略结果、交易哈希
5. **`.env` 和 `session.key.json` 已加入 `.gitignore`，不要提交到仓库**

## License

MIT
