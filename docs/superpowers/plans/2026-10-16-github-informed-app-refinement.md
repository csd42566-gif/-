# GitHub-Informed App Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Refine the Android personal-finance MVP with trustworthy daily guidance, complete screen workflows, considered motion, and settings that either work or clearly disclose their current availability.

**Architecture:** Keep business calculations and setting types in `src/core`, persistence in `src/data`, screen interactions in `src/features`, and external service boundaries in `src/integrations`. Reuse the existing Expo/React Native shell and avoid adding a backend or native integration in this pass.

**Tech Stack:** Expo 52, React Native 0.76, TypeScript, AsyncStorage, Jest, React Native Animated.

**Spec:** `docs/superpowers/specs/2026-10-15-accounting-mvp-design.md` plus the approved scope in the current conversation.

## Global Constraints

- Preserve the `core / data / features / ui / integrations` dependency boundaries.
- Keep automatic recognition, Root access, bank connectivity, and cloud sync as honest, isolated stubs; do not claim unavailable services are connected.
- Do not log raw notification text, credentials, or complete account identifiers.
- Preserve the balanced, non-blocking post-expense reminder and all three cash-flow card modes.
- Keep motion restrained and provide a reduced-motion path.

---

### Task 1: Finance projections and trustworthy demo data

**Files:**
- Modify: `src/core/model/finance.ts`
- Modify: `src/core/finance/calculations.ts`
- Test: `src/core/finance/calculations.test.ts`
- Modify: `src/data/seed.ts`

**Interfaces:** Add explicit monthly income, essential-expense, workday, and work-hour preferences to settings. Add pure helpers for current-month totals, upcoming obligations, projected monthly free-spend allowance, and work-time equivalents. All date-window helpers accept an injected `now` for deterministic tests.

- [ ] Add tests proving transactions outside the current month are excluded and transfers never count as income or expense.
- [ ] Add tests for upcoming-only obligations, goal saving allocation, zero/negative discretionary allowance, and work-hour conversion.
- [ ] Run the focused tests and confirm the new assertions fail for the missing behavior.
- [ ] Implement the smallest pure calculation API to satisfy those tests.
- [ ] Update seed settings and amounts so every screen derives from one coherent scenario.
- [ ] Run focused tests and typecheck.

### Task 2: Dashboard and debt timeline

**Files:**
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/debts/DebtsScreen.tsx`
- Test: `src/core/finance/calculations.test.ts`

**Interfaces:** Screens consume the shared projections from Task 1. Debt items are sorted by due date and show amount, time remaining, and forecast contribution. The dashboard separates current liquid account balance, monthly plan, remaining daily allowance, savings progress, and risk status.

- [ ] Add regression assertions for the shared projection values used by dashboard calculations.
- [ ] Run the focused tests and confirm the regression case fails against the current all-time aggregation.
- [ ] Replace duplicated all-time sums and hard-coded `120` values with shared date-aware calculations.
- [ ] Add empty, no-risk, and shortfall states without hiding high-risk notices when the card is hidden.
- [ ] Typecheck and inspect the rendered screens at phone dimensions.

### Task 3: Ledger workflow and account-aware entry

**Files:**
- Modify: `src/features/ledger/LedgerScreen.tsx`
- Modify: `src/features/ledger/ledger.ts`
- Modify: `src/features/ledger/ledger.test.ts`
- Modify: `app/index.tsx`

**Interfaces:** Keep `recordTransaction` as the write use case. Add ledger filtering and review actions around transaction state; detected entries stay pending until accepted, edited, or dismissed. Quick entry allows transaction type and account selection and displays the same budget/goal impact before and after save.

- [ ] Add tests for accepting, editing, dismissing, and de-duplicating a pending detected entry.
- [ ] Verify those tests fail before implementation.
- [ ] Implement the pending-entry use cases and account-aware quick-entry draft.
- [ ] Add month/type/account filters and stable empty states to the ledger screen.
- [ ] Make save/close/error states explicit and ensure transfers do not affect spend totals.
- [ ] Run ledger tests and typecheck.

### Task 4: Functional settings and safe integration details

**Files:**
- Modify: `src/core/model/finance.ts`
- Modify: `src/features/settings/SettingsScreen.tsx`
- Modify: `app/index.tsx`
- Modify: `src/data/storage.ts`

**Interfaces:** Persist configurable reminder mode, risk-card mode, strict mode, repayment reminders, income/essential spending/work profile. Each settings row opens a focused choice or explanation. Bank/payment, Root, and sync detail views report unavailable/not-configured states honestly. Log clearing requires confirmation.

- [ ] Add pure tests for settings updates and defaults/migration from an existing serialized state without new fields.
- [ ] Run the tests and confirm they fail before implementation.
- [ ] Implement backward-compatible settings normalization and persist every setting change.
- [ ] Implement functional setting selectors, integration detail sheets, privacy/log information, and clear-log confirmation.
- [ ] Verify switching tabs, opening/backing out of details, and saving changes leaves state consistent.
- [ ] Run tests and typecheck.

### Task 5: Layout, navigation, and motion polish

**Files:**
- Modify: `app/index.tsx`
- Modify: `src/ui/components/BottomNav.tsx`
- Modify: `src/ui/components/PressableCard.tsx`
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/ledger/LedgerScreen.tsx`
- Modify: `src/features/debts/DebtsScreen.tsx`
- Modify: `src/features/goals/GoalsScreen.tsx`
- Modify: `src/features/settings/SettingsScreen.tsx`

**Interfaces:** Keep navigation labels and current five-tab information architecture. Apply shared spacing, hierarchy, readable values, press feedback, modal transitions, and reduced-motion behavior without adding a new animation dependency.

- [ ] Add or adjust stable layout dimensions and selected/pressed accessibility states.
- [ ] Animate only meaningful transitions (tab content, sheets, progress/selection feedback); avoid delaying save or navigation.
- [ ] Respect the platform reduced-motion preference or provide an explicit app-level fallback.
- [ ] Verify all five screens and primary settings/ledger flows on a small Android viewport and a larger viewport.

### Task 6: Full verification and preview

**Files:**
- Modify: `README.md` only if the implemented behavior changes documented setup or scope.

- [ ] Run the full Jest suite.
- [ ] Run TypeScript typecheck.
- [ ] Run the Android Expo export/build check available in this workspace.
- [ ] Launch the app/dev server and inspect all five screens plus the add-entry, review-entry, goal-edit, and settings flows.
- [ ] Report any unavailable emulator/device checks explicitly.
