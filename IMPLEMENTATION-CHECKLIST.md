# Agent Cost Skill — 可落地实现步骤清单

> 目标：2 小时内交付 MVP，让 AI Agent 能安全地花钱，通过 MPP/x402/直接转账三种模式完成 Monad 链上支付。
> 技术栈：Node.js + TypeScript + viem + MPP + x402 + CLI

---

## 0. MVP 范围定义

### 本期做

- [x] 策略引擎（单笔限额、日限额、白名单地址、Token 限制）
- [x] Session Key 隔离（Agent 用子 key，主私钥不暴露）
- [x] MPP 客户端封装（HTTP 402 → 签名 → 重试）
- [x] 直接转账模式（viem 原生 transfer）
- [x] 支付编排器（选模式 → 策略评估 → 执行 → 返回）
- [x] 审计日志（JSON Lines，每行包含 who/why/to/amount/policy/result）
- [x] CLI 入口（init / pay / audit / revoke / policy）
- [x] SKILL.md（MonSkills 兼容格式，Agent 可读取）

### 本期不做（后加）

- [ ] x402 客户端完整封装（MVP 用 MPP 覆盖主要场景）
- [ ] 超阈值需人工确认流程
- [ ] 多 Agent 多权限分级
- [ ] 白名单合约检查
- [ ] Facilitator 模式集成
- [ ] 图形界面 / Dashboard

---

## 1. 项目初始化（10 分钟）

- [ ] 确认目录 `monand-agentcostskill/` 存在
- [ ] 创建 `src/` 目录
- [ ] `npm init -y`
- [ ] 安装依赖：
  - [ ] `viem`（EVM 交互核心）
  - [ ] `@monad-crypto/mpp`（MPP 协议）
  - [ ] `mppx`（MPP 运行时框架）
  - [ ] `dotenv`（环境变量）
  - [ ] `commander`（CLI 框架）
- [ ] 安装开发依赖：
  - [ ] `typescript`
  - [ ] `@types/node`
  - [ ] `tsx`（运行时编译）
- [ ] 创建 `tsconfig.json`（module: commonjs, target: ES2020, outDir: dist）
- [ ] 创建 `.env.example`
- [ ] 创建 `.gitignore`

### `.env.example`

```env
# 用户主钱包私钥（Agent 永远拿不到）
MAIN_PRIVATE_KEY=

# Monad 测试网 RPC
MONAD_RPC_URL=https://testnet-rpc.monad.xyz/

# 链 ID (测试网 10143)
CHAIN_ID=10143

# USDC 合约地址（MPP 支付用，测试网留空则用 MON 直转）
USDC_CONTRACT=

# 初始策略
DAILY_LIMIT=1.0
SINGLE_LIMIT=0.5
ALLOWED_TOKENS=MON
```

### `.gitignore`

```
.env
session.key.json
audit.log
policies.json
node_modules/
dist/
```

---

## 2. SKILL.md — Agent 技能描述（10 分钟）

文件：`SKILL.md`

这是 AI Agent（Claude Code / Codex / OpenClaw）安装后读取的"说明书"。

- [ ] 标题：`agent-cost-skill`
- [ ] 一句话描述：让 Agent 安全地花钱，通过策略引擎 + MPP + 直接转账完成 Monad 支付
- [ ] 安装命令：`npx skills add <your-org>/agent-cost-skill`
- [ ] Agent 可使用的工具列表：
  - `pay(to, amount, token, reason)` — 请求支付
  - `audit(limit?)` — 查看支付历史
  - `policy()` — 查看当前策略
  - `balance()` — 查看钱包余额
- [ ] Agent 调用规范（JSON 格式请求示例）
- [ ] 安全警告：Agent 代码不得读取 `MAIN_PRIVATE_KEY`，只能调用 skill 提供的函数

验收标准：

- [ ] MonSkills 兼容（放在仓库根目录）
- [ ] Agent 能仅通过读取此文件理解如何调用支付

---

