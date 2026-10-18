# 还款与代还通知识别 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Android 首版中识别平台还款与替他人还款通知，并通过待确认流程安全更新账户和欠款。

**Architecture:** Kotlin 通知服务负责来源白名单、金额抽取和轻量分类，只暂存最小事件。TypeScript 负责事件归一化、候选去重、欠款匹配和确认入账；页面只展示候选并调用领域用例，不直接修改存储。

**Tech Stack:** Expo 52、React Native、TypeScript、Jest、Kotlin `NotificationListenerService`、Android SharedPreferences。

**Spec:** `docs/superpowers/specs/2026-10-17-repayment-detection.md`

## Global Constraints

- 识别结果必须先进入待确认队列，确认前不修改账户余额、交易或欠款。
- 不申请 `READ_SMS` / `RECEIVE_SMS`，不读取其他 App 私有数据，不保存原始通知正文。
- 现有旧账本数据必须可继续读取；新增字段必须可选并由归一化逻辑提供默认值。
- Android 原生层和 TypeScript 领域层保持隔离，页面不直接解析通知文本。

---

### Task 1: Extend the financial event model

**Files:**
- Modify: `src/core/model/finance.ts`
- Modify: `src/data/normalize.ts`
- Test: `src/data/normalize.test.ts`

**Interfaces:**
- Produces `DetectedEventKind`, `DetectedEventStatus` and optional fields on `PendingTransaction`/`Transaction`.
- Produces migration behavior where missing event fields remain valid.

- [ ] **Step 1: Write the failing migration test**

Add a legacy pending candidate without event fields and assert normalization preserves it while the new fields remain absent or defaulted safely.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run `npm test -- --runInBand src/data/normalize.test.ts`.
Expected: the new assertion fails because the event fields do not exist in the model/normalizer.

- [ ] **Step 3: Add the event unions and optional model fields**

Add `eventKind`, `eventStatus`, `provider`, `debtId`, and `counterparty` as optional fields. Keep existing transaction types unchanged.

- [ ] **Step 4: Normalize bounded string fields**

Accept only known event/status values and trim strings to a bounded length; discard invalid optional values instead of throwing.

- [ ] **Step 5: Run the focused test and the existing model tests**

Run `npm test -- --runInBand src/data/normalize.test.ts src/data/initialState.test.ts`.
Expected: all tests pass.

### Task 2: Add pure repayment classification

**Files:**
- Create: `src/integrations/notifications/classifier.ts`
- Test: `src/integrations/notifications/classifier.test.ts`

**Interfaces:**
- Consumes a provider name and sanitized notification title/summary from the native boundary.
- Produces `{ kind, status, type, category, provider, counterparty?, confidence }` or `null`.

- [ ] **Step 1: Write failing classification tests**

Cover successful platform repayment, proxy repayment, repayment reminder, failed repayment, ordinary payment, ambiguous amount and raw-text rejection.

- [ ] **Step 2: Run the classifier test and confirm it fails**

Run `npm test -- --runInBand src/integrations/notifications/classifier.test.ts`.
Expected: module/function missing.

- [ ] **Step 3: Implement ordered keyword rules**

Check failure/reminder before success, then proxy repayment before ordinary repayment, then ordinary payment. Extract only a short counterparty hint from explicit `替/代/帮` phrases.

- [ ] **Step 4: Run classifier tests and refactor only after green**

Run the focused test again and require all cases to pass.

### Task 3: Integrate native notification events

**Files:**
- Modify: `android/app/src/main/java/com/strictledger/app/NotificationCapture.kt`
- Modify: `android/app/src/main/java/com/strictledger/app/FinanceBridgeModule.kt`
- Modify: `src/integrations/notifications/parser.ts`
- Modify: `src/integrations/notifications/nativeFinance.ts`
- Test: `src/integrations/notifications/parser.test.ts`

**Interfaces:**
- Native event includes `eventKind`, `eventStatus`, `provider`, optional `counterparty` and optional `debtHint`.
- Parser maps only validated fields into `PendingTransaction` fields.

