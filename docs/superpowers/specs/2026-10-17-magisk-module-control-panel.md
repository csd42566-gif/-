# 神罚 Magisk 模块与控制面板设计

## 目标

提供一个可从 Magisk 模块页打开的“神罚核心”模块。模块负责开机初始化、配置文件和入口脚本；复杂的控制面板由神罚 APK 渲染，避免在 Magisk 页面中重复实现 UI。

## 范围

首版模块包含四个可见能力开关：

- 消费监听：使用现有 Android 通知监听链路。
- 代还识别：使用现有通知分类链路，成功代还仍需人工确认并绑定欠款。
- Root 增强：仅提供模块存在、版本和配置状态，不读取其他 App 私有数据库，不注入支付 App。
- 云同步：展示为未接入状态，开关默认关闭；当前同步数据仍是本地数据。

模块不自动支付、转账、还款，不保存账号密码、支付 Token 或完整卡号，不执行未经用户操作的交易。

## 模块结构

```text
magisk/shenfa-core/
├── module.prop
├── action.sh
├── service.sh
├── uninstall.sh
├── config/default.conf
└── bin/shenfa-module
```

`action.sh` 通过 `strictledger://module-control` 启动神罚 APK。`service.sh` 在开机后创建运行配置和状态文件，不启动常驻守护进程。APK 通过受限的 Root bridge 读取和修改四个开关；所有可写字段使用白名单校验，不能拼接任意 shell 命令。

## 数据流

1. Magisk 安装模块并在开机阶段运行 `service.sh`。
2. 用户在 Magisk 模块页点击操作入口，`action.sh` 启动神罚 APK 的控制面板深链。
3. APK 调用 `FinanceBridge` 获取模块状态；没有模块或用户拒绝 Root 时显示不可用状态，不影响普通记账。
4. 用户切换开关后，APK 只写入模块配置中的白名单键。
5. 通知事件仍经现有待确认队列进入账本，Root 模块不直接修改账本交易。

## 错误与降级

- 没有 Magisk、模块未安装或 `su` 不可用：控制面板显示“不可用”，普通 App 功能继续运行。
- Root 授权被拒绝或命令超时：保持界面原值，记录脱敏日志。
- 配置文件缺失或损坏：模块恢复默认配置，APK 显示默认状态。
- 云同步未接入：按钮可见但不可开启，明确标注“待接入”。
- 深链无法启动 App：`action.sh` 输出错误并返回非零状态，不影响系统启动。

## 测试与验收

- Jest 覆盖模块配置解析、未知键拒绝、深链识别和默认状态。
- TypeScript 检查通过。
- Android Release 构建通过。
- Magisk ZIP 包含必需文件、脚本可执行位和正确 `module.prop`。
- 未安装模块的设备仍可正常启动 App；安装模块后从 Magisk 操作入口进入控制面板。
