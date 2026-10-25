# 神罚 v2 推翻重构 · 设计稿（Design Spec）

> 日期：2026-10-25 ｜ 状态：已评审拍板，待实施
> 依据：两轮 GitHub 同类项目调研（20+ 项目），对比报告结论已并入本文，出处随文标注。
> 关联：v1 现状分析见本轮会话记录；Phase 1 清理已合并 main（942fe63）。

## 0. 一句话

保留神罚的产品哲学（控制可花额度）与 core 计算资产，推翻 v1 的存储、导航、状态、自动记账四层底盘，换成同类开源项目验证过的标准架构，并以三处高性价比 UX 增强拉开差距。

## 1. 调研依据（摘要）

| 领域 | 关键结论 | 出处 |
|---|---|---|
| 存储 | SQLite 是本地记账事实标准；时间戳迁移 + `__migrations__` 表 | actual 29.7k、BeeCount 2.6k、ezbookkeeping 5.8k、MMEX |
| 领域模型 | 转账两腿 relatedId、金额 int64 定点、二级分类、信用卡账单日/还款日 | ezbookkeeping `pkg/models`、BeeCount `lib/data/db.dart`、paisa 负债页 |
| 同步预留 | local_changes 变更表 + syncId(UUID) + HLC；上云复用 @actual-app/crdt | BeeCount `lib/cloud/sync`、actual CRDT 3.1.4 |
| 前端架构 | Expo Router + Zustand 分域 store + selector；Onyx/WatermelonDB/Redux 过度设计 | obytes 模板 4.4k、RocketChat 迁移方向、Bluesky 反面教材 |
| 自动记账 | 「分类逻辑是数据不是代码」；原始事件持久化 + ack 队列 + 状态机 | AutoAccounting 956（本地克隆）、firefly 规则引擎 |
| 账单导入 | 神罚骨架接近 deb-sig 水平；缺口=微信解析器/中性交易/去重降级/用户规则外置 | deb-sig 732、firefly data-importer 850、KeepAccounts 309 |
| 功能 UX | 今日可花 hero + 工时折算是全市场独家；抄 quickAdd/标题联想/内联周期交易 | Cashew 4.7k、BeeCount、sossoldi、paisa |
| 技术栈 | expo-sqlite+drizzle+MMKV+token 样式+gifted-charts+Maestro（2026-10 实测定论） | 见 §3 |

## 2. 已拍板决策

- **D1 范围**：v2 1.0 = 底盘替换 + quickAdd 两步流、记账标题联想、统计图表三个增强；订阅周期、历史预算对比、年度报告进 1.1+。
- **D2 导入规则**：App 内表单生成、以 YAML 条件规则结构存储（deb-sig 格式为基准）；1.0 先内置规则集 + 现有 accountMapping。
- **D3 去重**：订单号/externalKey 精确命中 → 静默跳过；模糊命中（归一化键）→ 降级为「疑似重复」进待确认列表，不再静默丢弃。
- **D4 中性交易**：支付宝「不计收支」等作为第四种 kind `neutral` 存库，默认不入账本、可查询可追溯。
- **D5 待还 1.0 主方向**：信用卡还款日历（paisa 方向，与现金流预测同源）；订阅/借出借入建模进 1.1。
- **D6 流程**：Phase 1 已合并 main；v2 在 `feat/v2` 分支 big-bang 重写 `app/`+`src/features`+数据层，v1 留 git 历史，发布 1.0.0。

## 3. 技术栈定论

| 层 | v1 | v2 | 理由 |
|---|---|---|---|
| 框架 | Expo 52 / RN 0.76 | **Expo 54** | 升级到当前 SDK，新架构 JSI |
| 导航 | tab useState 假路由 | **Expo Router 文件路由** `(tabs)/`+stack | 返回键/deep link/404 白得 |
| 状态 | 壳层 useState+props 管道 | **Zustand 按 feature 分 store + selectors.ts** | 无 Provider 嵌套，selector 粒度订阅 |
| 主存储 | AsyncStorage 单键 JSON | **expo-sqlite + drizzle-orm + drizzle-kit** | 官方驱动+迁移工作流+useLiveQuery |
| 偏好 | 同上 | **MMKV**（主题/设置），敏感项留 secure-store | 同步 KV，官方 config plugin |
| 样式 | token + 手写依赖数组 | **token + useThemedStyles 保留** | nativewind 主题切换慢（#1332），v1 路线被验证 |
| 表单 | 10 个 useState 全表单 | **仍用 useState**（quickAdd 两步流重构） | 4 字段数字键盘场景 RHF 过度 |
| 图表 | 无 | **gifted-charts** | 饼图/趋势/条形开箱即用 |
| E2E | 无 | **Maestro 本地冒烟**（启动/记一笔/切主题截图） | 免费够用 |
| 同步 | 无 | **local_changes 表 + HLC 列，只建不实现** | 上云时接 @actual-app/crdt 内核 |

