package com.strictledger.app

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.LinkedHashMap
import java.util.Date
import java.util.Locale
import java.util.TimeZone

data class CapturedPayment(
  val id: String,
  val type: String,
  val amount: Double,
  val occurredAt: String,
  val provider: String,
  val confidence: Double,
  val eventKind: String? = null,
  val eventStatus: String? = null,
  val counterparty: String? = null
)

class NotificationCaptureService : NotificationListenerService() {
  override fun onListenerConnected() {
    super.onListenerConnected()
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val source = SOURCES[sbn.packageName] ?: return
    val extras = sbn.notification.extras
    val title = extras.getCharSequence("android.title")?.toString().orEmpty()
    val text = extras.getCharSequence("android.text")?.toString().orEmpty()
    val content = (title + " " + text).take(600)
    val type = when {
      listOf("支出", "付款", "支付成功", "扣款", "还款", "偿还", "待还").any(content::contains) -> "expense"
      listOf("收入", "收款", "到账", "转入").any(content::contains) -> "income"
      else -> return
    }
    val matches = AMOUNT.findAll(content).mapNotNull { (it.groupValues[1].ifEmpty { it.groupValues[2] }).replace(",", "").toDoubleOrNull() }.toList()
    if (matches.size != 1 || matches[0] <= 0 || matches[0] > 100000000) return
    val time = Date((sbn.postTime / 60000L) * 60000L)
    val occurredAt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:00'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(time)
    val amount = matches[0]
    val classification = classify(content)
    val eventId = "notification-${sbn.postTime}-${sbn.packageName}"
    NotificationCapture.add(applicationContext, CapturedPayment(eventId, type, amount, occurredAt, source, classification?.confidence ?: 0.75,
      classification?.kind, classification?.status, classification?.counterparty))
  }

  companion object {
    private val AMOUNT = Regex("(?:¥|￥|CNY\\s*)\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\s*(?:元)?|([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\s*元")
    private val SOURCES = mapOf(
      "com.eg.android.AlipayGphone" to "支付宝",
      "com.tencent.mm" to "微信支付",
      "com.android.mms" to "短信通知",
      "com.google.android.apps.messaging" to "短信通知",
      "com.android.messaging" to "短信通知",
      "com.samsung.android.messaging" to "短信通知"
    )

    private data class Classification(val kind: String, val status: String, val confidence: Double, val counterparty: String? = null)

    private fun classify(content: String): Classification? {
      if (Regex("失败|未成功|被拒绝|扣款失败").containsMatchIn(content) && Regex("还款|偿还|账单").containsMatchIn(content)) {
        return Classification("repayment-failed", "failed", 0.96)
      }
      if (Regex("待还|应还|到期|还款提醒|还款日|请还款").containsMatchIn(content)) {
        return Classification("repayment-reminder", "reminder", 0.94)
      }
      val counterparty = Regex("(?:代|帮|替)([^\\s，。,。:：]{1,20}?)(?:还款|偿还|代付)").find(content)?.groupValues?.getOrNull(1)
      if (counterparty != null && Regex("还款|偿还|代付").containsMatchIn(content) && Regex("成功|已还|完成|付款").containsMatchIn(content)) {
        return Classification("proxy-repayment", "success", 0.93, counterparty)
      }
      if (Regex("还款|偿还|账单还清|最低还款").containsMatchIn(content) && Regex("成功|已还|完成|付款").containsMatchIn(content)) {
        return Classification("repayment", "success", 0.95)
      }
      if (Regex("支付成功|付款成功|扣款成功|收款成功|交易成功").containsMatchIn(content)) {
        return Classification("payment", "success", 0.88)
      }
      return null
    }
  }
}

internal object NotificationCapture {
  private const val PREFS = "notification_candidates"
  private const val KEY = "events"

  @Synchronized fun add(context: Context, event: CapturedPayment) {
    val events = load(context)
    events[event.id] = event
    while (events.size > 100) events.remove(events.keys.first())
    val array = JSONArray()
    events.values.forEach { item ->
      val json = JSONObject().put("id", item.id).put("type", item.type).put("amount", item.amount)
        .put("occurredAt", item.occurredAt).put("provider", item.provider).put("confidence", item.confidence)
      item.eventKind?.let { json.put("eventKind", it) }
      item.eventStatus?.let { json.put("eventStatus", it) }
      item.counterparty?.let { json.put("counterparty", it) }
      array.put(json)
    }
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, array.toString()).apply()
  }

  @Synchronized fun consume(context: Context): List<CapturedPayment> {
    val events = load(context).values.toList()
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY).apply()
    return events
  }

  private fun load(context: Context): LinkedHashMap<String, CapturedPayment> {
    val events = LinkedHashMap<String, CapturedPayment>()
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null) ?: return events
    try {
      val array = JSONArray(raw)
      for (index in 0 until array.length()) {
        val item = array.getJSONObject(index)
        val event = CapturedPayment(item.getString("id"), item.getString("type"), item.getDouble("amount"),
          item.getString("occurredAt"), item.getString("provider"), item.optDouble("confidence", 0.5),
          optionalText(item, "eventKind"), optionalText(item, "eventStatus"), optionalText(item, "counterparty"))
        events[event.id] = event
      }
    } catch (_: Exception) {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY).apply()
    }
    return events
  }

  private fun optionalText(item: JSONObject, key: String): String? {
    return if (item.has(key)) item.optString(key).takeIf { it.isNotBlank() } else null
  }
}
