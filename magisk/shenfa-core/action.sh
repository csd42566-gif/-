#!/system/bin/sh

APP_PACKAGE="com.strictledger.app"
CONTROL_URI="strictledger://module-control?source=magisk"
AM="/system/bin/am"

if [ ! -x "$AM" ]; then
  echo "神罚：找不到 Android Activity Manager。"
  exit 1
fi

"$AM" start --user 0 -a android.intent.action.VIEW -d "$CONTROL_URI" "$APP_PACKAGE" >/dev/null 2>&1
RESULT=$?
if [ "$RESULT" -ne 0 ]; then
  "$AM" start --user 0 -a android.intent.action.VIEW -d "$CONTROL_URI" >/dev/null 2>&1
  RESULT=$?
fi

if [ "$RESULT" -ne 0 ]; then
  echo "神罚：无法打开控制面板，请先安装神罚 App。"
  exit "$RESULT"
fi

echo "神罚：已请求打开控制面板。"
