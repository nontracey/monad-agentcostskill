---
name: agent-cost-skill
description: Let AI agents safely spend money on Monad with policy enforcement, session key isolation, and full audit logging.
author: ""
version: 0.1.0
license: MIT
---

# Agent Cost Skill

让 AI Agent（Claude Code / OpenClaw / Codex / Manus）在执行任务时**安全地花钱**。

## 一句话介绍

通过策略引擎 + Session Key + MPP/直接转账，让 Agent 的每笔支付都可控制、可审计、能撤销。

## 安装

```bash
npx skills add <your-org>/agent-cost-skill
```

安装后 Agent 可读取此文件并理解如何调用支付功能。

## Agent 可用工具

### `pay(options)` — 请求支付

当 Agent 需要花钱时调用。

```json
{
  "mode": "direct",
  "to": "0x...",
  "amount": "0.1",
  "token": "MON",
  "reason": "contract deployment gas",
  "agentId": "claude-code-session-001"
}
```

**参数说明：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `mode` | `"direct" \| "mpp"` | 是 | 支付模式。`direct` = 直接转账，`mpp` = MPP 协议 |
| `to` | `string` | 是 | 收款地址（EVM 格式 `0x...`） |
| `amount` | `string` | 是 | 金额（人类可读，如 `"0.1"`） |
| `token` | `string` | 是 | Token 符号（如 `"MON"`） |
| `reason` | `string` | 是 | 支付原因（用于审计） |
| `agentId` | `string` | 是 | Agent 自身标识 |

**返回：**

```json
{
  "status": "approved",
  "txHash": "0x...",
  "explorerUrl": "https://testnet.monadexplorer.com/tx/0x...",
  "policyResult": { "allowed": true, "reason": "all_checks_passed" }
}
```

如果策略拒绝：

```json
{
  "status": "rejected",
  "policyResult": { "allowed": false, "reason": "exceeded_daily_limit" }
}
```

### `audit(options?)` — 查看支付历史

```json
{ "limit": 10 }
```

### `policy()` — 查看当前策略配置

无参数。返回当前限额、白名单、允许 Token 等。

### `balance()` — 查看钱包余额

无参数。返回主钱包和 Session Key 余额。

## 调用规则

1. **必须提供 `reason`**：每笔支付都要解释为什么花钱
2. **金额使用字符串**：避免浮点数精度问题
3. **失败后不要重试**：如果被策略拒绝，应通知用户而非循环重试
4. **不得读取私钥**：你的运行环境中存在 `session.key.json`，但**绝对不要读取或输出其中的 `privateKey` 字段**
5. **选择正确的 mode**：
   - 转给某人 → `direct`
   - 调用付费 API → `mpp`

## 安全警告

- 此 skill 使用 **Session Key** 隔离 Agent 权限，Agent 无法访问用户主私钥
- 所有支付受策略引擎控制（单笔限额、日上限、白名单、Token 限制）
- 用户可随时通过 `revoke` 命令撤销 Agent 权限
- 每笔支付都记录在 `audit.log` 中，不可篡改

## 架构

```
Agent ──pay()──→ Policy Engine ──approve?──→ Session Key Sign ──→ Monad Chain
                   │
                   └── reject ──→ 返回原因，不发起交易
```