明确不用：op-sqlite、watermelondb、Kysely、nativewind、tamagui、react-hook-form、PowerSync、ElectricSQL、RxDB、Triplit、Skia 自绘、Maestro Cloud。

## 4. 领域模型（drizzle schema 草案）

约定：金额一律 `integer` **分**（int64 定点，ezbookkeeping）；日期键 `YYYY-MM-DD` 本地（dayKey）+  epoch 毫秒 occurredAt；软删 `deletedAt`（ezbookkeeping）；主键 UUID（跨设备 sync 前提）。

```
accounts        id, name, kind(cash|bank|credit|wallet), balanceCents,
                creditLimitCents?, billingDay?, repaymentDay?,      -- BeeCount 信用卡字段
                sortOrder, archivedAt?, createdAt, updatedAt
categories      id, name, parentId?, kind(expense|income), sortOrder  -- 二级分类
transactions    id, type(expense|income|transfer), accountId,
                relatedId?,                                          -- 转账两腿互指（ezbookkeeping）
                amountCents, categoryId?, note?, occurredAt, dayKey,
                source(manual|notification|autoaccounting|import),
                externalKey? UNIQUE, dedupHash? UNIQUE,              -- 幂等收敛为一套
                debtId?, counterparty?, provider?, eventKind?, eventStatus?,
                installmentNumber?, installmentCount?,
                createdAt, updatedAt, deletedAt?
debts           id, name, kind(credit|bill|loan|personal), amountCents,
                repaymentMode(minimum|full), minimumPaymentCents?, dueDate,
                installmentJson?, note?, createdAt, updatedAt
goals           id, name, targetAmountCents, startBalanceCents, startBalanceAt,
                deadline, archivedAt?                                -- 数组化（v1 单实体）
pending_bills   id, type, amountCents, accountId?, accountLabel?, categoryId?,
                occurredAt, source(notification|autoaccounting|import|import-neutral),
                confidence?, eventKind?, eventStatus?, provider?, counterparty?,
                debtId?, externalKey?, dedupHash?,
                matchRule?,                                          -- 命中规则名可追溯（替代硬编码置信度）
                status(pending|suspected|confirmed|dismissed),       -- D3 疑似重复在此
                createdAt
raw_events      id, app, channel(notification|sms|ocr), title, text, postTime,
                status(pending|processing|done), claimedAt?, createdAt  -- 采集即落库+ack
rules           id, name, priority, enabled, scope(capture|import|category),
                matchJson, outputJson, builtin, version              -- 「规则是数据」
attendance      dayKey PK, clockIn?, clockOut?, status(worked|rest|leave), note?
work_profile    单行, 金额分, allowancesJson, 试用期/周期字段同 v1
budgets         id, month('YYYY-MM'), categoryId?(null=总预算), limitCents  -- envelope-lite
recurring       id, templateJson, frequency, nextRunAt, enabled       -- 1.1 才实现，先建表
local_changes   seq PK, tableName, rowId(uuid), op(i|u|d), payload, hlc, syncedAt?  -- 同步预留
meta            key PK, value                                        -- schema 版本等
```

v1 → v2 映射要点：`Transaction.toAccountId` 单条转账 → 两条 transfer 互指；浮点金额 → 分（×100 取整，迁移时按 v1 精度换算）；`Settings` 整包 → MMKV（业务键）+ work_profile 表；`externalKey` 与 dedupKey 双身份 → `dedupHash UNIQUE` 一套。

## 5. 关键流程

### 5.1 自动记账 v2（原生只采集，规则是数据）

