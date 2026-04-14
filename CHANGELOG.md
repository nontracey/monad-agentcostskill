# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### ✨ Added
- **Web Dashboard** — React + Vite 可视化面板，支持交易历史、策略配置、Session Key 展示
- **x402 协议支持** — 完整的 x402 微支付协议测试、文档和 Web 展示
  - x402 测试服务快速部署指南（`test/x402-test-server-real.ts`）
  - Web Dashboard 新增 x402 协议标签页，展示工作原理、部署步骤、USDC 价格配置
  - 11 个 x402 测试用例（PaymentRequirements 构造、Header 编解码、完整流程模拟）
- **GitHub Pages 自动部署** — 推送 `main` 分支自动构建并部署 Dashboard
- **46 个单元测试** — 覆盖 Policy Engine、Audit Logger、Session Key、x402 协议
- **CLI 输出美化** — 引入 `chalk` + `cli-table3`，彩色终端输出 + 表格化审计日志
- **CHANGELOG.md** — 项目变更日志
- **USDC 金额格式化** — Web 面板自动识别 USDC 最小单位并转换为人类可读格式
- **支付模式分布统计** — Dashboard 显示 direct/mpp/x402 各模式交易数量
- **标签页导航** — Dashboard 新增 总览 / x402 协议 / 交易历史 / 策略配置 四个标签

### 🔧 Changed
- 审计日志表格展示从纯文本升级为彩色表格（`cli-table3`）
- 交易链接支持终端内可点击链接（ANSI hyperlink）
- 所有 CLI 命令输出统一图标和颜色体系

### 🧪 Testing
- 新增 `vitest` 测试框架
- Policy Engine: 18 个测试用例（Token 限制、单笔限额、日上限、白名单等）
- Audit: 10 个测试用例（读写、格式化、倒序、limit 等）
- Session Key: 7 个测试用例（生成、保存、加载、撤销等）

### 📦 Dependencies
- 新增 `chalk`、`cli-table3`（运行时）
- 新增 `vitest`（开发时）
