package com.strictledger.app

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.util.Base64
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import java.nio.charset.Charset
import java.util.concurrent.TimeUnit

class FinanceBridgeModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "FinanceBridge"

  @ReactMethod fun isNotificationAccessEnabled(promise: Promise) {
    val enabled = Settings.Secure.getString(reactApplicationContext.contentResolver, "enabled_notification_listeners")
      ?.contains(reactApplicationContext.packageName) == true
    promise.resolve(enabled)
  }

  @ReactMethod fun openNotificationAccessSettings(promise: Promise) {
    try {
      val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) { promise.reject("settings-unavailable", error) }
  }

  @ReactMethod fun getRootStatus(promise: Promise) {
    val indicators = listOf("/system/bin/su", "/system/xbin/su", "/sbin/su", "/system/app/Superuser.apk", "/data/adb/magisk")
    promise.resolve(if (indicators.any { File(it).exists() }) "detected" else "not-detected")
  }

  @ReactMethod fun startStatusService(text: String, promise: Promise) {
    try {
      FinanceStatusService.start(reactApplicationContext, text)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("status-service-start-failed", error)
    }
  }

  @ReactMethod fun updateStatusService(text: String, promise: Promise) {
    try {
      FinanceStatusService.update(reactApplicationContext, text)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("status-service-update-failed", error)
    }
  }

  @ReactMethod fun stopStatusService(promise: Promise) {
    try {
      FinanceStatusService.stop(reactApplicationContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("status-service-stop-failed", error)
    }
  }

  @ReactMethod fun readStatementFile(uri: String, promise: Promise) {
    try {
      val bytes = openStatementStream(uri).use { it.readBytes() }
      val utf8 = String(bytes, Charsets.UTF_8)
      val text = if (utf8.contains('\uFFFD')) String(bytes, Charset.forName("GBK")) else utf8
      promise.resolve(text)
    } catch (error: Exception) {
      promise.reject("statement-file-read-failed", error)
    }
  }

  @ReactMethod fun readStatementFileBase64(uri: String, promise: Promise) {
    try {
      val bytes = openStatementStream(uri).use { it.readBytes() }
      promise.resolve(Base64.encodeToString(bytes, Base64.NO_WRAP))
    } catch (error: Exception) {
      promise.reject("statement-file-read-failed", error)
    }
  }

  private fun openStatementStream(uri: String): InputStream {
    return when {
      uri.startsWith("content://") -> reactApplicationContext.contentResolver.openInputStream(Uri.parse(uri))
      uri.startsWith("file://") -> FileInputStream(File(Uri.parse(uri).path ?: throw IllegalArgumentException("Invalid file URI")))
      else -> FileInputStream(File(uri))
    } ?: throw IllegalStateException("Unable to open statement file")
  }
  @ReactMethod fun consumeNotificationCandidates(promise: Promise) {
    val result: WritableArray = WritableNativeArray()
    NotificationCapture.consume(reactApplicationContext).forEach { event ->
      val item = WritableNativeMap()
      item.putString("id", event.id)
      item.putString("type", event.type)
      item.putDouble("amount", event.amount)
      item.putString("source", "notification")
      item.putString("occurredAt", event.occurredAt)
      item.putString("provider", event.provider)
      event.eventKind?.let { item.putString("eventKind", it) }
      event.eventStatus?.let { item.putString("eventStatus", it) }
      event.counterparty?.let { item.putString("counterparty", it) }
      item.putDouble("confidence", event.confidence)
      result.pushMap(item)
    }
    promise.resolve(result)
  }

  @ReactMethod fun getMagiskModuleStatus(promise: Promise) {
    try {
      promise.resolve(moduleStatusMap(readModuleStatus()))
    } catch (error: Exception) {
      promise.reject("magisk-status-unavailable", error)
    }
  }

  @ReactMethod fun setMagiskModuleFeature(feature: String, enabled: Boolean, promise: Promise) {
    if (feature !in listOf("notificationCapture", "repaymentDetection", "billScan", "rootEnhancement", "cloudSync", "moduleEnabled")) {
      promise.reject("magisk-feature-invalid", "Unknown module feature")
      return
    }
    try {
      val value = if (enabled) "1" else "0"
      runRootCommand("$MODULE_DIR/bin/shenfa-module set-feature $feature $value")
      promise.resolve(moduleStatusMap(readModuleStatus()))
    } catch (error: Exception) {
      promise.reject("magisk-feature-write-failed", error)
    }
  }
  @ReactMethod fun requestBillScan(promise: Promise) {
    try {
      runRootCommand("$MODULE_DIR/bin/shenfa-module scan-request")
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("bill-scan-request-failed", error)
    }
  }
  @ReactMethod fun listModuleInbox(promise: Promise) {
    try {
      val externalFiles = reactApplicationContext.getExternalFilesDir(null)
        ?: File("/sdcard/Android/data/com.strictledger.app/files")
      val inbox = File(externalFiles, "import-inbox")
      val manifest = File(inbox, "manifest.tsv")
      val result: WritableArray = WritableNativeArray()
      if (manifest.exists()) {
        manifest.readLines().drop(1).forEach { line ->
          val parts = line.split('\t')
          if (parts.size >= 6) {
            val item = WritableNativeMap()
            item.putString("inboxName", parts[0])
            item.putString("displayName", parts[1])
            item.putString("size", parts[2])
            item.putString("modifiedAt", parts[3])
            item.putString("digest", parts[4])
            item.putString("source", parts[5])
            item.putString("uri", "file://${File(inbox, parts[0]).absolutePath}")
            result.pushMap(item)
          }
        }
      }
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("module-inbox-read-failed", error)
    }
  }
  private fun readModuleStatus(): ModuleStatus {
    val output = runRootCommand("$MODULE_DIR/bin/shenfa-module status")
    var installed = false
    var version = ""
    val config = mutableMapOf(
      "moduleEnabled" to true,
      "notificationCapture" to true,
      "repaymentDetection" to true,
      "billScan" to true,
      "rootEnhancement" to true,
      "cloudSync" to false,
    )
    output.lineSequence().forEach { line ->
      val separator = line.indexOf('=')
      if (separator <= 0) return@forEach
      val key = line.substring(0, separator)
      val value = line.substring(separator + 1)
      when (key) {
        "installed" -> installed = value == "1"
        "id" -> installed = true
        "version" -> version = value
        "module_enabled" -> config["moduleEnabled"] = value == "1"
        "notification_capture" -> config["notificationCapture"] = value == "1"
        "repayment_detection" -> config["repaymentDetection"] = value == "1"
        "bill_scan" -> config["billScan"] = value == "1"
        "root_enhancement" -> config["rootEnhancement"] = value == "1"
        "cloud_sync" -> config["cloudSync"] = value == "1"
      }
    }
    return ModuleStatus(installed, version, config)
  }

  private fun moduleStatusMap(status: ModuleStatus): WritableNativeMap {
    val result = WritableNativeMap()
    result.putBoolean("available", true)
    result.putBoolean("installed", status.installed)
    result.putString("version", status.version)
    val config = WritableNativeMap()
    status.config.forEach { (key, value) -> config.putBoolean(key, value) }
    result.putMap("config", config)
    return result
  }

  private fun runRootCommand(command: String): String {
    var lastError: Exception? = null
    for (binary in listOf("/system/bin/su", "/system/system_ext/bin/su", "su")) {
      try {
        val builder = ProcessBuilder(binary, "-c", command).redirectErrorStream(true)
        builder.environment()["PATH"] = "/system/bin:/system/system_ext/bin:" + (builder.environment()["PATH"] ?: "")
        val process = builder.start()
        if (!process.waitFor(15, TimeUnit.SECONDS)) {
          process.destroyForcibly()
          throw IllegalStateException("root-command-timeout")
        }
        val output = process.inputStream.bufferedReader().use { it.readText() }
        if (process.exitValue() != 0) throw IllegalStateException("root-command-failed: $output")
        return output
      } catch (error: Exception) {
        lastError = error
      }
    }
    throw lastError ?: IllegalStateException("root-command-unavailable")
  }

  private data class ModuleStatus(val installed: Boolean, val version: String, val config: Map<String, Boolean>)

  companion object {
    private const val MODULE_DIR = "/data/adb/modules/shenfa-core"
    private const val MODULE_CONFIG_DIR = "$MODULE_DIR/config"
    private const val MODULE_CONFIG_PATH = "$MODULE_CONFIG_DIR/active.conf"
    private const val MODULE_PROP_PATH = "$MODULE_DIR/module.prop"
  }
}
