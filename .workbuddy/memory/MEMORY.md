# 项目长期记忆 · 神罚 / strict-ledger

## 项目定位
Android 个人财务 App，Expo 52 + RN 0.76 + TS，包名 `com.strictledger.app`。
核心不是普通记账，是"控制可花额度"：首页给今日可花/本月需存/待还，记账后弹预算平衡提醒，目标页反推每日应存。
版本 0.7.0（versionCode 7，2026-10-18 一天内从 0.3 连升到 0.7）。目录约定：src/core（纯计算）、src/data、src/features、src/integrations（端口+stub）、app（Expo Router 壳）、magisk/shenfa-core（Root 模块）。

## 关键事实
- git 只有 1 个 commit（48d7256，v0.1.0 准备），0.2.0~0.7.0 共 6 个版本的成果全是未提交的工作区改动。欠账随版本增长持续扩大。
- Release APK 使用 debug 签名，仅可测试；APK 已按 .gitignore 排除。
- 代码总量 1742 行（0.3 时），最大单文件 214 行（MyScreen.tsx）；0.4~0.7 新增账单导入（statement-import）、银行 Provider、Magisk 账单发现等，规模已远超此数，未重测。
- 项目演进文档在 docs/superpowers/{plans,specs}，按"计划→规格"成对记录。
- 2026-10-18 起接入 LDPlayer 模拟器 + Magisk 打通 Root 模块链路。

## 用户的 Codex 全局指令（重要，2026-10-18 核实）
- 「Codex 指令」= `C:\Users\Administrator\.codex\AGENTS.md`，**源文件**是 `C:\Users\Administrator\Desktop\taolun\AGENTS.md`，两者当前完全一致（12717 字节 / 128 行）。
- 维护说明在 `C:\Users\Administrator\Desktop\taolun\AGENTS-维护说明.md`：安装位置、同步命令、加载机制、备份回滚、版本记录都在那里。
- **硬约束**：全局 + 项目 AGENTS.md 合计上限 **32768 字节**（`project_doc_max_bytes`），超出**尾部截断**。当前 12717 + 自定义 6628 = 19345，余 13423。
- 加载时机：仅会话启动时读一次，改完必须重开会话。`AGENTS.override.md` 存在时**整体替换**而非合并。
- 改完生效文件后要同步回 taolun 源文件，否则下次从源同步会冲掉界面里的编辑。

## 如何读 Codex 的操作（2026-10-18 起改用 codelog）
- **首选**：读 `<项目>/logs/codex-changes.jsonl`，一行一 JSON，三种 kind：
  `change`（工具调用 + 文件动作 + args_preview）、`snapshot`（git 分支/脏文件/diffstat）、`summary`（task/why/verify/rollback）。
  阅读顺序：先 summary 知意图 → 同 session 的 change 知动作 → snapshot 的 dirty_files 交叉验证。
