# 金额地基改造计划

> 日期：2026-10-18
> 依据：三决策已拍板——① 导入扣账户余额 ② 废弃 `savedAmount` ③ 还款方式可选。
> 状态：**计划，未执行。**按阶段推进，每阶段独立可验收。

## 现状（一句话）

账户余额、月度预算、目标进度、债务还款四套口径各自计算，中间没有对账点；存储层整包覆盖、无事务、无版本号。任何一次并发写或脏数据都会让金额永久错位。

**顺序原则：先让数据可信（阶段 0），再让口径统一（阶段 1），然后才落地三决策（阶段 2），最后修历史数据（阶段 3）。反序做等于在漏水地基上装修。**

---

## 阶段 0：存储层加固

不改任何业务语义，只让"读写"变可靠。

### 0.1 `src/data/storage.ts`

| 改动 | 现在 | 改后 |
|---|---|---|
| `loadState` 出错处理 | 无 try/catch，`JSON.parse` 或 `normalize` 抛错直接冒泡 → 应用永久白屏 | catch 后：把原始字符串备份到 `ledger.corrupt.<时间戳>`，返回初始状态，并向外抛一个可识别的 `StorageCorruptError` 让 UI 提示 |
| 数据版本 | 无 | 落盘加 `schemaVersion`，读取时比对，低版本走迁移函数 |
| 写入方式 | 直接覆盖主 key | 先写 `ledger.tmp`，成功后切换主 key（两阶段），切换失败保留旧数据 |

### 0.2 `app/index.tsx` 写入收敛

现状：`saveState` 有 4 处调用（第 45、64、66、81、101 行），且 `persist` 用渲染闭包里的 `state`，通知 effect 会并发 `loadState/saveState`。

改法：

- 新增一个 `commit(updater: (prev: LedgerState) => LedgerState)`，内部用**串行 Promise 队列**（前一次写完才写下一次），杜绝后写覆盖先写。
- `persist(next)` 与 `recordTransaction(state, ...)` 全部改成 `commit(prev => recordTransaction(prev, ...))`，不再读闭包 state。
- 通知拉取那段（第 64-66 行）改走同一个 `commit`，不再自己 `loadState` + `saveState`。

**影响调用点**：`index.tsx:91`（确认待确认）、`index.tsx:100`（手动记账）、`index.tsx:109`（审核）、`index.tsx:119-128`（账户）、`index.tsx:132`（目标）、`index.tsx:133`（导入）。

### 0.3 恢复入口

设置页（`MyScreen.tsx`）加两项：导出当前数据为 JSON、重置为初始状态（重置前强制导出）。

### 验收

- 手工把 AsyncStorage 里 `ledger` 写成非法 JSON → 应用能启动、显示"数据损坏已备份"、可用初始状态继续。
- 连点两次"记一笔" → 两笔都在，账户余额扣了两次。

---

## 阶段 1：统一派生层

### 1.1 新增 `src/core/finance/derive.ts`

```
deriveFinancials(state: LedgerState, now: Date): {
  availableBalance   // Σ 非信用账户 balance（统一 max(0) 口径）
  monthSpent         // 本月支出（扣退款）
  monthIncome        // 本月收入
  todaySpendable     // 预算 ÷ 剩余天数
  goalProgress       // (余额 − 起始余额) / 目标
  goalRemaining
  monthDue           // 本月应还（按还款方式）
  overdueDue         // 逾期未还
}
```

规则：所有页面只读这组值，不再自己拼 `calculateMonthlyBudget`。`calculateMonthlyBudget` 保留为内部实现，不再对外导出。

### 1.2 替换调用点（4 处）

- `src/features/home/HomeScreen.tsx:20`
- `src/features/debts/DebtsScreen.tsx:16`
- `src/features/goals/GoalsScreen.tsx:22`
- `app/index.tsx:92`

### 1.3 清理死代码

经 grep 确认生产代码零调用：`calculateAvailableSpend`、`calculateProjectedCashFlow`、`summarizeTransactionImpact`（仅 `ledger.test.ts` 引用）。删除时同步删测试里的引用。

同时把 `GoalsScreen.tsx:31` 自己算的 `hourlyIncome` 也移进派生层——现在它和 `calculations.ts:64` 是两套算法。

### 验收

四个页面上的"本月已花"必须是同一个数字；目标页上下两处存款数字一致。

---

## 阶段 2：三决策落地

### 2.1 决策一：导入扣余额

| 文件 | 改动 |
|---|---|
| `src/core/model/finance.ts` | `Transaction` 加 `externalKey?: string`（`订单号|日期|金额|余额`） |
| `src/features/statement-import/statementImport.ts` | `importStatement` 返回的 state 里**按账户扣减 balance**；`:183` 的 `createAccount({balance: 0})` 改为先匹配已有账户，匹配不上返回待确认项 |
| `src/features/statement-import/statementImport.ts` | 去重从"看 id 前缀"改为**查 `externalKey`**，跨 `import_*` / `tx_*` 都有效 |
| `src/features/ledger/ledger.ts` | 新增 `applyImportedTransactions(state, tx[])`：一次调用内完成"写流水 + 扣余额"，保证原子 |
| `src/features/statement-import/statementImport.test.ts:42-43` | **这条测试断言"导入后 balance 仍为 1000"，必须改**——它是旧口径的锁 |

