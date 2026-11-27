# AGENTS.md（项目级 · 肥鱼的米饭 / feiyu-ledger）

> 覆盖顺序：本文件 > `~/.agents/AGENTS.md`（全局）> 记忆。**仅限偏好类条款；全局文件头九个词所说的硬约束（授权清单、删除、数据安全）本项目不得覆盖，只能加严。**
> 全局已写清的（授权清单、代码质量红线、日志、Git 规则）不在这里重复，只做项目相关的收窄或加严。

**必读（其余各节都是这三条的展开）**

1. 每轮改动后跑 `D:\tools\codelog\codelog.cmd check --project .`，收尾补一条 `summary`。外部 agent 靠 `logs/codex-changes.jsonl` 接手上下文，不补等于这轮说不清。
2. 提交只提建议、不自己执行——`git commit` 在全局 §2 属于「必须先问」，本项目不放宽。
3. 开发在 `feat/v2` 分支进行，`main` 保留 v1（神罚 0.9.0）。神罚旧资产已从 `feat/v2` 删除，不再回看。

## 1. 项目事实

- 个人财务 Android App，Expo 58 + React Native 0.88 + TypeScript，包名 `com.strictledger.app`。
- 产品是**纯粹、好用、好看的记账本**：首页先见账（总余额 + 按天分组的流水），洞察藏在独立统计页。神罚（工时惩罚）整个拿掉。
- 版本 `2.0.0`，`versionCode 11`。需求文档 `docs/superpowers/specs/2026-11-16-rewrite-requirements.md`（46 项决策），技术决策文档随 M1 落地。
- 分层：`src/core`（纯计算，**不依赖 React**）→ `src/data`（drizzle schema / SQLite 接入）→ `src/features`（zustand store）→ `app`（Expo Router 页面）。
- **仓库位置是既成事实**：`C:\Users\Administrator\Desktop\shen`。这早于磁盘规范（项目应放 `D:\projects\`）建立，不是新决定。**不要擅自迁移目录**——移动会打断 Android 构建缓存和 Expo 的绝对路径引用，要迁必须单独提出来讨论。

## 2. 留痕与提交

留痕走全局 §8 的 codelog 机制，**本项目不再另写日志文件**。理由：会话日志加磁盘指纹是**不依赖模型配合**的事实源，比"让模型记得写 markdown"可靠——模型忘了写就是丢了，而会话日志忘不掉。

- 每轮改动后跑 `D:\tools\codelog\codelog.cmd check --project .`；收尾补一条 `summary`（task / why / verify / rollback），**`--session` 现在会自动填**（读 `CODEX_SESSION_ID` / `DSH_SESSION_ID` 等），都取不到才落 `unknown`——挂不回任何 change 时只能按时间就近猜（历史上 61 条 summary 的 session 全是空的）。
- `summary` 里的 why / verify / rollback 只有模型能提供，会话日志里没有。这是唯一必须自觉填的部分，不许省、不许写空话——「为什么」要写能复用的判断，比如"X 方案会让 core 依赖 React，破坏分层"。
- `logs/` 已在 `.gitignore` 里，不进版本库。换机器或清目录后用 `sync` 可从 `~/.codex/sessions/` 重建，历史不丢。
- 提交由我点头后才执行（全局 §2 的边界，本项目不放宽）。完成一个可独立验证的功能点后，主动给一条提交建议：改了什么、为什么、验证结果。不攒到最后一次性提交，也不每改一个文件提一次。提交信息中文，一次一件事。

### 2.1 给外部读取方的约定

`logs/codex-changes.jsonl` 一行一条 JSON，**四种** `kind`：`change`（工具调用 + 文件动作）、`snapshot`（git 快照）、`summary`（意图）、`file_change`（磁盘指纹对账，由 `scan` 写）。

`D:\tools\codelog\README.md` 已补齐四种的字段说明（第 3 轮改造时补的），但字段语义以 `..\追溯机制\docs\agent-traceability.md` 为准（2026-10-24 已搬出本仓库，与本仓库同级）——那里写了可靠性排序、已知失真与复算方法。

**不要在本项目里另造格式或另写一份日志**——两套留痕就是屎山的起点。

## 3. 验证口径

按改动范围取最窄一档，能跑全量才跑全量：

```powershell
npm run typecheck          # 类型检查
npm test                   # 单元测试（jest）
npx expo export --platform android   # 打包验证，改动涉及原生或入口时
```

- 没跑过的不许说"测试通过"。失败就贴原始输出，不粉饰。
- 只改 Markdown 时核对链接和路径即可，不用跑测试。
- 改动涉及 `android/` 原生代码时，必须说明是否实际构建过，没构建要直说。

## 4. 不要破坏的边界

- `src/core` 里不许出现 `react`、`react-native` 的任何 import。它是纯函数层，要能脱离 UI 单测。
- `src/data/schema.ts` 是表结构单一事实源；`src/data/initSql.ts` 的手写 DDL 必须与之一一对应（不用 drizzle-kit）。
- `app/index.tsx` 只做壳：状态编排和路由。页面逻辑下沉到 `src/features`，别往壳里堆。
- 新增领域计算放 `src/core` 对应子目录，配套写 `.test.ts`；新增页面逻辑放对应 feature 目录。

## 5. 本项目必须先问的额外事项

全局授权清单之外，这几项也要先问：

- 新增原生依赖或改 `android/` 下的 Gradle 配置、Manifest 权限。
- 改 `app.json` 的版本号、`versionCode`、包名、scheme。
- 构建并分发 APK（构建本身可做，分发是外部写入）。
- 动 `magisk/shenfa-core/` 的任何脚本——它跑在 Root 环境，改错的代价比普通代码高。

## 6. 不进仓库的东西

`*.apk`、`*.aab`、`artifacts-*.png`、`artifacts-*.xml`、根目录的 `android-*.png` 截图、`node_modules/`、`dist/`、`.expo/`、`.superpowers/`、`.tmp/`。

根目录现在散落着几十个 UI 自动化截图，是历史遗留，不是源码。别新增，也别顺手删（要清理先问我）。

## 7. 版本与发布

- 版本号 `2.x.0` 递增，每次发布 `versionCode` 加 1，`CHANGELOG.md` 必写用户可见的变化。
- 正式分发前需要独立发布签名 + 密钥保管方案，这件事尚未做。**签名链已就位**：`keys/feiyu-release.keystore`（RSA 2048、alias feiyu）+ `keys/keystore.properties`（含密码，gitignored）；`plugins/withReleaseBuild.js` config plugin 在 prebuild 时自动落回签名/ABI split/资源收缩/英文 rootProject.name。keystore 与密码只在本机，分发到新机器前需自行备份这两个文件。

## 8. 当前状态（进来先看一眼）

- 开发分支 `feat/v2`；`main` 是 v1（神罚 0.9.0），已封存不迁移数据。
- v1 的账不迁移到 v2（用户拍板），v2 从零记起。
- magisk/ 目录保留但不加载，不要顺手删（清理要先问）。

### 已知缺项

- 仓库没有 `.gitattributes`（全局要求 `* text=auto eol=lf`）。补它会产生一次全仓行尾 diff，**不要顺手加**，要单独作为一个提交，并先告诉我预计影响多少文件。
