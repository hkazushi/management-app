# Claude Code フック連携（spec §6）

Claude Code での開発を、この案件管理アプリへ**自動で記録**する。
**記録（事実）は自動・判断（完了）は手動**の原則を守り、タスクの `done` は絶対に自動で触らない。

## 何をするか
| フック | スクリプト | 動作 |
|---|---|---|
| `SessionStart` | `project-upsert.sh` | cwd（git リポジトリ）が未登録なら `draft` 案件を自動作成（§6.1・§3.11） |
| `PostToolUse(Bash)` | `log-commit.sh` | `git commit` を検知し `activity_log` に追記（§6.2） |

- 重い処理はバックグラウンドで実行し、フック本体は即 `exit 0`（セッションを止めない）
- Supabase へは REST API に `curl` で書き込み
- 認証情報（URL / サービスキー / user_id）は `~/.claude/hooks/management-app.env` に置き、リポジトリにはコミットしない

## セットアップ
```bash
# 1) スクリプトを配置
mkdir -p ~/.claude/hooks
cp hooks/project-upsert.sh hooks/log-commit.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/*.sh

# 2) 認証情報（実値）を作成
cp hooks/management-app.env.example ~/.claude/hooks/management-app.env
chmod 600 ~/.claude/hooks/management-app.env
# → SUPABASE_URL / SUPABASE_SERVICE_KEY / MANAGEMENT_USER_ID を記入

# 3) ~/.claude/settings.json に hooks をマージ（既存キーは保持）
#    hooks/settings.example.json を参考に "hooks" を追加
```

## 無効化したいとき
`~/.claude/settings.json` の `"hooks"` キーを削除（または該当エントリを削除）すれば停止する。
スクリプトや env ファイルを消すだけでも、フックは「設定はあるが何もしない（即 exit 0）」状態になる。

## 注意
- `SUPABASE_SERVICE_KEY` は RLS を越える強力なキー。漏洩時は Supabase でローテーションすること。
- git リポジトリ以外のディレクトリでは draft を作らない（ジャンク防止）。
