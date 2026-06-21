#!/usr/bin/env bash
# ============================================================
# SessionStart フック（spec §6.1）
# cwd が projects に未登録なら status=draft の案件を自動作成する。
# - 既にあれば何もしない（冪等）
# - git リポジトリのみ対象（ジャンクな draft 乱立を防ぐ）
# - 重い処理はバックグラウンド、フック本体は即 exit 0（セッションを止めない）
# - 認証情報は ~/.claude/hooks/management-app.env（リポジトリにコミットしない）
# - タスクの done は絶対に触らない（記録のみ）
# ============================================================

ENV_FILE="$HOME/.claude/hooks/management-app.env"
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

input=$(cat)
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)

# 必須情報が欠けていれば静かに終了
if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_KEY:-}" ] || \
   [ -z "${MANAGEMENT_USER_ID:-}" ] || [ -z "$cwd" ]; then
  exit 0
fi

# git リポジトリ以外は対象外
[ -d "$cwd/.git" ] || exit 0

(
  enc=$(jq -rn --arg s "$cwd" '$s|@uri')
  existing=$(curl -s --max-time 10 \
    "$SUPABASE_URL/rest/v1/projects?repo_path=eq.$enc&select=id" \
    -H "apikey: $SUPABASE_SERVICE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" 2>/dev/null)
  if [ "$existing" = "[]" ]; then
    name=$(basename "$cwd")
    body=$(jq -nc --arg n "$name" --arg p "$cwd" --arg u "$MANAGEMENT_USER_ID" \
      '{name:$n, repo_path:$p, status:"draft", user_id:$u}')
    curl -s --max-time 10 -X POST "$SUPABASE_URL/rest/v1/projects" \
      -H "apikey: $SUPABASE_SERVICE_KEY" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
      -H "Content-Type: application/json" -d "$body" >/dev/null 2>&1
  fi
) >/dev/null 2>&1 &

exit 0
