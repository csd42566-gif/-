#!/system/bin/sh

MODDIR=${0%/*}/..
CONFIG="$MODDIR/config/active.conf"
STATE="$MODDIR/state"
INBOX="/sdcard/Android/data/com.strictledger.app/files/import-inbox"
APP_UID=$(stat -c '%u' /data/user/0/com.strictledger.app 2>/dev/null)
APP_GID=1078
MANIFEST="$INBOX/manifest.tsv"
TMP_MANIFEST="$INBOX/manifest.tsv.tmp"
FILE_LIST="$MODDIR/config/bill-files.tmp"

if [ -f "$CONFIG" ] && grep -q '^bill_scan=0' "$CONFIG"; then
  exit 0
fi

mkdir -p "$INBOX" 2>/dev/null || exit 1
if [ -z "$APP_UID" ]; then
  exit 1
fi
chown "$APP_UID:$APP_GID" "$INBOX" 2>/dev/null
chmod 0770 "$INBOX" 2>/dev/null
printf 'inbox_name\tdisplay_name\tsize\tmodified_at\tdigest\tsource\n' > "$TMP_MANIFEST"
: > "$FILE_LIST"

for root in /sdcard/Download /sdcard/Documents; do
  [ -d "$root" ] || continue
  find "$root" -maxdepth 3 -type f \( -iname '*.csv' -o -iname '*.xlsx' -o -iname '*.xls' -o -iname '*.pdf' \) 2>/dev/null >> "$FILE_LIST"
done

discovered=0
copied=0
while IFS= read -r file; do
  [ -f "$file" ] || continue
  name=$(basename "$file")
  lower_name=$(printf '%s' "$name" | tr 'A-Z' 'a-z')
  case "$lower_name" in
    *账单*|*交易*|*流水*|*明细*|*bill*|*alipay*|*wechat*|*微信*|*支付宝*|*招商*|*工商*|*建设*|*中国银行*|*中信*|*京东*|*得物*|*美团*|*抖音*) ;;
    *) continue ;;
  esac
  size=$(wc -c < "$file" 2>/dev/null | tr -d ' ')
  modified=$(stat -c '%Y' "$file" 2>/dev/null || echo 0)
  [ -n "$size" ] || size=0
  [ -n "$modified" ] || modified=0
  if command -v sha256sum >/dev/null 2>&1; then
    digest=$(sha256sum "$file" 2>/dev/null | awk '{print $1}')
  else
    digest=$(md5sum "$file" 2>/dev/null | awk '{print $1}')
  fi
  [ -n "$digest" ] || continue
  inbox_name="${digest}_${name}"
  destination="$INBOX/$inbox_name"
  if [ ! -f "$destination" ]; then
    cp -f "$file" "$destination" 2>/dev/null || continue
    chown "$APP_UID:$APP_GID" "$destination" 2>/dev/null
    chmod 0660 "$destination" 2>/dev/null
    copied=$((copied + 1))
  fi
  discovered=$((discovered + 1))
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$inbox_name" "$name" "$size" "$modified" "$digest" "$file" >> "$TMP_MANIFEST"
done < "$FILE_LIST"

mv -f "$TMP_MANIFEST" "$MANIFEST" 2>/dev/null
chown "$APP_UID:$APP_GID" "$MANIFEST" 2>/dev/null
chmod 0660 "$MANIFEST" 2>/dev/null
rm -f "$FILE_LIST"
printf 'last_scan_at=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$STATE"
printf 'discovered=%s\n' "$discovered" >> "$STATE"
printf 'copied=%s\n' "$copied" >> "$STATE"