## 3. 类型定义（5 分钟）

文件：`src/types.ts`

- [ ] `Policy` 接口
  ```ts
  interface Policy {
    singleLimit: string;        // 单笔上限（人类可读，如 "0.5"）
    dailyLimit: string;         // 日上限
    allowedTokens: string[];    // 允许的 Token（如 ["MON", "USDC"]）
    whitelistAddresses: string[]; // 白名单收款地址（空=不限制）
    sessionId: string | null;   // 当前 session key ID
  }
  ```
- [ ] `PaymentRequest` 接口
  ```ts
  interface PaymentRequest {
    mode: "direct" | "mpp";     // 支付模式
    to: string;                 // 收款地址
    amount: string;             // 金额
    token: string;              // Token
    reason: string;             // 支付原因（审计用）
    agentId: string;            // Agent 标识
  }
  ```
- [ ] `PolicyResult` 接口
  ```ts
  interface PolicyResult {
    allowed: boolean;
    reason: string;
    matchedRule: string | null; // 如 "exceeded_daily_limit"
  }
  ```
- [ ] `AuditRecord` 接口
  ```ts
  interface AuditRecord {
    timestamp: string;
    agentId: string;
    request: PaymentRequest;
    policyResult: PolicyResult;
    txHash?: string;
    status: "approved" | "rejected" | "failed";
    humanConfirmed: boolean;
  }
  ```

---

## 4. 策略引擎（20 分钟）

文件：`src/policy.ts`

### `evaluatePolicy(request: PaymentRequest, policy: Policy, spentToday: number) → PolicyResult`

检查顺序：

- [ ] Token 是否在 `allowedTokens` 中 → 否则 `rejected: "token_not_allowed"`
- [ ] 金额是否 `> 0` → 否则 `rejected: "invalid_amount"`
- [ ] 金额是否 `<= policy.singleLimit` → 否则 `rejected: "exceeded_single_limit"`
- [ ] `spentToday + amount <= policy.dailyLimit` → 否则 `rejected: "exceeded_daily_limit"`
- [ ] 若 `whitelistAddresses` 非空，收款地址是否在其中 → 否则 `rejected: "address_not_whitelisted"`
- [ ] 全部通过 → `allowed: true, reason: "all_checks_passed"`

### `loadPolicy(configPath: string) → Policy`

- [ ] 从 `policies.json` 读取
- [ ] 文件不存在时，从 `.env` 读取默认值并写入文件
- [ ] 校验字段完整性，缺失则补默认值

### `savePolicy(policy: Policy, configPath: string) → void`

- [ ] 写回 `policies.json`

### `calcSpentToday(auditLogPath: string) → number`

- [ ] 读取审计日志
- [ ] 筛选今天（UTC）状态为 `approved` 的记录
- [ ] 累加 `request.amount`（同一 token）

验收标准：

- [ ] 合法请求返回 `allowed: true`
- [ ] 超额、白名单外、不支持 Token 均返回明确拒绝原因
- [ ] 默认策略能从 .env 生成

---

## 5. Session Key 管理（15 分钟）

文件：`src/session-key.ts`

### `generateSessionKey() → { privateKey, address }`

- [ ] 用 `viem` 的 `generatePrivateKey()` 生成随机 key
- [ ] 派生地址 `privateKeyToAccount(privateKey).address`
- [ ] 返回对象

### `loadSessionKey(sessionPath: string) → Account | null`

- [ ] 从 `session.key.json` 读取
- [ ] 返回 viem Account 对象
- [ ] 文件不存在返回 null

### `saveSessionKey(sessionPath: string, key: { privateKey, address }) → void`

- [ ] 写入 `session.key.json`（提醒用户加入 .gitignore）

### `rotateSessionKey(mainKey: string, oldSessionPath: string, rpcUrl: string) → { newAddress, txHash? }`

MVP 简化方案：

- [ ] 生成新 session key
- [ ] 若旧 key 有余额，用旧 key 将余额转回主钱包（`revoke` 行为）
- [ ] 保存新 key
- [ ] 返回新地址

