# Agent Cost Skill — 优化方向与 roadmap

> 本文档列出项目当前状态的优化方向，按优先级和实施难度排序，供后续迭代参考。

---

## 一、🌐 Web 展示页面（GitHub Pages）

### 目标
提供一个可视化的 Web Dashboard，让用户无需命令行即可查看支付历史、策略配置和钱包状态。

### 方案

#### 1.1 技术栈推荐
| 选项 | 优点 | 缺点 |
|---|---|---|
| **React + Vite + GitHub Pages**（推荐） | 轻量、免费托管、构建简单 | 仅静态页面，需配合 API 实现实时数据 |
| Next.js + Vercel | SSR、API Routes 一体化 | 需要额外部署 |
| 纯 HTML/CSS/JS | 最简单 | 可维护性差 |

#### 1.2 页面功能设计
| 页面 | 内容 |
|---|---|
| **Dashboard（首页）** | 总览卡片：Session Key 余额、今日已用预算、剩余预算、最近 5 笔交易 |
| **交易历史** | 表格展示 `audit.log` 全部记录，支持按 Agent、时间、状态筛选 |
| **策略配置** | 可视化展示当前策略：单笔限额、日限额进度条、白名单列表、允许的 Token |
| **Session Key 管理** | 显示当前 Session Key 地址、创建时间、撤销按钮（需连接主钱包签名） |

#### 1.3 数据获取方案
由于 GitHub Pages 仅支持静态页面，有以下几种方案：

| 方案 | 说明 | 复杂度 |
|---|---|---|
| **构建时嵌入数据** | CI 构建时读取 `data/` 目录文件，生成静态 HTML | ⭐ 最简单 |
| **用户本地导入** | 用户拖拽 `audit.log` 和 `policies.json` 到页面即可查看 | ⭐⭐ 简单 |
| **搭配后端 API** | 部署一个轻量后端（Cloudflare Workers / Supabase Edge Functions）读取链上数据 | ⭐⭐⭐ 中等 |
| **直接读取链上** | 通过 viem + Monad RPC 在浏览器端读取交易历史 | ⭐⭐⭐ 中等 |

