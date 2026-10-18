# 神罚 Magisk 模块与控制面板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended; inline execution is acceptable here). Steps use checkbox syntax for tracking.

**Goal:** Build an isolated Magisk module package and an in-app control panel that can be opened from Magisk.

**Architecture:** Shell files under `magisk/shenfa-core` handle boot initialization and the Magisk action entry. TypeScript owns pure module state/config rules and the UI; a Kotlin bridge performs only allowlisted Root reads/writes. The existing notification/ledger flow remains the sole path that can create reviewed transactions.

**Tech Stack:** Expo 52, React Native 0.76, Kotlin, TypeScript, Jest, PowerShell packaging script.

**Spec:** `docs/superpowers/specs/2026-10-17-magisk-module-control-panel.md`

## Global Constraints

- 不访问支付宝、微信、银行或其他 App 私有数据库。
- 不自动支付、转账或还款；识别事件必须人工确认。
- 不保存密码、Token、完整卡号或原始通知正文。
- 云同步未接入时默认关闭并显示不可用。
- 不新增 npm/Gradle 依赖，不清理或覆盖现有用户数据。

### Task 1: Pure module state and deep-link rules

**Files:**
- Create: `src/integrations/magisk/module.ts`
- Create: `src/integrations/magisk/module.test.ts`

- [ ] Write failing tests for default features, safe config parsing, unknown key rejection, and `strictledger://module-control` detection.
- [ ] Run `npm test -- src/integrations/magisk/module.test.ts` and confirm the expected missing-module failure.
- [ ] Implement minimal pure functions and types.
- [ ] Run the focused test and then the full Jest suite.

### Task 2: Root bridge contract

**Files:**
- Modify: `src/integrations/notifications/nativeFinance.ts`
- Modify: `android/app/src/main/java/com/strictledger/app/FinanceBridgeModule.kt`

- [ ] Add typed module status and feature-toggle methods to the JS bridge.
- [ ] Add Kotlin allowlisted config read/write through a bounded `su -c` process with timeout and sanitized arguments.
- [ ] Preserve existing notification and root detection methods.
- [ ] Run TypeScript checks and Android compilation.

### Task 3: App control panel and deep-link entry

**Files:**
- Create: `src/features/module/ModuleControlPanel.tsx`
- Modify: `src/features/settings/MyScreen.tsx`
- Modify: `app/index.tsx`

- [ ] Add a panel route/state with four isolated feature rows, status text, refresh action, and switch controls.
- [ ] Open the panel when the app receives the `strictledger://module-control` URL.
- [ ] Handle Android back from the panel and refresh module status when the app returns to foreground.
- [ ] Keep unsupported cloud sync visible but disabled.

### Task 4: Magisk module source and packaging

**Files:**
- Create: `magisk/shenfa-core/module.prop`
- Create: `magisk/shenfa-core/action.sh`
- Create: `magisk/shenfa-core/service.sh`
- Create: `magisk/shenfa-core/uninstall.sh`
- Create: `magisk/shenfa-core/config/default.conf`
- Create: `magisk/shenfa-core/bin/shenfa-module`
- Create: `scripts/package-magisk.ps1`
- Modify: `.gitignore`

- [ ] Add boot initialization and a deep-link action script.
- [ ] Make scripts POSIX-compatible and mark them executable in the package.
- [ ] Package to `dist/shenfa-core-v0.3.0.zip` without including build data or logs.
- [ ] Verify ZIP entries, module metadata, and shell syntax.

### Task 5: Verification and release metadata

**Files:**
- Modify: `app.json`
- Modify: `package.json`
- Modify: `CHANGELOG.md`

- [ ] Bump App version to `0.3.0` and Android versionCode to `3`.
- [ ] Add a PowerShell package command without adding dependencies.
- [ ] Run Jest, TypeScript, Android Release build, and Magisk package verification.
- [ ] Report APK and ZIP output paths plus limits of device-side Magisk testing.
