# 肥鱼的米饭（feiyu-ledger）

纯粹、好用、好看的记账本。Android 个人记账 App，先见账、再见洞察：打开就是账本（总余额 + 按天分组的流水），"花到哪了"藏在独立统计页。

## 定位

- 神罚（工时惩罚）已整个移除，App 只记账、不审判。
- 账户级余额：微信 / 支付宝 / 银行卡各剩多少，初始余额开记时填一次，之后全靠流水自动滚（转账记两腿）。
- 支出两级分类（大类套小类）、收入四类（工资/副业/报销/其他），全部可自定义增删改。
- 完整表单记账：金额、分类、账户、备注、日期一次填全，可补记过去任意日期。
- 视觉：默认暗色 + 暖橙琥珀点缀，设置里可切浅色；动效三档可配（记账成功 / 页面转场 / 数字滚动）。
- 数据：SQLCipher 加密 SQLite，本地存储；CSV 导出 + 密码加密备份（AES-256-GCM）可换机恢复。

## 技术栈

- Expo SDK 58 / React Native 0.88 / React 19.3 / TypeScript
- expo-router（文件路由）、expo-sqlite + drizzle-orm（加密库）、zustand（分域 store）、react-native-mmkv（偏好）、react-native-reanimated（动效）、react-native-gifted-charts（统计图表）、expo-crypto / expo-secure-store（密钥与备份）

## 目录结构

- `src/core`：纯函数层（金额/余额/分类/币种/种子/分组/过滤/备份格式），不依赖 React，可脱离 UI 单测
- `src/data`：drizzle schema（单一事实源）、手写 DDL、SQLite 接入
- `src/features`：zustand store（ledger / accounts / categories / settings / onboarding / backup）
- `src/ui`：主题与可复用组件（日历、分类选择器、数字滚动、记账成功动效）
- `app`：Expo Router 页面（index / add / stats / accounts / categories / settings / search / transaction/[id] / onboarding）

## 启动

```bash
npm install
npm start        # 开发（Metro）
```

## 验证

```bash
npm run typecheck              # 类型检查
npm test                       # 单元测试（jest）
npx expo export --platform android   # JS 打包验证
```

## Release 构建

```powershell
cd android
.\gradlew.bat assembleRelease --no-daemon --max-workers=2
```

产物（ABI split，每个架构一个包）：

- `android/app/build/outputs/apk/release/app-arm64-v8a-release.apk`
- `android/app/build/outputs/apk/release/app-armeabi-v7a-release.apk`

**签名**：release 用独立 keystore，文件在仓库根 `keys/` 下（被 `.gitignore` 排除）：

- `keys/feiyu-release.keystore` — keystore 本体（RSA 2048，alias `feiyu`）
- `keys/keystore.properties` — `storeFile=../../keys/feiyu-release.keystore` + 三个密码

**发布配置自动落回**：`app.json` 注册了 `./plugins/withReleaseBuild` config plugin。每次 `npx expo prebuild --platform android` 重生成 `android/` 后，以下三件事自动生效，无需手工改 Gradle：

1. `android/gradle.properties`：ABI 双架构（armeabi-v7a、arm64-v8a）+ 资源收缩开关
2. `android/app/build.gradle`：release 签名块（读 `keys/keystore.properties`）+ ABI split + 分架构 versionCode（arm64 `1xxxxx`、armv7 `2xxxxx`）
3. `android/settings.gradle`：`rootProject.name` 固定英文 `feiyu-ledger`（中文名会让 Gradle 报 Invalid file path）

`keys/` 不存在或缺少 keystore 时，release 构建产出未签名 APK（不可安装），仅用于验证构建链路。**keystore 与密码只在本机，换机/重装前必须自行备份这两个文件。**

## 数据与备份

- 数据库：`feiyu-ledger.db`（SQLCipher 加密，密钥存 SecureStore，`allowBackup=false`）
- 偏好：MMKV（主题、动效档位、流水显示开关、月预算）
- 导出：设置页 → CSV（Excel 可直接打开）；设置页 → 导出加密备份（自设密码，AES-256-GCM，恢复时覆盖全部数据）

## 版本与发布

- 版本号 `2.x.0` 递增，每次发布 Android `versionCode` 加 1，`CHANGELOG.md` 记录用户可见变化。
- 需求文档：`docs/superpowers/specs/2026-11-16-rewrite-requirements.md`（46 项决策）。
- 开发在 `feat/v2` 分支；`main` 保留 v1（神罚 0.9.0），数据不迁移。