### `revokeSessionKey(sessionKey: Account, mainAddress: string, rpcUrl: string) → { txHash? }`

- [ ] 查询 session key 余额
- [ ] 若 > 0，全部转回主钱包
- [ ] 删除 `session.key.json`
- [ ] 返回结果

验收标准：

- [ ] init 后能生成可用 key
- [ ] revoke 后旧 key 地址余额归零

---

## 6. 直接转账模式（10 分钟）

文件：`src/direct-transfer.ts`

### `sendDirect(sessionKey: Account, to: string, amount: string, token: string, rpcUrl: string, chainId: number) → { txHash, status }`

- [ ] 初始化 viem wallet client + public client
- [ ] 如果 `token === "MON"`：
  - [ ] `walletClient.sendTransaction({ to, value: parseEther(amount) })`
- [ ] 如果 `token` 是 ERC-20（如 USDC）：
  - [ ] 调用合约 `transfer(to, amountWithDecimals)`
- [ ] `waitForTransactionReceipt`
- [ ] 返回 `{ txHash, status }`

### `getBalance(address: string, token: string, rpcUrl: string) → string`

- [ ] MON：`publicClient.getBalance({ address })`
- [ ] ERC-20：合约 `balanceOf(address)`

验收标准：

- [ ] 能从 session key 转 0.01 MON 到另一地址
- [ ] 能在 Monad 测试网浏览器查到交易

---

## 7. MPP 客户端封装（20 分钟）

文件：`src/mpp-client.ts`

### `createMppClient(config) → MppClient`

```ts
interface MppConfig {
  sessionKey: Account;
  rpcUrl: string;
  chainId: number;
  usdcContract?: string;  // 如果为空则用 MON 直转（fallback）
}
```

### `payWithMpp(client: MppClient, to: string, amount: string, reason: string) → { txHash, status }`

流程：

- [ ] 如果没有 USDC 合约地址，fallback 到直接转账模式（记录 warning）
- [ ] 构造 MPP `charge` intent
- [ ] 使用 `@monad-crypto/mpp/client` 的 `createCredential`
  - [ ] `mode: "push"`（客户端广播 ERC-20 transfer，MVP 最简单）
- [ ] 等待交易确认
- [ ] 返回 `{ txHash, status }`

### 代码骨架

```ts
import { Mppx } from 'mppx/client';
import { monad } from '@monad-crypto/mpp/client';

const mppx = Mppx.create({
  methods: [
    monad.charge({
      account: sessionKey,
      mode: 'push',
    }),
  ],
});

// 调用付费 API 时自动处理 402 → 签名 → 重试
```

验收标准：

- [ ] 能向一个返回 402 的测试服务端发起支付
- [ ] 支付成功后获得 `Payment-Receipt`

---

## 8. 支付编排器（15 分钟）

文件：`src/orchestrator.ts`

### `orchestratePayment(request: PaymentRequest, ctx: OrchestratorCtx) → AuditRecord`

这是 Agent 实际调用的核心函数。

流程：

- [ ] 加载 `Policy`
- [ ] 加载 `SessionKey`（没有则报错，提示先 `init`）
- [ ] 计算 `spentToday`
- [ ] 调用 `evaluatePolicy(request, policy, spentToday)`
- [ ] 如果 `policyResult.allowed === false`：
  - [ ] 构建 `AuditRecord`，`status: "rejected"`
  - [ ] 调用 `auditAppend(record)`
  - [ ] 返回被拒结果（含原因）
- [ ] 如果 `allowed === true`：
  - [ ] 根据 `request.mode` 选择执行器：
    - `"direct"` → `sendDirect(...)`
    - `"mpp"` → `payWithMpp(...)`
  - [ ] 如果交易成功：
    - [ ] 构建 `AuditRecord`，`status: "approved"`, 写入 `txHash`
  - [ ] 如果交易失败：
    - [ ] 构建 `AuditRecord`，`status: "failed"`, 写入错误信息
  - [ ] 调用 `auditAppend(record)`
  - [ ] 返回结果

