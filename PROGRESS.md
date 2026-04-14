# Agent Cost Skill — 优化进度跟踪

> 最后更新：2026-04-14 | 当前版本：0.2.0-dev

---

## ✅ 已完成 (Phase 1-3)

### Phase 1: Web Dashboard + 基础测试 ✅
| # | 任务 | 状态 | 相关文件 |
|---|---|---|---|
| 1.1 | React + Vite 前端项目搭建 | ✅ | `web/` |
| 1.2 | Dashboard 首页（统计卡片、预算进度条） | ✅ | `web/src/Dashboard.tsx` |
| 1.3 | 交易历史表格（彩色表格、交易链接） | ✅ | `web/src/components/AuditTable.tsx` |
| 1.4 | 策略配置展示 | ✅ | `web/src/components/DashboardCards.tsx` |
| 1.5 | x402 协议展示（6 步流程、部署指南、USDC 价格） | ✅ | `web/src/components/X402Guide.tsx` |
| 1.6 | 标签页导航（5 个标签） | ✅ | `web/src/Dashboard.tsx` |
| 1.7 | 数据文件导入（audit.log / policies.json / session.key.json / notifications.log） | ✅ | `web/src/Dashboard.tsx` |
| 1.8 | GitHub Actions 自动部署 | ✅ | `.github/workflows/deploy-pages.yml` |

### Phase 2: 测试全覆盖 + CLI 美化 ✅
| # | 任务 | 状态 | 相关文件 |
|---|---|---|---|
| 2.1 | Vitest 测试框架 | ✅ | `vitest.config.ts` |
| 2.2 | Policy Engine 测试 (18 用例) | ✅ | `test/policy.test.ts` |
| 2.3 | Audit Logger 测试 (10 用例) | ✅ | `test/audit.test.ts` |
| 2.4 | Session Key 测试 (7 用例) | ✅ | `test/session-key.test.ts` |
| 2.5 | x402 协议测试 (11 用例) | ✅ | `test/x402.test.ts` |
| 2.6 | CLI 输出美化（chalk + cli-table3） | ✅ | `src/fmt.ts` |
| 2.7 | CHANGELOG.md | ✅ | `CHANGELOG.md` |

### Phase 3: 通知 + 策略扩展 + Web 集成 ✅
| # | 任务 | 状态 | 相关文件 |
|---|---|---|---|
| 3.1 | Discord Webhook 通知机制 | ✅ | `src/notifier.ts` |
| 3.2 | 时间窗口限制策略 | ✅ | `src/policy.ts` |
| 3.3 | 频率限制策略 | ✅ | `src/policy.ts` |
| 3.4 | Agent 分级限额策略 | ✅ | `src/policy.ts` |
| 3.5 | 每日预算报告生成 | ✅ | `src/notifier.ts` |
| 3.6 | 通知日志（data/notifications.log） | ✅ | `src/notifier.ts` |
| 3.7 | Orchestrator 集成通知 | ✅ | `src/orchestrator.ts` |
| 3.8 | CLI 新命令：report / notifications | ✅ | `src/cli.ts` |
| 3.9 | Web: 通知 & 报告页面 | ✅ | `web/src/components/NotificationsPanel.tsx` |
| 3.10 | Web: 策略配置展示新规则 | ✅ | `web/src/components/DashboardCards.tsx` |
| 3.11 | Phase 3 测试 (14 用例) | ✅ | `test/policy-v3.test.ts` |

### 测试统计
```
✅ 总计 60 个测试用例，全部通过
   - Policy Engine: 18 tests
   - Audit Logger: 10 tests
   - Session Key: 7 tests
   - x402 Protocol: 11 tests
   - Phase 3 (新策略/通知): 14 tests
```

---

## 📋 待完成 (Phase 4-6)

### Phase 4: 发布与生态 🔴 推荐下一步
| # | 任务 | 状态 | 工作量 | 说明 |
|---|---|---|---|---|
| 4.1 | npm 发布 | ⏳ | 1h | `npm publish`，配置 package.json |
| 4.2 | SDK 导出 | ⏳ | 2h | 导出 `PolicyEngine`、`Orchestrator`、`SessionKeyManager` 为可导入 SDK |
| 4.3 | TypeDoc 文档 | ⏳ | 1h | `npx typedoc src/` 自动生成 API 参考 |
| 4.4 | MonSkills Registry | ⏳ | 1h | 提交到官方技能列表 |
| 4.5 | 快速上手教程 | ⏳ | 3h | Step-by-step 文档 + 3 分钟演示视频 |

