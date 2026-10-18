# AGENTS.md（项目级 · 神罚 / strict-ledger）

> 覆盖顺序：本文件 > `~/.codex/AGENTS.md`（全局）> 记忆。
> 全局已写清的（授权清单、代码质量红线、日志、Git 规则）不在这里重复，只做项目相关的收窄或加严。

**必读（其余各节都是这三条的展开）**

1. 每轮改动后跑 `D:\tools\codelog\codelog.cmd check --project .`，收尾补一条 `summary`。外部 agent 靠 `logs/codex-changes.jsonl` 接手上下文，不补等于这轮说不清。
2. 提交只提建议、不自己执行——`git commit` 在全局 §2 属于「必须先问」，本项目不放宽。
3. 仓库只有 1 个 commit，0.2.0/0.3.0 的成果全未提交。清欠账之前不要再叠加不相关改动。

## 1. 项目事实

- 个人财务 Android App，Expo 52 + React Native 0.76 + TypeScript，包名 `com.strictledger.app`。
- 产品核心不是记账，是**控制可花额度**：首页给今日可花 / 本月需存 / 未来待还，记账后弹预算平衡提醒，目标页反推每日应存。
- 版本 `0.3.0`，`versionCode 3`。演进文档在 `docs/superpowers/`，plan 与 spec 成对存在。
- 分层：`src/core`（纯计算，**不依赖 React**）→ `src/data` → `src/features` → `app`（Expo Router 壳）。`src/integrations` 只放端口和 stub，真实现落在 `android/` 原生侧。
- **仓库位置是既成事实**：`C:\Users\Administrator\Desktop\shen`。这早于磁盘规范（项目应放 `D:\projects\`）建立，不是新决定。**不要擅自迁移目录**——移动会打断 Android 构建缓存和 Expo 的绝对路径引用，要迁必须单独提出来讨论。

## 2. 留痕与提交

留痕走全局 §8 的 codelog 机制，**本项目不再另写日志文件**。理由：会话日志加磁盘指纹是**不依赖模型配合**的事实源，比"让模型记得写 markdown"可靠——模型忘了写就是丢了，而会话日志忘不掉。

- 每轮改动后跑 `D:\tools\codelog\codelog.cmd check --project .`；收尾补一条 `summary`（task / why / verify / rollback）。
- `summary` 里的 why / verify / rollback 只有模型能提供，会话日志里没有。这是唯一必须自觉填的部分，不许省、不许写空话——「为什么」要写能复用的判断，比如"X 方案会让 core 依赖 React，破坏分层"。
- `logs/` 已在 `.gitignore` 里，不进版本库。换机器或清目录后用 `sync` 可从 `~/.codex/sessions/` 重建，历史不丢。
- 提交由我点头后才执行（全局 §2 的边界，本项目不放宽）。完成一个可独立验证的功能点后，主动给一条提交建议：改了什么、为什么、验证结果。不攒到最后一次性提交，也不每改一个文件提一次。提交信息中文，一次一件事。

### 2.1 给外部读取方的约定

`logs/codex-changes.jsonl` 一行一条 JSON，三种 `kind`：`change`（工具调用 + 文件动作）、`snapshot`（git 快照）、`summary`（意图）。字段语义以 `D:\tools\codelog\README.md` 为准，**不要在本项目里另造格式或另写一份日志**——两套留痕就是屎山的起点。

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
- `src/integrations/ports.ts` 是端口契约。改签名要一次改完所有实现，不留半成品兼容。
- `app/index.tsx` 只做壳：状态编排和路由。页面逻辑下沉到 `src/features`，别往壳里堆。
- 新增领域计算放 `src/core/finance`，配套写 `.test.ts`；新增页面逻辑放对应 feature 目录。

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

- 版本号 `0.x.0` 递增，每次发布 `versionCode` 加 1，`CHANGELOG.md` 必写用户可见的变化。
- Release APK 目前用项目 debug keystore 签名，**只能测试，不能对外分发**。任何人问起都要说清这一点，不许含糊成"可以发布了"。
- 正式分发前需要独立发布签名 + 密钥保管方案，这件事尚未做。

## 8. 当前欠账（进来先看一眼）

- git 仓库只有 1 个 commit（v0.1.0 时建的），0.2.0 和 0.3.0 的全部成果都是**未提交的工作区改动**。
- 这意味着：没有版本快照、无法 diff 出两个版本之间的差异、回滚只能靠手。
- 在这个欠账清掉之前：**不要再往工作区叠加不相关的改动**，每个新改动都要说清它属于哪一块；提交时优先把已有改动按 0.2.0 / 0.3.0 拆开，而不是混在一起。

### 分支策略（对全局 §9 的例外）

全局规定「不在 `main` 上直接开发，改动走 `feat/` `fix/` 分支」。本项目现在与之不符，且**不打算在清欠账之前补上**：

- 当前只有 `main` 一个分支，20+ 个未提交改动全在 `main` 的工作区里。此刻切分支等于把这些改动带着跑，反而更难拆。
- 因此：**清欠账期间继续在 `main` 上工作**，不要主动建分支。要建分支先说明理由并等我确认（建分支本身也需要授权）。
- 欠账清掉之后恢复全局规则，新功能走 `feat/`。

### 已知缺项

- 仓库没有 `.gitattributes`（全局要求 `* text=auto eol=lf`）。补它会产生一次全仓行尾 diff，**不要顺手加**，要单独作为一个提交，并先告诉我预计影响多少文件。