### `OrchestratorCtx`

```ts
interface OrchestratorCtx {
  policyPath: string;
  sessionKeyPath: string;
  auditLogPath: string;
  rpcUrl: string;
  chainId: number;
  mainAddress: string;
}
```

验收标准：

- [ ] 策略拒绝时不发起链上交易
- [ ] 策略通过时正常执行
- [ ] 每笔都写入审计日志
- [ ] 返回结果包含足够信息让 Agent 回复用户

---

## 9. 审计日志（10 分钟）

文件：`src/audit.ts`

### `auditAppend(record: AuditRecord, logPath: string) → void`

- [ ] JSON Lines 格式，追加到文件末尾
- [ ] 确保目录存在

### `auditRead(logPath: string, limit?: number) → AuditRecord[]`

- [ ] 逐行读取解析
- [ ] 跳过空行和解析失败的行
- [ ] 按时间倒序
- [ ] 返回最近 N 条

### `auditFormat(records: AuditRecord[]) → string`

- [ ] 格式化为可读文本：

```
时间                    Agent              收款人       金额     原因                策略结果        状态
2026-04-12T10:30:00Z   claude-code-001    0xabc...    0.1 MON  deployment gas     all_passed      ✅ approved
2026-04-12T10:31:00Z   claude-code-001    0xdef...    2.0 MON  api call           exceeded_daily  ❌ rejected
```

验收标准：

- [ ] 写入后能正确读取
- [ ] 格式化输出清晰可读

---

## 10. CLI 入口（25 分钟）

文件：`src/cli.ts`

使用 `commander` 注册命令。

### `init`

- [ ] 生成 session key
- [ ] 从 `.env` 读取主私钥，派生主钱包地址
- [ ] 创建 `policies.json`（默认策略）
- [ ] 创建空 `audit.log`
- [ ] 输出：
  - 主钱包地址摘要
  - Session key 地址
  - 当前策略摘要
  - 提示："Agent 现在可以使用 pay() 了"

### `pay --mode <direct|mpp> --to <addr> --amount <amt> --token <tok> --reason <text> [--agent <id>]`

- [ ] 加载上下文（policy + session key + audit）
- [ ] 调用 `orchestratePayment`
- [ ] 输出结果：

成功：
```
✅ 支付已批准
  Agent: claude-code-001
  收款: 0xabc...1234
  金额: 0.1 MON
  原因: deployment gas
  交易: https://testnet.monadexplorer.com/tx/0x...
  已记录到审计日志
```

被拒：
```
❌ 支付被策略引擎拒绝
  原因: exceeded_daily_limit
  当前已花费: 0.8 / 1.0 MON
  请调整策略或等待次日重置
```

### `audit [--limit <n>]`

- [ ] 读取审计日志
- [ ] 格式化输出最近 N 条（默认 10）

### `revoke`

- [ ] 加载旧 session key
- [ ] 查询余额
- [ ] 若有余额，转回主钱包
- [ ] 生成新 session key
- [ ] 保存
- [ ] 输出新旧地址对比

### `balance`

- [ ] 查询主钱包余额
- [ ] 查询 session key 余额
- [ ] 输出两者

### `policy`

- [ ] 读取 `policies.json`
- [ ] 格式化输出当前策略

验收标准：

- [ ] `npx tsx src/cli.ts init` 能跑通
- [ ] `npx tsx src/cli.ts pay --mode direct --to 0x... --amount 0.01 --token MON --reason test` 能转账或拒绝
- [ ] `npx tsx src/cli.ts audit` 能查看日志

---

## 11. 配置文件示例（5 分钟）

### `policies.json`（由 init 命令自动生成）

```json
{
  "singleLimit": "0.5",
  "dailyLimit": "1.0",
  "allowedTokens": ["MON"],
  "whitelistAddresses": [],
  "sessionId": null
}
```

