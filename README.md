# 神罚 Android MVP

第一版采用 Expo + React Native + TypeScript，先把核心记账闭环跑通：

- 首页：今日可花、本月还需存、未来待还、现金流风险卡片；
- 账本：收入、支出、转账分离，支持快速记一笔；
- 待还：债务时间线和还款后现金流预测；
- 目标：每日应存、每日最多可花、少花/多赚/延期方案；
- 我的：现金流风险卡片三档显示、Root/银行/云同步状态占位、脱敏日志；
- 记账后 B 平衡提醒弹窗；
- 本地 AsyncStorage 持久化；
- 纯 TypeScript 核心计算和日志脱敏测试。

## 启动

```bash
npm install
npm start
```

然后用 Expo Go 或 Android 模拟器打开项目。

## 验证

```bash
npm test
npm run typecheck
npx expo export --platform android
```

## 模块边界

- `src/core`：模型、计算、结果和日志，不依赖 React；
- `src/data`：本地存储和演示数据；
- `src/features`：页面和页面级交互；
- `src/ui`：主题和可复用组件；
- `src/integrations`：银行、通知、Root 的可替换接口和 MVP stub；
- `app`：Expo Router 入口和 App Shell。

银行聚合、通知监听、Root 模块、账号登录和云同步在这一版只保留接口边界，避免未验证的系统能力污染核心账本模块。

## 版本与发布

- 版本号按 `0.1.0`、`0.2.0`、`0.3.0` 递增；每次发布 Android `versionCode` 加 1。
- 每次版本更新都在 `CHANGELOG.md` 记录日期、变更和修复内容。
- 发布前运行 `npm test`、`npm run typecheck`，并构建、安装验证 Android Release APK。
- GitHub 使用私有仓库；源码推送到 GitHub，APK 附加到对应的 GitHub Release，不提交进源码仓库。

Android Release APK 构建命令：

```powershell
cd android
.\gradlew.bat assembleRelease --no-daemon --max-workers=2
```

产物位于 `android/app/build/outputs/apk/release/app-release.apk`。当前 Release 使用项目 debug 签名，仅用于测试；正式分发前需配置独立的发布签名。
