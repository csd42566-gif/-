# v2 技术决策文档（2026-11-16）

> 状态：技术决策定稿（对照 `2026-11-16-rewrite-requirements.md` 的 46 项需求逐条产出）
> 取代声明：本文件取代 `2026-10-25-v2-rewrite-design.md` 中的技术方案部分。旧文档保留作历史，不删。

---

## 1. 复审结论总览

| 类别 | 数量 | 内容 |
| --- | --- | --- |
| 照旧 | 9 | 金额整数分、Expo SDK 57、expo-sqlite+drizzle、Zustand、Expo Router、MMKV、安全 P0、gifted-charts、Maestro |
| 推翻 | 4 | 五增强（只剩统计图表）、同步预留（local_changes/HLC/UUID）、schema 18 表、软删 |
| 新增 | 3 | react-native-reanimated、新页面组、加密备份 |
| 待定 | 0 | — |

---

## 2. 照旧（9 项）

1. **金额整数分（int64 定点）**：所有金额字段一律整数分，存库/入账/比较/累计=整数分；除法派生量（日均/时薪等）=浮点分。字段映射：Account.balance→balanceCents、Transaction.amount→amountCents、Debt.*、Goal.*、WorkProfile.*、Settings.* 全部 ×100 改分。money.ts 改 `roundCents(value)=Math.round(value)` + 新增 `formatCents`。约 70% 测试机械 ×100 替换。红利：dedupeKey 里 `cents=Math.round(amount*100)` 可删，直接传 amountCents。
2. **Expo SDK 57**：SDK 54 支持期已过，直接上 57。
3. **expo-sqlite + drizzle-orm**：本地记账的事实标准组合，不换 op-sqlite / watermelondb。
4. **Zustand 分域 store + selector**：分域 store（accounts/ledger/settings…）+ 细粒度 selector，避免无谓重渲染。
5. **Expo Router**：仓库 main 入口已是 `expo-router/entry`，文件路由继续。
6. **MMKV 偏好**：主题、动画三档、显示三开关、预算单值走 MMKV，不进 SQLite。
7. **安全 P0 四件套**：SQLCipher（PRAGMA key + 密钥 SecureStore）、allowBackup=false、正式签名、备份内嵌密钥。
8. **gifted-charts**：统计页饼图 + 趋势图。
9. **Maestro 冒烟**：发布前跑关键路径冒烟。

---

## 3. 推翻（4 项）

1. **五增强只剩统计图表**：quickAdd 两步流死（新需求=完整表单）、标题联想不进需求、账单搜索=新需求的搜索功能、周期记账不进需求。旧设计里"五增强"作为整体作废。
2. **同步预留砍**：local_changes 表、HLC 时钟、UUID 主键全部去掉，改整数自增主键（无跨设备同步需求）。
3. **schema 18 表 → 4 表**：accounts / categories / transactions（+ 元数据），预算单值走 MMKV。旧 18 表方案作废。
4. **软删改硬删**：流水二次确认后真删，余额由剩余流水派生（不落库），无 deletedAt 字段。

---

## 4. 新增（3 项）

1. **react-native-reanimated**：三档动画（记账成功/页面转场/数字滚动）+ 共享元素过渡的实现底座。
2. **新页面组**：首开引导 / 账户管理 / 分类管理 / 统计下钻 / 流水详情 / 设置——按需求文档 §4 页面规格实现。
3. **加密备份**：expo-crypto AES 加密 → 文件导出 → 系统分享；恢复时读取文件 + 解密 + 全量重建。

---

## 5. 数据库 schema（4 表，含多币种）

```sql
-- 账户：整数分余额派生不落库
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  initial_balance_cents INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- 分类：支出两级（parent_id 自引用）+ 收入一级
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
  parent_id INTEGER REFERENCES categories(id),
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 流水：转账两腿 related_id 关联；多币种 currency 字段
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('expense', 'income', 'transfer')),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY',
  category_id INTEGER REFERENCES categories(id),
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  related_id INTEGER REFERENCES transactions(id),
  occurred_at INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 索引
CREATE INDEX idx_tx_occurred ON transactions(occurred_at);
CREATE INDEX idx_tx_account ON transactions(account_id);
CREATE INDEX idx_tx_category ON transactions(category_id);
```

**要点**：
- 转账 = 两行 kind='transfer'：转出腿 account_id=转出账户、amount_cents 为正；转入腿 account_id=转入账户、amount_cents 为正；两腿互相填 related_id。余额计算：转出账户减、转入账户加。
- 余额派生：`balance = initial + Σ收入腿 − Σ支出腿 − Σ转出腿 + Σ转入腿`，永不落库、永不手改。
- 多币种：currency 存交易行；统计与总余额按币种分组展示，不做自动汇率换算。
- 预算：单值存 MMKV，不建表。
- 元数据（主题、动画档、显示开关）：MMKV，不建表。

---

## 6. 目录骨架（v2 新结构）

```
src/
├── core/                  # 纯函数（零 React import）
│   ├── money.ts           # roundCents / formatCents（整数分）
│   ├── balance.ts         # 余额派生（纯累加）
│   └── categories.ts      # 分类树操作
├── data/                  # drizzle schema + db 访问
│   ├── schema.ts
│   └── db.ts
├── features/              # Zustand 分域 store + 业务
│   ├── accounts/
│   ├── ledger/
│   └── settings/
└── app/                   # Expo Router 页面壳
    ├── _layout.tsx
    ├── index.tsx          # 首页账本
    ├── stats.tsx          # 统计
    ├── record.tsx         # 记账表单
    ├── tx/[id].tsx        # 流水详情
    ├── accounts.tsx       # 账户管理
    ├── categories.tsx     # 分类管理
    └── settings.tsx       # 设置
```

**砍掉的 v1 模块**（不进 v2）：`core/work`、`core/import`、`features/attendance`、`features/debts`、`features/goals`、`features/repayment-import`、`features/statement-import`、`features/module`、`integrations/` 全部端口。

---

## 7. 里程碑重排（M1–M5）

| 里程碑 | 内容 | 可独立验证 |
| --- | --- | --- |
| M1 骨架 | Expo SDK 57 + Router + drizzle schema + Zustand + SQLCipher + 首开引导 | 安装→建库→三账户初始余额→首页空态 |
| M2 记账闭环 | 完整表单 + 流水 + 余额派生 + 改错/删除 + 转账 | 记一笔→余额变→改→删→回算一致 |
| M3 统计与搜索 | 统计页（分类占比/预算进度）+ 搜索筛选 | 筛选结果正确 |
| M4 视觉与动画 | 暗色主题 + 三档动效 + 设置开关 | 切主题全 App 一致 |
| M5 收尾 | 导出 CSV + 加密备份恢复 + Maestro 冒烟 + 1.0.0 | 备份→干净安装→完整恢复 |
