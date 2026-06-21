#!/usr/bin/env bash
# ============================================================
# PostToolUse(Bash) フック（spec §6.2）
# git commit を検知したら activity_log に追記する。
# - repo_path で案件を名寄せし、見つかった案件にのみ記録
# - source = 'claude_code'、session_id も記録
# - 重い処理はバックグラウンド、フック本体は即 exit 0
# - タスクの done は絶対に触らない（記録のみ）
# ============================================================

ENV_FILE="$HOME/.claude/hooks/management-app.env"
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
sid=$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)

# git commit を含むコマンド以外は対象外
case "$cmd" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_KEY:-}" ] || \
   [ -z "${MANAGEMENT_USER_ID:-}" ] || [ -z "$cwd" ]; then
  exit 0
fi

(
  enc=$(jq -rn --arg s "$cwd" '$s|@uri')
  pid=$(curl -s --max-time 10 \
    "$SUPABASE_URL/rest/v1/projects?repo_path=eq.$enc&select=id" \
    -H "apikey: $SUPABASE_SERVICE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" 2>/dev/null \
    | jq -r '.[0].id // empty')
  [ -z "$pid" ] && exit 0
  detail=$(printf '%s' "$cmd" | head -c 200)
  body=$(jq -nc --arg p "$pid" --arg d "$detail" --arg s "$sid" --arg u "$MANAGEMENT_USER_ID" \
    '{project_id:$p, action:"commit", detail:$d, source:"claude_code", session_id:$s, user_id:$u}')
  curl -s --max-time 10 -X POST "$SUPABASE_URL/rest/v1/activity_log" \
    -H "apikey: $SUPABASE_SERVICE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
    -H "Content-Type: application/json" -d "$body" >/dev/null 2>&1
) >/dev/null 2>&1 &

exit 0
