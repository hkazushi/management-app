-- ============================================================
-- 0007_vault.sql
-- 案件ごとの URL・ログインID・パスワードの管理（ログパス）。
--
-- パスワードは暗号化した文字列だけを保存する。
--   - vaults: 利用者ごとの鍵。公開鍵はそのまま、秘密鍵はマスターパスワード由来の鍵で暗号化して置く
--   - project_resources.secret_enc: 公開鍵で暗号化したパスワード
-- 復号はブラウザの中でだけ行う。マスターパスワードはどこにも保存しない。
-- ============================================================

create table vaults (
  user_id uuid primary key references auth.users(id) default auth.uid(),
  public_key text not null,        -- RSA-OAEP 公開鍵（SPKI・base64）
  enc_private_key text not null,   -- 秘密鍵（PKCS8）を AES-GCM で暗号化したもの（base64）
  salt text not null,              -- PBKDF2 のソルト（base64）
  iv text not null,                -- AES-GCM の IV（base64）
  iterations int not null,         -- PBKDF2 の反復回数
  created_at timestamptz not null default now()
);

alter table vaults enable row level security;
create policy "own rows" on vaults
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 既存の project_resources（リンク・アカウント・ツール）を広げて使う
alter table project_resources alter column project_id drop not null;  -- 案件に紐づかないものも置けるように

alter table project_resources
  add column secret_enc text,                             -- 暗号化したパスワード・キー（無ければ URL だけの行）
  add column source text not null default 'manual',       -- manual / env / git / memo / claude
  add column source_key text,                             -- 自動収集の重複防止キー
  add column needs_review boolean not null default false, -- メモから機械的に拾ったもの（要確認）
  add column updated_at timestamptz not null default now();

alter table project_resources
  add constraint project_resources_source_key unique (user_id, source_key);
