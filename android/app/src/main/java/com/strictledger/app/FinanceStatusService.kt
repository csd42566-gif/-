package com.strictledger.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

class FinanceStatusService : Service() {
  override fun onCreate() {
    super.onCreate()
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
      return START_NOT_STICKY
    }
    val preferences = getSharedPreferences(PREFERENCES, MODE_PRIVATE)
    val text = intent?.getStringExtra(EXTRA_TEXT) ?: preferences.getString(KEY_TEXT, null)
    if (text.isNullOrBlank()) {
      stopSelf()
      return START_NOT_STICKY
    }
    preferences.edit().putString(KEY_TEXT, text).apply()
    val notification = buildNotification(text)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onTaskRemoved(rootIntent: Intent?) {
    // Keep the foreground service alive when the task is removed.
  }

  private fun buildNotification(text: String): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    @Suppress("DEPRECATION")
    builder
      .setSmallIcon(android.R.drawable.stat_notify_sync)
      .setContentTitle(TITLE)
      .setContentText(text)
      .setStyle(Notification.BigTextStyle().bigText(text))
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setColor(COLOR)
      .setPriority(Notification.PRIORITY_LOW)
    return builder.build()
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel = NotificationChannel(
      CHANNEL_ID,
      "神罚财务状态",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "常驻显示已存、目标还差和本月缺口"
      setShowBadge(false)
      enableVibration(false)
      setSound(null, null)
    }
    manager.createNotificationChannel(channel)
  }

  companion object {
    private const val CHANNEL_ID = "shenfa-finance-status"
    private const val NOTIFICATION_ID = 7017
    private const val ACTION_START = "com.strictledger.app.STATUS_START"
    private const val ACTION_STOP = "com.strictledger.app.STATUS_STOP"
    private const val EXTRA_TEXT = "status_text"
    private const val PREFERENCES = "shenfa-status-service"
    private const val KEY_TEXT = "last_text"
    private const val TITLE = "神罚 · 财务状态"
    private const val COLOR = 0xFF2F4A6D.toInt()

    fun start(context: Context, text: String) = dispatch(context, text)
    fun update(context: Context, text: String) = dispatch(context, text)
    fun stop(context: Context) {
      context.stopService(Intent(context, FinanceStatusService::class.java))
    }

    private fun dispatch(context: Context, text: String) {
      val intent = Intent(context, FinanceStatusService::class.java).apply {
        action = ACTION_START
        putExtra(EXTRA_TEXT, text)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }
  }
}