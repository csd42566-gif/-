// withReleaseBuild.js — 发布构建配置插件（肥鱼的米饭）
//
// 作用：`npx expo prebuild` 重生成 android/ 后，自动落回三件发布配置，
// 不再需要手工重打补丁：
//   1. gradle.properties：ABI 双架构（armeabi-v7a + arm64-v8a）+ 资源收缩开关。
//   2. app/build.gradle：release 签名块（读 keys/keystore.properties）+
//      ABI split（每架构独立 APK）+ 分架构 versionCode 覆盖 + release 条件签名。
//   3. settings.gradle：rootProject.name 固定为英文名 'feiyu-ledger'
//      （prebuild 会用 app.json 的 name 生成中文名，中文路径会让 Gradle 报
//       "Invalid file path"）。
//
// 注册方式（app.json → expo.plugins）："./plugins/withReleaseBuild"
//
// 幂等性：三个 mod 都带已存在守卫；prebuild 每次从官方模板重生成这些文件，
// 所以 mod 收到的始终是模板态，重复运行不会产生重复块。

const {
  withAppBuildGradle,
  withGradleProperties,
  withSettingsGradle,
} = require('@expo/config-plugins');

const RELEASE_ABIS = ['armeabi-v7a', 'arm64-v8a'];

// build.gradle 在 android/app/ 下，相对它到仓库根 keys/ 是 ../../keys/
const KEYSTORE_PROPS_REL = '../../keys/keystore.properties';

module.exports = function withReleaseBuild(config) {
  config = withReleaseGradleProperties(config);
  config = withReleaseAppBuildGradle(config);
  config = withReleaseSettingsGradle(config);
  return config;
};

function withReleaseGradleProperties(config) {
  return withGradleProperties(config, (cfg) => {
    upsertProperty(cfg.modResults, 'reactNativeArchitectures', RELEASE_ABIS.join(','));
    upsertProperty(cfg.modResults, 'android.enableShrinkResourcesInReleaseBuilds', 'true');
    return cfg;
  });
}

function upsertProperty(properties, key, value) {
  const existing = properties.find(
    (item) => item.type === 'property' && item.key === key
  );
  if (existing) {
    existing.value = value;
  } else {
    properties.push({ type: 'property', key, value });
  }
}

function withReleaseAppBuildGradle(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    // ── 1. signingConfigs：debug 块后插入 release 块（读 keys/keystore.properties）──
    const debugSigningBlock = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;
    const signingWithReleaseBlock = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            // 自有 release keystore：keys/keystore.properties（gitignored）。
            // 文件不存在时该块为空，release 变体保持未签名。
            def keystorePropertiesFile = file("${KEYSTORE_PROPS_REL}")
            if (keystorePropertiesFile.exists()) {
                def keystoreProperties = new Properties()
                keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }`;
    if (contents.includes(debugSigningBlock) && !contents.includes('keystorePropertiesFile')) {
      contents = contents.replace(debugSigningBlock, signingWithReleaseBlock);
    }

    // ── 2. ABI split + 分架构 versionCode：插在 defaultConfig 结束之后 ──
    const defaultConfigTail = `        buildConfigField "String", "REACT_NATIVE_RELEASE_LEVEL", "\\"\${findProperty('reactNativeReleaseLevel') ?: 'stable'}\\""
    }
    signingConfigs {`;
    const splitsBlock = `    // 按 ABI 拆包：每个架构独立 APK，真机只装对应包，体积约减半。
    splits {
        abi {
            enable true
            reset()
            include '${RELEASE_ABIS.join("', '")}'
            universalApk false
        }
    }
    // ABI split 时不同架构包需要不同 versionCode（数字递增要求）。
    // arm64 高位 1、armv7 高位 2，保证两者独立升级互不冲突。
    applicationVariants.all { variant ->
        variant.outputs.all { output ->
            def abiName = output.getFilter(com.android.build.OutputFile.ABI)
            if (abiName != null) {
                output.versionCodeOverride = (abiName == 'arm64-v8a' ? 1 : 2) * 100000 + defaultConfig.versionCode
            }
        }
    }`;
    if (contents.includes(defaultConfigTail) && !contents.includes('按 ABI 拆包')) {
      contents = contents.replace(
        defaultConfigTail,
        defaultConfigTail.replace('    signingConfigs {', splitsBlock + '\n    signingConfigs {')
      );
    }

    // ── 3. buildTypes.release：条件签名（keystore 存在才签名）──
    const releaseDebugSigning = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;
    const releaseConditionalSigning = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            // 肥鱼的米饭：keys/keystore.properties 存在时用自有 release keystore 签名。
            if (file("${KEYSTORE_PROPS_REL}").exists()) {
                signingConfig signingConfigs.release
            }`;
    if (contents.includes(releaseDebugSigning) && !contents.includes('自有 release keystore 签名')) {
      contents = contents.replace(releaseDebugSigning, releaseConditionalSigning);
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

function withReleaseSettingsGradle(config) {
  return withSettingsGradle(config, (cfg) => {
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /rootProject\.name = .*/,
      "rootProject.name = 'feiyu-ledger'"
    );
    return cfg;
  });
}