- 工具在 `D:\tools\codelog\`，调用一律走 `codelog.cmd`（系统 python 缺 zstandard 会静默跳过 .zst 会话）：
  `check --project .`（日常）、`summary --task/why/verify/rollback`（收尾补意图）、`report --tail N [--json]`（只读）。
  `--dry-run` 只预览不落盘；`--out` 可隔离到别处。
- 自动触发：`~/.codex/hooks.json` 的 `SessionEnd[1]` 跑 `hook_sessionend.py`，会话结束对当前项目 check。
  日志 `D:\tools\codelog\logs\hook.log`，出现 `run cwd=... rc=0` 即生效；非项目目录会 `skip`。
  钩子首用需在 Codex 里点一次信任（哈希存 config.toml 的 [hooks.state]）。
- 两个事实源互补：sync 答"谁改的"（会话日志），scan 答"到底改了什么"（磁盘指纹，跳过 node_modules/.git/logs 等）。
- **本项目状态**：2026-10-18 05:38 时 shen 下还没有 logs/，`--dry-run` 实测会新增 156 条（155 change + 1 snapshot），覆盖 5 个历史会话。尚未真实落盘。
- `.gitignore` 已补 `logs/`；流水不进版本库，换机后可用 `sync` 从 `~/.codex/sessions/` 重建。

## 如何读用户在 Codex 里的操作（旧路径，兜底用，已验证 2026-10-18）
- 主存储：`C:\Users\Administrator\.codex\thread_history_1.sqlite`，表 `thread_items`
  （字段 thread_id, turn_id, item_json, item_type, created_at_ms）。
  item_type 含 commandExecution / fileChange / agentMessage / mcpToolCall / imageView，fileChange 的 item_json 里带完整 diff。
- 原始会话：`C:\Users\Administrator\.codex\sessions\YYYY\MM\DD\rollout-*.jsonl`（早期为 .jsonl.zst），
  首行 session_meta 含 cwd，可据此过滤本项目。
- 本项目主线 thread：`01a13c20-9fd5-70f3-aaea-72deb8650f72`（名"神行"），10-15 04:36 → 10-17 05:50。
- 只读访问方式：sqlite3 URI `file:...?mode=ro` + uri=True，勿写入（Codex 可能在运行，有 WAL 锁）。
- 局限：只能看到"改了什么"，看不到"为什么"；跨 thread 上下文断裂；依赖 Codex 内部 schema（当前 cli 0.162.0-alpha.17.2）。

## 金额口径三决策（2026-10-18 用户拍板，修地基的依据）
1. **导入账单必须扣账户余额**（存款数字才真实）。代价：必须解决重复导入重复扣——现有去重靠 id 前缀 `import_*`→`tx_*`，确认后即失效，需改为稳定业务键（订单号+金额+时间）落在 transaction 上。
2. **废弃 goal.savedAmount，采用方案 B（剔除同期收入）**：`已存 = 当前余额 − startBalance − 期间总收入`，进度 clamp 到 0~1。期间收入只算 `type=income 且 eventKind≠refund`、不含 transfer、时间 `>= startBalanceAt`。分子为负时进度显示 0% 但必须提示"距起点多花 ¥X"，不能静默 0%。依赖余额真实 + 收入记全，否则虚高。
3. **月度还款金额由用户选择**：每笔债务可选"按最低还款"或"全额还完"，进预算按所选模式；逾期无论如何都要进预算且标红（现有代码 filter 掉了逾期）。

## 0.8+ 产品路线（2026-10-18 用户提出 7 条，方向性）
1. 同步账号（联网同步，替代本地；需定后端 + 多端冲突合并）
2. 工资/考勤引擎（动态计薪：底薪+计薪日+加班+餐补+全勤，下班确认通知，发薪日 15 号）
3. 神罚模式（默认超级严厉，每笔苛刻）
4. 状态栏常驻（存了多少 / 目标 / 缺口）
5. 首页算力分析（替代"预算依据"，AI 综合分析工资/消费）
6. 代还导入改连手机 app 同步（同 1，第三方对接，合规/稳定性风险）
7. 动效（声音+动画+丝滑）
我的判断分三量级：轻（3/4/7）、重（2/5）、巨量+合规风险（1/6）。
贯穿矛盾：神罚的"苛刻"vs 丝滑的"不难受"；苛刻省钱 vs Root/无障碍对接第三方的不稳。
关键待拍板：计薪口径（21.75 vs 26 vs 实际出勤）、税社保、算力是否真调 LLM、同步后端选型。

## 第六条穷究结论（2026-10-18 全网搜证）
- 用户澄清：第 1/6 条 = 直接连接各大 App（支付宝/微信/银行）同步账单/代还。
- 官方 API 只对**商户/服务商**开放（微信支付 v3、支付宝 open API 对账单接口），个人用户拿不到。
- 个人唯一合规官方路 = 手动导出账单文件（微信"用于个人对账"CSV→邮箱，支付宝"开具交易流水证明"→邮箱，解压码公众号/身份证后6位）——即现有 statement-import 已做的那条。
- 无障碍读屏 = 已定性违规：中国软协《可访问性安全要求》禁滥用；成都 AutoCMD+ 被罚 3 万（不正当竞争）；豆包 AI 手机被微信/支付宝/银行集体封杀。技术上也脆弱（App 改版即失效+封号）。
- Root 读库 = 现有 Magisk 路径，同有封号/合规风险，银行 App 检测 Root 拒运行。
- 截图识别（蜜蜂记账方案）= 合规稳定，但要用户手动截图。
- 结论：个人开发者"直连 App 实时同步"无合规可靠路径；现实只有 手动导出文件 / 截图 / 通知监听(已做,覆盖低) 三条。

## 第八条现状分析摘要（2026-10-18 Explore 全量排查）
- 最脆弱点：**金额事实源**。账户余额/月度预算/目标储蓄/债务余额四套口径各自计算，账单导入又刻意不改余额，叠加无校验无事务的整包 AsyncStorage 写入 → 金额永久错位且无法应用内修复。
- 代表 bug：storage.loadState 无 try/catch（脏数据永久白屏）；index.tsx 闭包 state + 并发写覆盖丢交易；通知 consume 先清后返、失败无重试；NotificationCapture id 哈希同分钟同额碰撞；还款本金 amount/principalAmount 不一致；时区 slice(0,16) 截 UTC 早 8 小时；FinanceBridge 的 ACTION_NOTIFICATION_LISTENER_SETTINGS 常量写错。
- 代表冲突：savedAmount 全项目无写入点（目标进度永远停初值）；upcomingRepayments 累加本金而非 minimumPayment 且漏逾期；导入不改余额→存款虚高；退款判成 income 抬高预算；待还页无新增欠款入口。
- 设计问题：app/index.tsx 单文件 God Component；integration 反向 import features；ports/stubs 零引用名存实亡；calculations 死代码形成第二套公式。
- 隐患：magisk service.sh 常驻轮询与规格矛盾；bill-scan 复制任意敏感文件且无清理；明文 SharedPreferences + allowBackup；xlsx@0.18.5 已知漏洞。
