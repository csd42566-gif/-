# Android Notification And Root Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add consent-based Android payment notification recognition and a non-privileged Root status check.

**Architecture:** A Kotlin NotificationListenerService filters known source packages and stores only minimal parsed candidates for JS retrieval. Pure TypeScript validates/maps candidates into the existing pending-review flow; account selection and posting remain user-controlled. A small native module exposes permission/settings, queue, and root-status methods.

**Tech Stack:** Expo 52 prebuild Android project, React Native 0.76 native module, Kotlin, TypeScript, Jest.

**Spec:** docs/superpowers/specs/2026-10-16-notification-root-integration.md

## Global Constraints

- Never request READ_SMS or RECEIVE_SMS; read SMS only from the system notification after user-granted notification access.
- Never auto-post a recognized event; preserve review and explicit account selection.
- Never persist/log raw notification bodies, payment credentials, or complete account identifiers.
- Never execute su or access another app's private storage; Root detection is informational only.
- Preserve existing local data and user settings.

---

### Task 1: Pure notification parsing and event validation

**Files:** Create src/integrations/notifications/parser.ts; create parser.test.ts.

- [ ] Write tests for supported provider/Chinese SMS fixtures, unknown sources, malformed/ambiguous amounts, and stable deduplication keys.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement a pure parser returning a minimal normalized candidate or null; never retain raw text in the returned object.
- [ ] Run focused tests.

### Task 2: Native Android notification bridge

**Files:** Create Kotlin listener, module, and package under android/app/src/main/java/com/strictledger/app; modify AndroidManifest.xml and MainApplication.kt.

- [ ] Implement notification-access state, settings intent, allowlisted package filtering, minimal candidate queue, read-and-clear, and informational Root checks.
- [ ] Register the listener service with BIND_NOTIFICATION_LISTENER_SERVICE and the native package without requesting SMS permissions.
- [ ] Build Android Debug APK and inspect manifest/service registration.

### Task 3: Account-aware pending review

**Files:** Modify ledger.ts, ledger.test.ts, LedgerScreen.tsx, and app/index.tsx.

- [ ] Test that a detected item with no account cannot post until an account is explicitly selected.
- [ ] Test duplicate events remain a single pending item and dismissal leaves balances unchanged.
- [ ] Implement account selection in the review sheet and connect normalized events to the current ledger state.
- [ ] Run ledger tests and typecheck.

### Task 4: Settings controls and Root status UI

**Files:** Modify MyScreen.tsx; create nativeFinance.ts bridge wrapper.

- [ ] Add notification-access status, open-system-settings action, refresh/pull flow, and Root status action.
- [ ] State unsupported direct bank APIs honestly; do not present unsupported providers as connected.
- [ ] Verify unauthorized, authorized, unavailable, empty-queue, and Root-not-detected states.

### Task 5: End-to-end verification

- [ ] Run full Jest suite and TypeScript typecheck.
- [ ] Build Android Debug APK and install with adb install -r only; do not clear package data.
- [ ] Verify settings actions and candidate review on device; record if Android notification-access authorization requires manual user interaction.
- [ ] Verify existing device balances/transactions remain intact and report any manual validation limits.
# 还款识别补充

在原通知候选流程上增加结构化事件字段：`eventKind`、`eventStatus`、`provider`、`debtId` 和 `counterparty`。Android 侧只保存分类结果，不保存完整通知正文；JS 侧在待确认界面展示还款/代还、提醒和失败状态。成功还款确认时选择欠款并同时更新交易、账户余额和欠款余额；提醒与失败候选只能忽略，不能直接入账。
