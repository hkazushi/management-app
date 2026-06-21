# 案件・タスク管理アプリ 仕様書・設計書

個人用（1ユーザー）の案件・タスク管理アプリ。複数のクライアント案件を、フェーズで可視化しながら一元管理する。Claude Code での開発作業が自動で記録・反映されるのが最大の特徴。

---

## 1. 技術スタック

| 領域 | 採用 |
|---|---|
| フロントエンド | React |
| バックエンド / DB | Supabase（PostgreSQL + Auth + RLS） |
| ホスティング | Vercel |
| AIサマリー生成 | Anthropic API（Claude） |
| Claude Code 連携 | Claude Code フック → Supabase REST API |

環境変数（`.env.local` / Vercel 環境変数）:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
ANTHROPIC_API_KEY=...        # AIサマリー生成用（サーバー側のみ。クライアントに露出させない）
```

---

## 2. 設計思想

このアプリ全体を貫く一本の軸:

> **散らばっている案件情報を1箇所に集めて、現状を可視化する。**

そして自動化のルールはひとつ:

> **記録（事実）は自動。判断（確定・完了）は人間が手動。**

- 開発の記録、案件の下書き作成 → 自動
- 案件の正式確定、タスクの完了チェック → 人間がポチる

AI に「判断」を任せると早とちりの誤爆が起きるため、AI には「記録」だけ任せる。

---

## 3. 機能要件

### 3.1 案件管理（projects）
- 案件の追加・編集（名前・クライアント・期限・メモ）
- ステータス: `draft` / `active` / `on_hold` / `done` / `archived`
- カテゴリで色分け＋絞り込み（例: クライアント案件・補助金・自社開発）
- `repo_path`（リポジトリの作業ディレクトリパス）で Claude Code と名寄せ

### 3.2 フェーズ管理（phases）
- 案件の工程をフェーズで管理し、進捗バー（ステッパー）で可視化
- フェーズ状態: `not_started` / `in_progress` / `done`
- デフォルトのフェーズ構成（案件作成時に自動生成、案件ごとに編集可）:
  1. ヒアリング
  2. 設計
  3. デザイン
  4. 実装
  5. テスト
  6. 公開
  7. 保守
- **タスクをフェーズに紐付け、フェーズの完了率を自動計算**
  （完了率 = そのフェーズに紐づく done タスク数 ÷ 全タスク数）

### 3.3 タスク管理（tasks）
- フェーズ配下にタスクを作成
- タスク状態: `todo` / `doing` / `done`
- 期限・優先度（`low` / `mid` / `high`）
- ドラッグで並べ替え（`sort_order`）
- **完了は手動でポチる**（AI が自動で done にすることはしない）

### 3.4 AIサマリー
- ボタン操作で、案件の現状サマリーを Claude が自動生成
- 材料: その案件の activity_log・タスク・フェーズの状態
- 生成結果は `projects.summary` にキャッシュ（`summary_updated_at` で鮮度管理）
- API キーはサーバー側でのみ使用（Next.js の API Route / Route Handler 等経由）

### 3.5 情報集約（project_resources）
- 案件ごとに、リンク・アカウント・ツール情報をまとめる
- `type`: `link` / `account` / `tool`
- 例: 「本番サイト」「Google Analytics」「お名前.com 管理画面」「client-xxx@gmail.com」
- **重要（セキュリティ）: パスワード本体は保存しない。**
  保存するのは「どこに何があるか」の地図まで（URL・使用アカウント・メモ）。
  パスワードの実体はパスワードマネージャー（1Password / Bitwarden 等）に置き、
  ここにはその所在をメモするだけ。漏洩時の被害を「地図のみ」に限定する。

### 3.6 Today ビュー
- 全案件を横断して「今日やること」を期限順で一覧表示
- 期限超過・本日期限のタスクを強調
- 毎日開く想定のホーム画面

### 3.7 放置案件アラート
- activity_log を元に「一定期間（デフォルト14日）触れていない active 案件」を浮かび上がらせる
- 複数案件持ちでの放置・取りこぼし防止

### 3.8 横断検索
- 案件・タスクをまとめて検索（名前・メモ・タスク名）

### 3.9 アーカイブビュー
- `done` / `archived` 案件を別タブに畳む
- 普段の一覧をスッキリ保ち、過去案件の振り返りも可能

### 3.10 activity_log（Claude Code 自動連携）
- 「いつ・どの案件で・何をやったか」を記録
- `source`: `claude_code`（フック経由）/ `manual`（手動）
- Claude Code のフックが開発の節目に自動追記（詳細は §6）

### 3.11 新規案件の自動作成
- Claude Code が新しいディレクトリで初回セッションを始めると、
  その `cwd` が `projects` に未登録なら **`draft` 案件として自動作成**（名前はフォルダ名で仮置き）
- アプリ上で draft を開き、クライアント・カテゴリ・フェーズを補完して **`active`（正式案件）に確定**
- ゼロからの手動追加も「＋新規」ボタンでいつでも可能
- draft 案件は一覧で薄く表示し、未確定であることが分かるようにする

---

## 4. 非機能要件

- **認証**: Supabase Auth。個人用のため実質1ユーザー運用。全データは `user_id` で分離。
- **レスポンシブ**: スマホからも快適に使えること。特に Today ビューはモバイル前提で設計。
- **デザイン方針**: warm / vibrant 系のトーン（暖色・鮮やか）。
  数値や状態がパッと読み取れる、スキャンしやすい UI を優先。
- **データ所在**: すべて自分の Supabase プロジェクト内。

---

## 5. データベース設計

全テーブル `user_id` を持ち、RLS で本人のみアクセス可能にする。

### 5.1 テーブル定義（SQL）

```sql
-- カテゴリ（色分け・絞り込み用）
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  color text not null default '#FF8C42',
  created_at timestamptz default now()
);