### Phase 5: CLI 体验增强 🟡
| # | 任务 | 状态 | 工作量 | 说明 |
|---|---|---|---|---|
| 5.1 | 交互式支付引导 | ⏳ | 2h | `pay -i` 逐步询问参数（使用 `prompts`） |
| 5.2 | 批量支付 | ⏳ | 2h | `pay-batch --file payments.json` |
| 5.3 | 策略热更新 | ⏳ | 1h | 不重启进程自动读取新策略 |
| 5.4 | Shell 自动补全 | ⏳ | 1h | bash/zsh/fish completion 脚本 |

### Phase 6: 生产级监控 🔵
| # | 任务 | 状态 | 工作量 | 说明 |
|---|---|---|---|---|
| 6.1 | Prometheus Metrics | ⏳ | 2h | 导出 `/metrics` 端点 |
| 6.2 | Grafana 面板 | ⏳ | 2h | 可视化支付率/拒绝率等 |
| 6.3 | 链上策略合约 | ⏳ | 1-2天 | 将限额/白名单写入 Monad 智能合约 |
| 6.4 | 对账机制 | ⏳ | 2h | 链上交易与 audit.log 对比 |

---

## 🗂️ 项目结构速览

```
E:\monad\monad-agentcostskill\
├── src/
│   ├── cli.ts              # CLI 入口（所有命令）
│   ├── orchestrator.ts     # 支付编排（集成通知）
│   ├── policy.ts           # 策略引擎（7 条规则）
│   ├── notifier.ts         # 通知系统（Discord + 日志 + 报告）
│   ├── fmt.ts              # CLI 格式化（chalk + cli-table3）
│   ├── audit.ts            # 审计日志
│   ├── session-key.ts      # Session Key 管理
│   ├── direct-transfer.ts  # 直接转账
│   ├── mpp-client.ts       # MPP 支付
│   ├── x402-client.ts      # x402 微支付
│   └── types.ts            # 类型定义
├── web/                    # React Dashboard
│   ├── src/
│   │   ├── Dashboard.tsx              # 主页面（5 个标签）
│   │   ├── components/
│   │   │   ├── DashboardCards.tsx     # 统计卡片 + 进度条 + 策略
│   │   │   ├── AuditTable.tsx         # 交易历史表格
│   │   │   ├── X402Guide.tsx          # x402 部署指南
│   │   │   └── NotificationsPanel.tsx # 通知 & 预算报告
│   │   ├── types.ts                   # 前端类型
│   │   └── utils.ts                   # 工具函数
│   └── vite.config.ts
├── test/
│   ├── policy.test.ts      # Policy Engine (18 tests)
│   ├── audit.test.ts       # Audit (10 tests)
│   ├── session-key.test.ts # Session Key (7 tests)
│   ├── x402.test.ts        # x402 Protocol (11 tests)
│   └── policy-v3.test.ts   # Phase 3 新策略 (14 tests)
├── data/                   # 运行时数据（gitignore）
│   ├── policies.json
│   ├── session.key.json
│   ├── audit.log
│   └── notifications.log
└── .github/workflows/
    └── deploy-pages.yml    # 自动部署 GitHub Pages
```

---

## 🚀 快速启动命令

```bash
# 后端
npm run dev -- init          # 初始化
npm run dev -- pay ...       # 支付
npm run dev -- audit         # 审计日志
npm run dev -- report        # 每日报告
npm run dev -- notifications # 通知历史
npm test                     # 运行 60 个测试

# 前端
cd web && npm run dev        # http://localhost:5173
cd web && npm run build      # 构建产物 -> dist/
```

---

## ⚠️ 注意事项

1. **旧数据兼容**：旧的 `policies.json` 不含 `timeWindow`、`rateLimit`、`agentTiers`，Web 侧已做兼容处理
2. **Node 版本**：需要 Node 20.18+（Vite 5 兼容）
3. **环境变量**：`DISCORD_WEBHOOK_URL` 用于 Discord 通知（可选）
4. **x402 测试服务**：`test/x402-test-server-real.ts` 需要 Facilitator 可用

---

## 📌 下次接手建议

1. 从 **Phase 4.1**（npm 发布）开始
2. 确认 `npm test` 全部通过后再提交
3. Web 前端任何改动后运行 `cd web && npm run build` 验证