#### 1.4 GitHub Actions CI/CD 示例
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build:web  # 构建前端
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist-web
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
```

### 优先级：🔴 高 — 提升项目展示度和用户体验

---

## 二、🧪 测试覆盖增强

### 现状
`test/` 目录存在多个测试文件，但多为手动测试脚本（`test-*.ts`），缺乏自动化测试套件。

### 优化方向

#### 2.1 引入测试框架
```bash
npm install --save-dev vitest
# 或
npm install --save-dev jest ts-jest @types/jest
```

#### 2.2 应覆盖的测试用例
| 模块 | 测试内容 |
|---|---|
| **Policy Engine** | 单笔限额通过/拒绝、日上限通过/拒绝、白名单通过/拒绝、Token 白名单通过/拒绝 |
| **Direct Transfer** | 正常转账、余额不足、无效地址 |
| **MPP Client** | 正常调用、超时、错误码处理 |
| **X402 Client** | 资源获取、签名验证、错误处理 |
| **Session Key** | 生成、加载、撤销后旧 key 失效 |
| **Orchestrator** | 端到端支付流程（mock 链交互） |
| **Audit Logger** | 日志写入、读取、格式化 |

#### 2.3 Mock 策略
- 使用 `viem` 的 test accounts mock 签名
- Mock RPC 调用，不依赖真实测试网
- 设置 CI 每次 PR 自动跑测试

### 优先级：🔴 高 — 提升代码质量和可维护性

---

## 三、📦 CLI 体验优化

### 3.1 交互式引导
当前 CLI 需要手动输入所有参数，可增加交互式引导：

```bash
npx tsx src/cli.ts pay --interactive
# 或简写
npx tsx src/cli.ts pay -i
```

逐步询问：
1. 支付模式（direct/mpp/x402）
2. 收款地址 / URL
3. 金额和 Token
4. 支付原因

可使用 `prompts` 或 `inquirer` 库实现。

### 3.2 命令别名和自动补全
- 添加 shell completion 脚本（bash/zsh/fish）
- 常用命令别名：`npx tsx src/cli.ts log` = `audit`

### 3.3 输出美化
引入 `chalk` 或 `cli-color`：
- ✅ 成功绿色、❌ 拒绝红色、⚠️ 警告黄色
- 表格化展示审计日志（使用 `cli-table3`）
- 交易链接终端可点击（ANSI hyperlink）

### 3.4 批量支付
```bash
npx tsx src/cli.ts pay-batch --file payments.json
```

`payments.json` 格式：
```json
[
  { "to": "0x...", "amount": "0.1", "token": "MON", "reason": "gas" },
  { "to": "0x...", "amount": "0.05", "token": "MON", "reason": "api call" }
]
```

### 优先级：🟡 中 — 提升日常使用体验

---

## 四、🔐 安全增强

### 4.1 Session Key 多签支持
当前 Session Key 是单签名，可增加：
- 需要主钱包签名确认超过一定金额的支付
- 多 Session Key 轮换机制

### 4.2 策略引擎规则扩展
| 新规则 | 说明 |
|---|---|
| **时间窗口限制** | 仅允许特定时间段支付（如工作时间 9:00-18:00） |
| **频率限制** | 每分钟最多 N 笔支付 |
| **收款地址类型** | 限制只能转给合约或只能转给 EOA |
| **Token 限额分离** | MON 和 USDC 分别计算限额 |
| **Agent 分级** | 不同 Agent ID 拥有不同限额 |

### 4.3 通知机制
- 每笔支付后发送通知（Discord Webhook、Telegram Bot、邮件）
- 超限支付尝试即时告警
- 每日预算汇总报告

### 4.4 `.env` 密钥轮换
- 支持多 Session Key 并存，自动选择未过期的
- 增加 Session Key 过期时间字段

### 优先级：🟡 中 — 提升生产就绪程度

---

## 五、📊 可观测性与监控

### 5.1 结构化日志
当前 `audit.log` 使用 JSON Lines，很好。可扩展：

| 文件 | 内容 |
|---|---|
| `data/audit.log` | 支付记录（已有） |
| `data/policy-decisions.log` | 每次策略判断的详细原因 |
| `data/errors.log` | 所有失败记录及错误栈 |

### 5.2 指标导出
- 导出 Prometheus 格式的 metrics（支付成功率、平均金额、拒绝率）
- 对接 Grafana 面板

### 5.3 链上事件监听
- 监听 Session Key 地址的交易事件
- 与本地 `audit.log` 对账，检测不一致

### 优先级：🟢 低 — 适合大规模使用后考虑

---

## 六、🔗 链上合约集成

### 6.1 部署策略合约
当前策略引擎在链下执行，可部署链上策略合约：
- 将限额、白名单写入合约
- Session Key 的授权和撤销通过合约管理
- 实现真正的链上可验证策略

### 6.2 Gas 优化
- 批量支付合并为单笔交易
- 使用 Monad 的 gas 优化特性

### 6.3 支持更多 Token
- 集成 Monad 测试网上的 ERC-20 标准 Token
- 支持 USDC 支付的完整流程（当前 x402 模式标注为需要 USDC）

### 优先级：🟢 低 — 属于功能扩展

---

## 七、📖 文档与开发者体验

### 7.1 API 文档
- 为每个导出函数生成 TypeDoc 文档
- 提供 OpenAPI spec（如果后续加后端）

### 7.2 快速上手教程
- 录制 3 分钟演示视频
- 写一份"从零到第一笔支付"的 step-by-step 教程

### 7.3 示例项目
- 提供一个示例 Agent 集成（如 Claude Code 插件、OpenClaw 插件）
- 提供 Docker Compose 一键本地体验

### 7.4 CHANGELOG
- 维护 `CHANGELOG.md`，记录每个版本的变更

### 优先级：🟡 中 — 提升项目传播度

---

## 八、🚀 发布与打包

### 8.1 发布到 npm
```bash
npm publish
```
让其他项目可以通过 `npm install agent-cost-skill` 使用。

### 8.2 二进制打包
使用 `pkg` 或 `nexe` 打包为可执行文件，用户无需安装 Node.js：
```bash
npx pkg . --targets node18-linux-x64,node18-macos-arm64,node18-win-x64
```

### 8.3 SDK 导出
将核心逻辑（Policy Engine、Orchestrator、Session Key）导出为 SDK：
```typescript
import { PolicyEngine, Orchestrator } from 'agent-cost-skill';

const engine = new PolicyEngine(config);
const result = await engine.check({ amount: '0.1', token: 'MON' });
```

### 优先级：🟡 中 — 提升项目可用性

---

## 九、🧩 MonSkills 规范深度集成

### 9.1 完善 SKILL.md
- 添加更多调用示例和边界情况说明
- 添加常见错误及处理方法

### 9.2 发布到 MonSkills Registry
- 提交到官方的 MonSkills 列表
- 让其他 Agent 可以直接安装使用

### 优先级：🟡 中 — 提升生态兼容性

---

## 十、🎯 建议实施顺序

| 阶段 | 内容 | 预计收益 | 状态 |
|---|---|---|---|
| **Phase 1** | GitHub Pages 展示页面 + 基础测试框架 + x402 展示 | 展示度 ↑、质量 ↑ | ✅ 已完成 |
| **Phase 2** | CLI 美化与交互 + 测试全覆盖 + CHANGELOG | 体验 ↑、信心 ↑ | ✅ 已完成 |
| **Phase 3** | 通知机制 + 策略规则扩展 | 安全 ↑、灵活度 ↑ | 待实施 |
| **Phase 4** | npm 发布 + SDK 导出 + 文档完善 | 传播度 ↑、兼容性 ↑ | 待实施 |
| **Phase 5** | 链上策略合约 + 监控 | 生产就绪 | 待实施 |

---

## 快速行动项（本周可做）

- [x] 创建 `web/` 目录，搭建 React + Vite 项目
- [x] 配置 GitHub Actions 自动部署到 GitHub Pages
- [x] 安装 Vitest，为 Policy Engine 写 5 个核心测试用例
- [x] 引入 `chalk` 美化 CLI 输出
- [x] 编写 CHANGELOG.md
- [x] 录制一个 3 分钟项目演示视频
- [x] 添加 x402 协议测试和 Web 展示
- [x] 完善 README 文档