-- 案件
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  client text,
  category_id uuid references categories(id) on delete set null,
  status text not null default 'active',   -- draft / active / on_hold / done / archived
  repo_path text,                          -- Claude Code の cwd と名寄せするキー
  due_date date,
  note text,
  summary text,                            -- AI生成サマリーのキャッシュ
  summary_updated_at timestamptz,
  created_at timestamptz default now()
);

-- フェーズ
create table phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  position int not null default 0,         -- 工程の並び順
  status text not null default 'not_started', -- not_started / in_progress / done
  created_at timestamptz default now()
);

-- タスク
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  project_id uuid not null references projects(id) on delete cascade,
  phase_id uuid references phases(id) on delete set null,  -- フェーズに紐付け
  title text not null,
  status text not null default 'todo',     -- todo / doing / done
  priority text not null default 'mid',    -- low / mid / high
  due_date date,
  sort_order int not null default 0,
  done_at timestamptz,
  created_at timestamptz default now()
);

-- 案件リソース（リンク・アカウント・ツール）
create table project_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  project_id uuid not null references projects(id) on delete cascade,
  type text not null default 'link',       -- link / account / tool
  label text not null,
  url text,
  account text,                            -- 使用アカウント（例: client-xxx@gmail.com）
  note text,                               -- メモ（パスワードマネージャーの所在など。実体は保存しない）
  created_at timestamptz default now()
);

-- 活動ログ（Claude Code 自動 + 手動）
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  project_id uuid references projects(id) on delete cascade,
  action text not null,                    -- 例: 'commit', 'session', 'note'
  detail text,
  source text not null default 'manual',   -- claude_code / manual
  session_id text,                         -- Claude Code セッションID（任意）
  created_at timestamptz default now()
);

-- インデックス
create index on projects (user_id, status);
create index on projects (repo_path);
create index on phases (project_id, position);
create index on tasks (project_id);
create index on tasks (phase_id);
create index on tasks (user_id, status, due_date);
create index on project_resources (project_id);
create index on activity_log (project_id, created_at desc);
```

### 5.2 RLS ポリシー

```sql
alter table categories       enable row level security;
alter table projects         enable row level security;
alter table phases           enable row level security;
alter table tasks            enable row level security;
alter table project_resources enable row level security;
alter table activity_log     enable row level security;

create policy "own rows" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on phases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on project_resources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on activity_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### 5.3 フェーズ進捗率の算出

ビューで持つ場合の例（フロント側集計でも可）:

```sql
create view phase_progress as
select
  p.id as phase_id,
  p.project_id,
  count(t.id) filter (where t.status = 'done') as done_count,
  count(t.id) as total_count,
  case when count(t.id) = 0 then 0
       else round(100.0 * count(t.id) filter (where t.status = 'done') / count(t.id))
  end as progress_pct
from phases p
left join tasks t on t.phase_id = p.id
group by p.id, p.project_id;
```

---

## 6. Claude Code フック連携仕様

mem0 と同じ「フック」機構を、自分の Supabase に向ける。
設定は `.claude/settings.json`（プロジェクト単位）または `~/.claude/settings.json`（全体）。

### 6.1 新規案件の自動 draft 作成（SessionStart）
- `SessionStart` フックで `cwd` を取得
- Supabase に `repo_path = cwd` の案件が無ければ、`status = 'draft'`・`name = フォルダ名` で INSERT
- 既にあれば何もしない（冪等）

### 6.2 開発記録の自動追記
- **PostToolUse（git commit にマッチ）** または **SessionEnd** で activity_log に追記
- `Stop`（応答ごと）は頻繁すぎるため使わない
- 記録内容: `project_id`（repo_path で名寄せ）, `action`, `detail`, `source = 'claude_code'`, `session_id`

### 6.3 守るべきルール
- **タスクの `done` 化は絶対に自動でやらない。** フックは activity_log への記録のみ。
- 重い処理はバックグラウンドサブシェルで実行し、フック自体は即 `exit 0`（セッションを止めない）
- Supabase へは REST API（`/rest/v1/...`）に対し `curl` で書き込み
- 認証情報（Supabase URL / サービスキー）はフック用のローカル環境変数に置き、リポジトリにコミットしない

### 6.4 フック設定の雛形（イメージ）

```jsonc
{
  "hooks": {
    "SessionStart": [
      { "matcher": "",
        "hooks": [{ "type": "command", "command": "~/.claude/hooks/project-upsert.sh", "timeout": 30 }] }
    ],
    "PostToolUse": [
      { "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "~/.claude/hooks/log-commit.sh", "timeout": 30 }] }
    ]
  }
}
```

スクリプトは stdin の JSON（`cwd`・`session_id` 等）を `jq` でパースし、
バックグラウンドで `curl` を投げて即 `exit 0` する方針。

---

## 7. 画面構成（想定）

- **Today**（ホーム / モバイル前提）: 全案件横断の今日やること + 放置案件アラート
- **案件一覧**: カテゴリ色分け・絞り込み・横断検索・draft は薄表示
- **案件詳細**: フェーズの進捗バー、フェーズ配下のタスク、AIサマリー、リソース（リンク/アカウント/ツール）
- **アーカイブ**: done / archived 案件

---

## 8. 実装スコープ外（意図的に入れないもの）

後から必要を実感したら足す前提で、最初は入れない:

- 金額・入金管理（会計ソフトに任せる）
- 工数記録 / タイムトラッキング
- 案件テンプレート
- データエクスポート（Supabase に実体があるため当面不要）
- 多人数共有・権限管理
- アプリ内通知・リマインド（OS で代替）
- ガントチャート・タスク依存関係
