# Agent Cost Skill — 使用说明

当你（Agent）需要花钱时，**不要直接操作钱包**，使用以下命令：

## 发起支付

```bash
cd monand-agentcostskill && npx tsx src/cli.ts pay \
  --mode direct \
  --to <收款地址> \
  --amount <金额> \
  --token <MON或USDC> \
  --reason "<为什么花钱，必须填写>" \
  --agent <你的名称>
```

**示例：**
```bash
cd monand-agentcostskill && npx tsx src/cli.ts pay \
  --mode direct \
  --to 0xaF292eEdC0e22A2Ed1b5A304AB7073fb8bdF34ED \
  --amount 0.1 \
  --token MON \
  --reason "Monad 测试网合约部署 gas 费" \
  --agent claude-code
```

## 查看余额

```bash
cd monand-agentcostskill && npx tsx src/cli.ts balance
```

## 查看策略（确认限额）

```bash
cd monand-agentcostskill && npx tsx src/cli.ts policy
```

## 查看支付历史

```bash
cd monand-agentcostskill && npx tsx src/cli.ts audit
```

## 重要规则

1. **每次支付必须写 reason** — 说明为什么花钱
2. **amount 用字符串** — `"0.1"` 不要写 `0.1`
3. **被拒绝不要重试** — 如果策略引擎拒绝，告诉用户，不要循环重试
4. **绝对不要读取 `data/session.key.json` 的 privateKey 字段**
5. **用 `--mode direct`** — 当前可用。`x402` 需要 USDC 余额才可用
6. **测试网** — 所有操作都在 Monad 测试网（chainId 10143）

## 输出示例

### 成功
```
✅ 支付已批准
   交易: https://testnet.monadexplorer.com/tx/0x...
```

### 被拒绝
```
❌ 支付被策略引擎拒绝
   原因: Amount 2 exceeds single limit 0.5
```
→ 不要重试，告知用户

### 余额不足
```
⚠️ 支付执行失败
   错误: Signer had insufficient balance
```
→ 告知用户需要给 Session Key 充值