### `session.key.json`（由 init 命令生成，.gitignore）

```json
{
  "address": "0x...",
  "privateKey": "0x..."
}
```

---

## 12. 项目结构（最终）

```
monand-agentcostskill/
├── SKILL.md                    # AI Agent 技能描述
├── README.md                   # 人类可读文档
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── src/
│   ├── types.ts                # 类型定义
│   ├── policy.ts               # 策略引擎
│   ├── session-key.ts          # Session key 管理
│   ├── direct-transfer.ts      # 直接转账
│   ├── mpp-client.ts           # MPP 客户端
│   ├── orchestrator.ts         # 支付编排器
│   ├── audit.ts                # 审计日志
│   └── cli.ts                  # CLI 入口
├── data/                       # 运行时数据（不提交）
│   ├── policies.json
│   ├── session.key.json
│   └── audit.log
└── test/                       # 如果时间够
    └── policy.test.ts
```

---

## 13. README（8 分钟）

文件：`README.md`

内容：

- [ ] 一句话介绍
- [ ] 架构图
- [ ] 快速开始（3 步）
- [ ] 命令说明
- [ ] 策略配置说明
- [ ] 审计日志格式
- [ ] 三种支付模式对比（MPP / x402 / Direct）
- [ ] 安全注意事项
- [ ] 与 MonSkills 集成方式
- [ ] License（MIT）

---

## 14. 最终验收

当以下 7 项都能跑通，MVP 算完成：

- [ ] `init` 生成 session key + policies + audit.log，输出主钱包和 session key 地址
- [ ] `pay --mode direct` 能发起一笔测试网转账（策略通过后）
- [ ] `pay --mode direct` 能拒绝一笔超额请求，输出明确原因
- [ ] `audit` 能查看完整记录（含 Agent、原因、策略结果、txHash）
- [ ] `revoke` 能轮换 session key，旧 key 余额转回主钱包
- [ ] `balance` 能查两个钱包余额
- [ ] `policy` 能查看当前策略配置

---

## 时间分配总览

| 阶段 | 预估 |
|---|---|
| 项目初始化 | 10 min |
| SKILL.md | 10 min |
| 类型定义 | 5 min |
| 策略引擎 | 20 min |
| Session Key 管理 | 15 min |
| 直接转账 | 10 min |
| MPP 客户端 | 20 min |
| 支付编排器 | 15 min |
| 审计日志 | 10 min |
| CLI 入口 | 25 min |
| 配置文件 | 5 min |
| README | 8 min |
| **总计** | **~153 min** |

> 超过 2 小时，但 MPP 客户端和编排器可以并行开发（如果有多人）。单人情况下可删减 MPP 部分，先只做 direct 模式。

---

## 可删减项（如果时间不够）

按优先级从高到低：

1. ~~`balance` 命令~~（5 min，可跳过）
2. ~~`policy` 命令~~（2 min，直接 cat policies.json 即可）
3. ~~MPP 客户端完整实现~~（20 min，MVP 只做 direct 模式）
4. ~~ERC-20 转账支持~~（只转 MON，ERC-20 后加）
5. ~~test/ 目录~~（MVP 手动测试即可）

### 最小可演示版本（~115 min）

只需要：

1. `init` → 生成 session key + 策略
2. `pay --mode direct`（成功）→ 转账
3. `pay --mode direct`（被拒）→ 超额拒绝
4. `audit` → 查看两条记录
5. `revoke` → 轮换 key

---

## 与你提供的三个资源的集成关系

| 资源 | 集成方式 |
|---|---|
| **MonSkills** | SKILL.md 放在仓库根目录，遵循 MonSkills 规范，Agent 通过 `npx skills add` 安装 |
| **MPP** | `src/mpp-client.ts` 使用 `@monad-crypto/mpp` + `mppx`，支持 push/pull 模式 |
| **x402** | MVP 不做完整封装，但 `orchestrator.ts` 预留了 `mode: "x402"` 的扩展点 |