```
Kotlin 白名单采集+关键词粗过滤 → INSERT raw_events(status=pending)   -- 采集即持久化
JS 按 status 游标认领(processing, 带claimedAt超时回收) → 规则表匹配(scope=capture, 首中优先)
→ 命中: 生成 pending_bills(status=pending, matchRule=规则名)
  未命中: 保持 raw_events 待查 + 可选低置信兜底规则
→ dedupHash 精确命中已入账 → 静默跳过; 模糊命中 → pending_bills(status=suspected)   -- D3
→ 人工确认 → transactions 入账(raw_events→done) / dismiss
```
Kotlin 废弃项：classify() 硬编码、SharedPreferences 100 条 FIFO、破坏性 consume、分钟截断。保留项：包名白名单、title/text 提取、金额正则、「恰好一个金额」歧义拒绝、事件幂等 id。

### 5.2 导入 v2

微信专用解析器（11 列、交易类型语义、¥ 前缀、服务费拆备注）；支付宝解析补 BOM、对方账号/商家订单号/备注采集、「不计收支」→ neutral（D4）、汇总行独立校验；分类/账户映射走 rules(scope=import) 内置规则集 + accountMapping；银行列配置从 deb-sig 抄 20+ 家，配置即数据。

### 5.3 今日可花（差异化主轴强化）

所有写操作（记账/确认/导入）后即时重算：`今日可花 = (月可用 − 已花 − 未来待还占比) / 剩余天数`，计算留在 core（现有 calculateMonthlyBudget 演进），由 Zustand selector 订阅；超支时进入「惩罚性折算」（现有 punishment.ts 保留，金额→工作时长）。考勤打卡 → calculateEarnings → 时薪 → 额度联动不变。

## 6. 目录骨架

```
app/                          # 纯路由，零业务逻辑
  _layout.tsx                 # SQLiteProvider + 主题 + hydration
  (tabs)/_layout.tsx index.tsx ledger.tsx debts.tsx goals.tsx me.tsx
  add-txn.tsx  transaction/[id].tsx  import/index.tsx
  settings/[page].tsx  module.tsx  attendance.tsx
src/
  core/                       # 保留并扩展：finance/ time/ work/ import/ logging/ + rules/（规则解释器）
  db/                         # schema.ts  migrations/  client.ts  seed-defaults.ts
  features/<domain>/          # store.ts  selectors.ts  db.ts(查询)  components/
    accounts  transactions  ledger  home  debts  goals  attendance  settings  imports  capture  module
  lib/                        # kv.ts(MMKV)  format.ts  uuid.ts
  theme/                      # tokens.ts(三档)  useThemedStyles.ts  components/
  integrations/               # nativeFinance  captureClient  magisk  statusService
android/  magisk/             # 保留，Kotlin 按 §5.1 改造
```

## 7. 数据迁移（M3）

一次性导入器 `src/db/migrate-v1.ts`：读 AsyncStorage `strict-ledger/state` → 逐实体换算（金额×100 分、转账拆两腿、goal 单→数组、settings→MMKV+work_profile）→ 事务写入 SQLite → 校验（笔数/总额对账）→ 成功后把 v1 键改名为 `strict-ledger/state.v1-backup`（不删）。含真实样例测试（v1 的演示数据 + 边界：空账本/含分期/含 neutral 待确认）。

## 8. 风险与回滚

| 风险 | 缓解 |
|---|---|
| Expo 52→54 升级破坏原生构建 | android/ 重新 prebuild；升级单独成第一步提交，失败可停在 52 先行开发（Router/Drizzle 均兼容 52+） |
| MMKV 不支持 Expo Go | v1 已 prebuild（有 android/ 目录），走 dev build，无影响 |
| 两腿转账迁移出错 | 迁移器对账校验（笔数+总额+转账配对数），不过不切换 |
| big-bang 期间 v1 不可用 | feat/v2 分支独立开发，main 保持可用；每日真机装 v1 不受影响 |
| 规则表执行出错 | 规则解释器纯函数+单测；未命中规则的事件保留在 raw_events 不丢 |

## 9. 里程碑

见配套执行计划 `docs/superpowers/plans/2026-10-25-v2-rewrite.md`（M1 骨架 → M2 记账闭环 → M3 数据迁移 → M4 导入 v2 → M5 还款日历 → M6 自动记账 v2 → M7 1.0.0 发布）。
