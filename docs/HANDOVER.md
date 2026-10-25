# 神罚（strict-ledger）交接文档

> 最后更新：2026-10-26 ｜ 交接背景：v2 推翻重构方案已定稿，`feat/v2` 分支就绪，M1 待开工
> 本文件是活文档：每次大节点交接时整体更新，保持「新会话零上下文可接手」。

## 0. 新会话必读（3 分钟）

1. 先读仓库根 `AGENTS.md`——项目最高规范（提交须用户点头、codelog 留痕、core 红线、动原生/magisk 先问）。**注意其 §8「当前欠账」已过时**：欠账已于 2026-10-25 清偿，现在仓库有完整提交历史。
2. v2 重构方案：`docs/superpowers/specs/2026-10-25-v2-rewrite-design.md`（设计稿）+ `docs/superpowers/plans/2026-10-25-v2-rewrite.md`（执行计划 M1-M7）。接手开发从这两份开始。
3. 当前分支 `feat/v2`（自 main 起），工作区干净。main 上是 v1 完整可用状态（0.9.0 + Phase 1 清理）。
4. 留痕：每轮改动跑 `D:\tools\codelog\codelog.cmd check --project .`，收尾补 `summary`（task/why/verify/rollback 不许空话）。

## 1. 项目事实速览

- 个人财务 Android App，包名 `com.strictledger.app`，产品核心不是记账是**控制可花额度**（今日可花 hero + 金额折算工作时长「神罚」效果——经三轮竞品调研确认为全市场独家差异化，v2 强化不砍）。
- v1：Expo 52 / RN 0.76 / TS；`src/core` 纯函数层（零 React，193 个测试）是最大资产；单路由壳 `app/index.tsx`（427 行上帝组件）是最大债务。
- 仓库位置是既成事实 `C:\Users\Administrator\Desktop\shen`，**不许迁移**（Android 构建缓存/绝对路径依赖）。
- Magisk 模块 `magisk/shenfa-core/`（Root 环境跑，改动要先问）；Kotlin 原生侧在 `android/app/src/main/java/com/strictledger/app/`。

## 2. 仓库当前状态（2026-10-26）

```
分支：feat/v2（当前，含 v2 方案文档）｜ main（v1 可用）｜ refactor/phase1-cleanup（已合并，可删）
工作区：干净
```

本会话产生的 main 提交链（旧→新）：

| 提交 | 内容 |
|---|---|
| `268d0ae` | feat: 统一账单去重键并发布 0.9.0（清偿 git 欠账，20 文件） |
| `abd7d86` | docs: 更新 AGENTS.md 留痕约定 |
| `cbc1e5b` | chore: 清空内置个人默认数据（默认值中性化 + 测试显式夹具化） |
| `942fe63` | refactor: Phase 1 等价清理（40 文件 +218/−399：工具函数收敛/死码删除/useThemedStyles/ChoiceChip/providers 词汇表） |
| `aa4dc1e` | docs: v2 设计稿与执行计划（feat/v2 上） |
| `aa4dc1e` 后一提交 | docs: v2 方案第三轮调研修订（SDK 57、安全基线、搜索/周期记账进 1.0） |

验证基线：`npm run typecheck` 0 错误；`npm test` 37 套件 193 用例全绿。

## 3. v2 方案核心（详见 spec，此处为索引）

**推翻四层底盘**：存储（AsyncStorage 单键 JSON → expo-sqlite+drizzle，SQLCipher 加密）、导航（假 tab → Expo Router）、状态（props 管道 → Zustand 分域 store+selector）、自动记账（Kotlin 硬编码分类 → raw_events 落库+ack+规则表化）。

**已拍板决策**（spec §2，D1-D6）：1.0 = 底盘替换 + 五增强（quickAdd 两步流/标题联想/统计图表/账单搜索/周期记账）；导入规则外置 YAML 结构 + AI 兜底接口仅预留（BillParseProvider）；去重模糊命中降级「疑似重复」；中性交易（不计收支）第四种 kind；待还 1.0 走还款日历方向；big-bang 分支制。

