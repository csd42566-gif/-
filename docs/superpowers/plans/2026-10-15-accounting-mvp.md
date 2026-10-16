# 记账 App 第一版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 创建一个可在 Android 上运行的模块化记账 MVP，覆盖快速记账、预算/目标、欠账现金流、风险设置和独立日志。

**Architecture:** 使用 Expo React Native + TypeScript。纯业务计算与模型不依赖 React；数据访问由仓储接口隔离；页面只通过 feature hooks/use cases 访问数据；外部银行、通知、Root 由 integration ports/adapters 占位。

**Tech Stack:** Expo, React Native, TypeScript, Expo Router, AsyncStorage, Jest/ts-jest。

**Spec:** `docs/superpowers/specs/2026-10-15-accounting-mvp-design.md`

## Global Constraints

- 记账、欠账、目标、现金流、日志必须分模块；
- Root/银行/通知不是核心账本依赖；
- 默认风险卡片为“仅风险时显示”；
- 默认记账提醒为 B 平衡提醒；
- 主题色使用 token，不把颜色散落在业务模块；
- 日志必须做脱敏；
- 没有 Java/Gradle 时也必须能通过 TypeScript 单元测试验证核心逻辑。

### Task 1: 创建工程骨架和模块边界

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `babel.config.js`, `app/_layout.tsx`, `app/index.tsx`
- Create: `src/core/model/*`, `src/core/result/*`, `src/core/logging/*`
- Create: `src/data/*`, `src/features/*`, `src/integrations/*`

- [x] 写最小工程配置和目录；
- [x] 运行 TypeScript 检查确认骨架可解析；
- [x] 记录模块依赖规则。

### Task 2: 核心财务模型与计算

**Files:**
- Create: `src/core/model/finance.ts`
- Create: `src/core/finance/calculations.ts`
- Test: `src/core/finance/calculations.test.ts`

- [x] 先写每日可花、目标日存、现金流缺口的失败测试；
- [x] 实现纯函数；
- [x] 覆盖边界：零天数、负缺口、目标已完成、转账不算支出。

### Task 3: 日志模块和本地仓储

**Files:**
- Create: `src/core/logging/logger.ts`, `src/core/logging/redaction.ts`
- Create: `src/data/storage.ts`, `src/data/repository.ts`
- Test: `src/core/logging/redaction.test.ts`

- [x] 先测试 token、卡号和通知文本脱敏；
- [x] 实现内存/AsyncStorage 可替换仓储；
- [x] 为应用启动时的 demo 数据提供 seed。

### Task 4: UI 主题、导航和首页

**Files:**
- Create: `src/ui/theme.ts`, `src/ui/components/*`
- Create: `src/features/home/HomeScreen.tsx`
- Modify: `app/index.tsx`

- [x] 使用中性灰 token；
- [x] 实现今日可花、本月还需存、未来待还、风险卡片；
- [x] 加入风险显示模式开关读取。

### Task 5: 账本与快速记账弹窗

**Files:**
- Create: `src/features/ledger/*`
- Modify: `app/index.tsx`
- Test: `src/features/ledger/ledger.test.ts`

- [x] 先测试支出写入、余额更新和弹窗摘要；
- [x] 实现 B 平衡提醒；
- [x] 记账后刷新首页计算；
- [x] 加入点击缩放、波纹、弹层上滑等轻动效，并尊重 reduced motion。

### Task 6: 待还、目标、我的和日志页面

**Files:**
- Create: `src/features/debts/*`, `src/features/goals/*`, `src/features/settings/*`
- Modify: `app/index.tsx`

- [x] 展示现金流预测和欠账时间线；
- [x] 展示目标进度与少花/多赚/延期方案；
- [x] 提供风险卡片模式切换；
- [x] 提供 Root/银行/云同步状态占位和诊断日志查看。

### Task 7: 集成适配器和验证

**Files:**
- Create: `src/integrations/ports.ts`, `src/integrations/stubs.ts`
- Create: `README.md`
- Test: `src/**/*.test.ts`

- [x] 明确银行、支付通知、Root bridge 的接口；
- [x] 运行单元测试；
- [x] 运行 TypeScript 检查；
- [x] 运行 Expo 启动检查；
- [x] 若本机无 Android SDK，明确记录未完成的 APK 构建验证。

