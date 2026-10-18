#!/system/bin/sh

MODDIR=${0%/*}
CONFIG_DIR="$MODDIR/config"
DEFAULT_CONFIG="$CONFIG_DIR/default.conf"
ACTIVE_CONFIG="$CONFIG_DIR/active.conf"
STATE_FILE="$MODDIR/state"
SCAN_SCRIPT="$MODDIR/bin/bill-scan.sh"
SCAN_REQUEST="$CONFIG_DIR/bill-scan.request"

mkdir -p "$CONFIG_DIR"
if [ ! -f "$ACTIVE_CONFIG" ]; then
  cp "$DEFAULT_CONFIG" "$ACTIVE_CONFIG"
fi

printf 'boot_completed_at=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$STATE_FILE"

if [ -x "$SCAN_SCRIPT" ]; then
  "$SCAN_SCRIPT"
  (
    while true; do
      if [ -f "$SCAN_REQUEST" ]; then
        rm -f "$SCAN_REQUEST"
        "$SCAN_SCRIPT"
      fi
      sleep 10
    done
  ) &
fi