**技术栈定论**（spec §3，2026-10 实测核实）：**Expo SDK 57**（不是 54——54 支持期已结束；57 于 2026-06 发布无破坏性变更；58 最新但太新）、RN 0.86、drizzle-orm 0.45.4、zustand 5、MMKV、保留 token+useThemedStyles、gifted-charts、Maestro。明确不用清单见 spec。

**安全基线 P0**（spec §10，M1/M7 落地）：SQLCipher（`useSQLCipher` + `PRAGMA key` + `cipher_version` 自检，密钥存 SecureStore）、`allowBackup=false`、正式签名替换 debug（debug 凭据公开可被同签名覆盖攻击）、备份 zip 内嵌 DB 密钥。

**关键风险**（spec §8）：Expo 52→57 升级单独提交；Android 15 起 untrusted 通知监听 OTP 脱敏——M6 首任务是 Android 15/16 真机验证关；SQLCipher 密钥丢失=数据全失，靠备份内嵌密钥闭环。

## 4. 下一步：M1 任务清单（拿起来就能做）

分支 `feat/v2` 上按序执行，每项完成 typecheck+test，M 完成给提交建议等用户点头：

1. **Expo 52 → SDK 57**：`npx expo install expo@^57 --fix` → expo-doctor → android/ 重新 prebuild（注意 57 默认 clean，需保留处 `--no-clean`；必须 ≥57.0.9 修 Hermes 回归）。单独提交，真机验证 v1 功能不回归后再继续。
2. 安全 P0：app.json 插件 `useSQLCipher`、`PRAGMA key`/`cipher_version` 自检、`allowBackup=false` + dataExtractionRules、MMKV 引入（`src/lib/kv.ts`）。
3. expo-router：`app/_layout.tsx` + `app/(tabs)/` 五占位页，删假 tab，deep link scheme 验证。
4. drizzle：`src/db/schema.ts`（spec §4 的 14 张表）、drizzle-kit 首次迁移、`client.ts`（Provider + useMigrations + PRAGMA 前置）、Metro asset 打包验证。
5. Zustand 样板 store + 主题 Provider 链迁移 + core 挂 home 占位页 + Maestro 冒烟（启动/切主题）。

M2-M7 见执行计划。动 `android/`、Gradle、app.json 版本号、magisk/ 都要先问用户（AGENTS.md §5）。

## 5. 关键文件索引

| 文件 | 作用 |
|---|---|
| `docs/superpowers/specs/2026-10-25-v2-rewrite-design.md` | v2 设计稿（决策/schema/流程/风险/安全） |
| `docs/superpowers/plans/2026-10-25-v2-rewrite.md` | v2 执行计划（M1-M7 任务级清单 + backlog） |
| `AGENTS.md` | 项目规范（先读；§8 已过时） |
| `src/core/` | 纯函数层（v2 原样保留的核心资产） |
| `src/core/model/providers.ts` | provider 中文名唯一词汇表（Phase 1 新增） |
| `src/ui/hooks/useThemedStyles.ts` | 主题样式统一 hook（18 文件在用） |
| `logs/codex-changes.jsonl` | codelog 留痕（change/snapshot/summary/file_change 四种 kind） |
| `D:\projects\autoaccounting` | AutoAccounting 本地克隆（自动记账参照，调研用） |

## 6. 已知问题与待办杂项

- `AGENTS.md` §8「仓库只有 1 个 commit」已过时，待更新（改 AGENTS.md 前建议先问用户）。
- `refactor/phase1-cleanup` 分支已合并，可删（`git branch -d`）。
- 根目录历史截图/APK 是遗留物，别新增别删（AGENTS.md §6）。
- 仓库无 `.gitattributes`，补它会产生全仓行尾 diff，单独提交并先告知影响面（AGENTS.md §8 已知缺项）。
- v2 发布 1.0.0 前需完成正式签名（spec §10 P0 有完整步骤）；debug 签名 APK 不能对外分发。
- 三轮调研结论已存 ZCode 项目记忆（`shen-v2-rewrite-research` 等），但以仓库内 spec 文档为准。
