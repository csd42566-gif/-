# 代还导入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在代还页面支持抖音、支付宝、微信、得物、京东等平台的文本导入，并把解析结果安全地放入待确认代还队列。

**Architecture:** 新增纯函数解析层和导入业务层，解析层不依赖 React 或存储；界面层只负责选择平台、输入文本和展示结果；应用状态继续由 `app/index.tsx` 统一保存，确认入账复用现有 `reviewDetectedTransaction`。

**Tech Stack:** React Native、TypeScript、Jest、Expo Router。

**Spec:** `docs/superpowers/specs/2026-10-17-repayment-import-design.md`

## Global Constraints

- 不新增第三方依赖。
- 不读取其他 App 私有数据库，不自动发起还款。
- 不绕过待确认流程直接记账。
- 单文件不超过 400 行，单函数不超过 50 行。
- 代码注释使用中文，标识符使用英文。

### Task 1: 平台文本解析器

**Files:**
- Create: `src/features/repayment-import/parsers.ts`
- Test: `src/features/repayment-import/parsers.test.ts`

**Interfaces:**
- Produces `parseRepaymentText(provider: RepaymentProvider, text: string, importedAt?: string): RepaymentParseResult`。
- `RepaymentProvider` 为 `douyin | alipay | wechat | dew | jd | other`。
- 成功结果包含 `amount`、`occurredAt`、`counterparty?`、`note`、`confidence`、`provider`。

- [ ] **Step 1: 写失败测试**

为每个平台写一个包含还款语义、金额和时间的文本用例，断言平台、金额、时间和 `proxy-repayment` 语义；增加普通消费、缺金额和重复金额格式的失败用例。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --runTestsByPath src/features/repayment-import/parsers.test.ts`

Expected: FAIL，因为解析模块尚不存在。

- [ ] **Step 3: 写最小实现**

实现金额、时间、代还对象和还款语义提取；平台名称只影响置信度和摘要，不为每个平台复制整套解析流程。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --runTestsByPath src/features/repayment-import/parsers.test.ts`

Expected: PASS。

### Task 2: 导入业务与去重

**Files:**
- Create: `src/features/repayment-import/repaymentImport.ts`
- Test: `src/features/repayment-import/repaymentImport.test.ts`
- Modify: `src/core/model/finance.ts`

**Interfaces:**
- Produces `importRepaymentText(state: LedgerState, provider: RepaymentProvider, text: string, importedAt?: string): ImportRepaymentResult`。
- 成功返回新的 `LedgerState`、标准化候选和 `duplicate: false`；重复返回原状态和 `duplicate: true`。

- [ ] **Step 1: 写失败测试**

断言成功导入生成 `source: 'import'`、`eventKind: 'proxy-repayment'`、`eventStatus: 'success'` 的待确认记录；断言重复内容不新增；断言解析失败不改变状态。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --runTestsByPath src/features/repayment-import/repaymentImport.test.ts`

Expected: FAIL，因为导入业务模块尚不存在。

- [ ] **Step 3: 写最小实现**

调用解析器，生成稳定 ID 和通知兼容的 `PendingTransaction`，复用 `queueDetectedTransaction` 做去重；错误使用明确的业务错误码。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --runTestsByPath src/features/repayment-import/repaymentImport.test.ts`

Expected: PASS。

### Task 3: 代还导入界面

**Files:**
- Create: `src/features/repayment-import/RepaymentImportSheet.tsx`
- Modify: `src/features/debts/DebtsScreen.tsx`

**Interfaces:**
- `RepaymentImportSheet` 接收 `visible`、`onClose`、`onImport` 和 `reducedMotion`。
- 界面只回调导入请求，不直接修改 `LedgerState`。

- [ ] **Step 1: 增加界面行为测试可验证的纯回调边界**

复用业务层测试保证界面提交所需的数据契约；不引入新的 UI 测试依赖。

- [ ] **Step 2: 实现入口和弹窗**

在“还款时间线”标题附近增加“导入代还”按钮；弹窗提供平台选择、文本输入、解析预览、错误提示、导入和取消按钮；成功后关闭弹窗并显示导入成功或重复提示。

- [ ] **Step 3: 保持交互约束**

输入为空或解析失败时禁用导入；导入按钮使用现有 Pressable 动效和 reduced-motion 设置；界面不展示原始敏感文本到日志。

- [ ] **Step 4: 运行类型检查**

Run: `npm run typecheck`

Expected: PASS。

### Task 4: 应用状态接入与回归验证

**Files:**
- Modify: `app/index.tsx`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 接入状态回调**

在 `DebtsScreen` 所需 props 中注入导入处理函数，调用 `importRepaymentText` 后通过现有 `setState` 和 `saveState` 持久化。

- [ ] **Step 2: 验证待确认流程**

确认导入记录能在账本页出现，选择账户和欠款后复用 `reviewDetectedTransaction` 入账；导入失败和重复导入均不改变账户余额。

- [ ] **Step 3: 更新变更记录**

在 `CHANGELOG.md` 的当前版本补充代还文本导入、平台来源和去重行为。

- [ ] **Step 4: 运行全量验证**

Run: `npm test -- --runInBand`

Run: `npm run typecheck`

Run: `./gradlew.bat assembleRelease` from `android/`

Expected: 三项均通过；不宣称真机测试已通过。