- [ ] **Step 1: Add failing parser tests for repayment metadata**

Assert repayment and proxy repayment metadata survive normalization, while `rawText` and invalid event kinds are rejected.

- [ ] **Step 2: Run parser tests and confirm the new cases fail**

Run `npm test -- --runInBand src/integrations/notifications/parser.test.ts`.

- [ ] **Step 3: Add native event fields and classification hook**

Keep the existing package whitelist and amount extraction. Pass sanitized title/summary through a small classifier in Kotlin or a shared native rule function, and persist only classified fields.

- [ ] **Step 4: Expose fields through the bridge and validate in TypeScript**

Do not expose raw notification body. Reject malformed native values and clamp confidence as the current parser does.

- [ ] **Step 5: Run native-adjacent TypeScript tests and build Android**

Run `npm test -- --runInBand src/integrations/notifications/parser.test.ts src/integrations/notifications/classifier.test.ts`, then `npm run typecheck` and `android/gradlew.bat :app:assembleDebug`.

### Task 4: Link confirmed repayments to debts

**Files:**
- Modify: `src/features/ledger/ledger.ts`
- Modify: `src/features/ledger/notificationReview.test.ts`
- Modify: `src/features/ledger/ledger.test.ts`

**Interfaces:**
- `reviewDetectedTransaction` accepts `debtId` and repayment metadata in edits.
- A successful repayment decreases the linked debt amount without removing the candidate before validation.

- [ ] **Step 1: Write failing domain tests**

Cover valid linked repayment, proxy repayment with no debt, invalid debt ID, reminder/failed candidate rejection, and overpayment clamping.

- [ ] **Step 2: Run focused tests and confirm failure**

Run `npm test -- --runInBand src/features/ledger/notificationReview.test.ts src/features/ledger/ledger.test.ts`.

- [ ] **Step 3: Implement repayment review behavior**

Validate account and debt IDs, record the expense with repayment metadata, reduce the linked debt, and remove the candidate only after all validations pass.

- [ ] **Step 4: Run focused tests and all Jest tests**

Run `npm test -- --runInBand src/features/ledger/notificationReview.test.ts src/features/ledger/ledger.test.ts`, then `npm test -- --runInBand`.

### Task 5: Add repayment review UI

**Files:**
- Modify: `src/features/ledger/LedgerScreen.tsx`
- Modify: `app/index.tsx`
- Modify: `src/features/debts/DebtsScreen.tsx`
- Test: existing ledger tests plus typecheck

**Interfaces:**
- Pending cards show event label and provider without raw body.
- Review sheet lets users choose account, linked debt, and counterparty/remark for proxy repayment.

- [ ] **Step 1: Add UI state and callback types**

Extend the review callback edits with `debtId`, `counterparty`, and event metadata while preserving ordinary payment editing.

- [ ] **Step 2: Render repayment-specific fields**

Show a debt selector for repayment candidates, a short counterparty field for proxy repayment, and a warning for reminder/failed events.

- [ ] **Step 3: Wire state persistence through the existing app callback**

Keep persistence in `app/index.tsx`; the screen only emits review intent.

- [ ] **Step 4: Run typecheck and all tests**

Run `npm run typecheck` and `npm test -- --runInBand`.

### Task 6: Review documentation and package

**Files:**
- Modify: `docs/superpowers/specs/2026-10-16-notification-root-integration.md`
- Modify: `docs/superpowers/plans/2026-10-16-notification-root-integration.md`

- [ ] **Step 1: Update supported scope**

Document that notification candidates can include platform repayments and proxy repayments, but still require confirmation.

- [ ] **Step 2: Search for stale claims**

Run `rg -n "银行 API|自动还款|原始通知|代还|还款" docs src android` and remove only claims contradicted by the implemented scope.

- [ ] **Step 3: Build the final debug APK**

Run `android/gradlew.bat :app:assembleDebug` and verify the output metadata remains `0.2.0` / `versionCode 2`.