**账户匹配规则（已定）**：先按账单的 `provider` + 卡尾号去匹配已有 `account`（`id` 或 `name` + 尾号）；**匹配不到时进待确认列表让你选账户，绝不静默 `createAccount({balance: 0})`**。现在 `statementImport.ts:183` 的行为必须删掉——那会凭空造出一个余额为 0 的账户，账单的钱既没扣到真实账户，又留下一个空壳。

### 2.2 决策二：废弃 `savedAmount`，改用「余额 − 起始 − 期间收入」

**已定方案 B：剔除同期收入。** 进度只反映"少花了多少"，不反映"多赚了多少"，这才符合省钱产品的定位。

```
已存 = 当前余额合计 − 起始余额 − 期间总收入
进度 = clamp(已存 / 目标金额, 0, 1)
```

| 文件 | 改动 |
|---|---|
| `src/core/model/finance.ts` | `Goal` 删 `savedAmount`，新增 `startBalance: number` 和 `startBalanceAt: string`（快照时间，用于划"期间"边界） |
| `src/features/goals/goals.ts:20` | 首次创建时写入 `startBalance` = 当前非信用账户余额合计、`startBalanceAt` = now；**编辑目标时两者都不能重置**，否则进度归零 |
| `src/core/finance/calculations.ts:3` `calculateGoalPlan` | 签名改为 `(goal, snapshot: {currentBalance, incomeSinceStart}, now)`；进度按上面的公式算 |
| `calculateGoalPlan` 的 4 处调用 | `calculations.ts:58`、`ledger.ts:90`、`HomeScreen.tsx:29`、`GoalsScreen.tsx:21` 补参数 |
| `GoalsScreen.tsx:65` | 去掉 `goal.savedAmount`，改用派生层的 `goalProgress` |

**「期间总收入」的口径必须写死：**

- 只统计 `type === 'income'` 且 `eventKind !== 'refund'` 的交易（退款是冲减支出，不是收入，不能算进去）；
- 不统计 `transfer`；
- 时间范围为 `occurredAt >= startBalanceAt`。

**结果可能为负，必须定义展示：**

分子 < 0 表示"从建目标到现在，不仅没省，还多花了钱"。此时进度条显示 0%，但不能只显示 0%——要同时给出负向提示，例如「距起点多花 ¥1,200」。只显示 0% 会让用户以为"还没开始"，实际是"在倒退"。

**已知数据风险：** B 方案依赖"余额是真实的、收入是记全的"。如果余额靠手动改、收入却漏记，分子会虚高（显示存了钱，其实是工资到账）。这一条靠阶段 3 的余额对账入口兜底，不可能靠公式自身解决。

### 2.3 决策三：还款方式可选

| 文件 | 改动 |
|---|---|
| `src/core/model/finance.ts` | `Debt` 加 `repaymentMode: 'minimum' | 'full'`，默认 `'minimum'` |
| `src/core/finance/calculations.ts:55-57` | 进预算金额 = `mode === 'full' ? amount : (minimumPayment ?? amount)`；**删掉 `dueDate >= today` 的过滤**，逾期单独累计到 `overdueDue` |
| `src/features/debts/DebtsScreen.tsx` | 欠款详情弹层加"还款方式"切换；逾期项顶部标红并计入预算 |
| `src/features/repayment-import/` | 导入分期时把 `minimumPayment` 一起带进来，否则 `'minimum'` 模式没有依据 |

### 验收

- 导入一份账单两次 → 只扣一次余额，流水不重复。
- 导入一份匹配不到账户的账单 → 进待确认并让你选账户，**不产生新的空账户**。
- 建目标后发一笔工资（记为 income）→ 进度不因工资上涨，只随花钱下降。
- 建目标后花超 → 进度显示 0% 且出现「距起点多花 ¥X」，不是静默的 0%。
- 编辑已有目标（改名/改金额/改日期）→ 进度不被重置。
- 一笔逾期欠款 → 出现在本月应还里，且标红。

---

## 阶段 3：历史数据迁移

现在库里已有导入过但未扣余额的账单。需要一个一次性修复：

1. 遍历所有 `import` 来源的 transaction，按账户汇总支出/收入；
2. 与当前 `account.balance` 对账，得出"应有余额"；
3. 在设置页提供「修正账户余额」入口，显示差额，由用户确认后一次写入。

不自动改——金额的事必须让用户看见差额再点头。

---

## 总回滚

- 阶段 0/1 只改内部实现，UI 不变，回滚 = `git restore <文件>`。
- 阶段 2 改了数据模型，回滚需要同时回滚 `schemaVersion` 和迁移函数，**旧数据会读不出来**——所以执行前必须先做一次导出备份。

## 风险

1. **阶段 2 最好在一个提交里完成**，因为 `Goal`/`Debt`/`Transaction` 三个模型同时变，分两次提交中间态跑不起来。
2. `calculateMonthlyBudget` 现在被 3 个页面 + index 各拼一次参数（重复 4 遍），阶段 1 合并后要确保没有页面漏改——漏一个就会出现"两个页面两个数"。
3. 现在的测试里有几条**在锁旧口径**（导入不改余额、savedAmount 初始值），改完必须逐个审视，不允许直接删测试换绿灯。
