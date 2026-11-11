"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addResource,
  confirmResource,
  deleteResource,
  saveVault,
} from "@/app/(app)/accounts/actions";
import {
  MIN_MASTER_LENGTH,
  createVault,
  decryptSecret,
  encryptSecret,
  unlockVault,
  type VaultRow,
} from "@/lib/vault";
import { Icon } from "./Icon";

export type ResourceItem = {
  id: string;
  project_id: string | null;
  type: string;
  label: string;
  url: string | null;
  account: string | null;
  note: string | null;
  secret_enc: string | null;
  source: string;
  needs_review: boolean;
};

type ProjectOption = { id: string; name: string };

const SOURCE_LABEL: Record<string, string> = {
  env: ".env",
  git: "git",
  memo: "メモ",
  claude: "Claude",
};

// URL・ログインID・パスワードの一覧。
// パスワードは暗号化されたまま届く。マスターパスワードを入れると、このブラウザの中でだけ復号する。
export function Vault({
  vault,
  items,
  projects,
  initialProject,
}: {
  vault: VaultRow | null;
  items: ResourceItem[];
  projects: ProjectOption[];
  initialProject: string;
}) {
  const router = useRouter();
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState("");
  const [query, setQuery] = useState("");
  const [project, setProject] = useState(initialProject);
  const [master, setMaster] = useState("");
  const [master2, setMaster2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  const pName = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const secretCount = items.filter((i) => i.secret_enc).length;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (project === "none" ? i.project_id !== null : project && i.project_id !== project) return false;
      if (!q) return true;
      return [i.label, i.url, i.account, i.note, i.project_id ? pName.get(i.project_id) : ""]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [items, query, project, pName]);

  // 案件ごとにまとめる（案件なしは最後）
  const groups = useMemo(() => {
    const map = new Map<string, ResourceItem[]>();
    for (const i of shown) {
      const key = i.project_id ?? "";
      map.set(key, [...(map.get(key) ?? []), i]);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (!a) return 1;
      if (!b) return -1;
      return (pName.get(a) ?? "").localeCompare(pName.get(b) ?? "", "ja");
    });
  }, [shown, pName]);

  async function setup() {
    setError("");
    if (master.length < MIN_MASTER_LENGTH) return setError(`マスターパスワードは${MIN_MASTER_LENGTH}文字以上にしてください`);
    if (master !== master2) return setError("2回の入力が一致しません");
    setBusy(true);
    try {
      const row = await createVault(master);
      const res = await saveVault(row);
      if (res.error) return setError(res.error);
      setPrivateKey(await unlockVault(row, master));
      setMaster("");
      setMaster2("");
      router.refresh();
    } catch {
      setError("鍵の作成に失敗しました。もう一度試してください");
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    if (!vault) return;
    setError("");
    setBusy(true);
    try {
      setPrivateKey(await unlockVault(vault, master));
      setMaster("");
    } catch {
      setError("マスターパスワードが違います");
    } finally {
      setBusy(false);
    }
  }

  function lock() {
    setPrivateKey(null);
    setRevealed({});
  }

  async function plainOf(item: ResourceItem): Promise<string | null> {
    if (!privateKey || !item.secret_enc) return null;
    if (revealed[item.id] !== undefined) return revealed[item.id];
    try {
      return await decryptSecret(privateKey, item.secret_enc);
    } catch {
      setError(`「${item.label}」を復号できません（金庫を作り直す前に保存されたものかもしれません）`);
      return null;
    }
  }

  async function toggleReveal(item: ResourceItem) {
    if (revealed[item.id] !== undefined) {
      setRevealed((r) => Object.fromEntries(Object.entries(r).filter(([id]) => id !== item.id)));
      return;
    }
    const plain = await plainOf(item);
    if (plain !== null) setRevealed((r) => ({ ...r, [item.id]: plain }));
  }

  async function copy(key: string, text: string | null) {
    if (text === null) return;
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1500);
  }

  async function add(form: HTMLFormElement) {
    const fd = new FormData(form);
    const secret = String(fd.get("secret") ?? "");
    setError("");
    if (secret && !vault) return setError("パスワードを保存するには、先に金庫を作ってください");
    setBusy(true);
    try {
      const res = await addResource({
        project_id: String(fd.get("project_id") ?? "") || null,
        label: String(fd.get("label") ?? ""),
        url: String(fd.get("url") ?? ""),
        account: String(fd.get("account") ?? ""),
        note: String(fd.get("note") ?? ""),
        secret_enc: secret && vault ? await encryptSecret(vault.public_key, secret) : null,
      });
      if (res.error) return setError(res.error);
      form.reset();
      setAdding(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 金庫の状態 */}
      {!vault ? (
        <div className="card space-y-3 p-4">
          <div>
            <h2 className="font-semibold text-ink">金庫を作る</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              パスワードを見るための「マスターパスワード」を決めます。アプリの PIN とは別のものにしてください。
              マスターパスワードはどこにも保存されません。
              <span className="font-semibold text-danger">忘れると、保存したパスワードは二度と表示できません。</span>
            </p>
          </div>
          <input
            type="password"
            value={master}
            onChange={(e) => setMaster(e.target.value)}
            placeholder={`マスターパスワード（${MIN_MASTER_LENGTH}文字以上）`}
            autoComplete="new-password"
            className="input w-full"
          />
          <input
            type="password"
            value={master2}
            onChange={(e) => setMaster2(e.target.value)}
            placeholder="もう一度入力"
            autoComplete="new-password"
            className="input w-full"
          />
          <button type="button" onClick={setup} disabled={busy} className="btn-primary disabled:opacity-60">
            <Icon name="lock" size={16} />
            {busy ? "作成中…" : "金庫を作る"}
          </button>
        </div>
      ) : privateKey ? (
        <div className="card flex items-center justify-between gap-3 p-3">
          <p className="text-sm text-ink">ロック解除中。パスワードを表示・コピーできます。</p>
          <button type="button" onClick={lock} className="btn-ghost shrink-0">
            <Icon name="lock" size={15} />
            ロックする
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void unlock();
          }}
          className="card flex flex-wrap items-center gap-2 p-3"
        >
          <input
            type="password"
            value={master}
            onChange={(e) => setMaster(e.target.value)}
            placeholder={`マスターパスワード（パスワード ${secretCount} 件を表示するには入力）`}
            autoComplete="current-password"
            className="input min-w-[12rem] flex-1"
          />
          <button type="submit" disabled={busy || !master} className="btn-primary shrink-0 disabled:opacity-60">
            {busy ? "確認中…" : "ロック解除"}
          </button>
        </form>
      )}

      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {/* 絞り込み */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="名前・URL・ID で検索"
          className="input min-w-[10rem] flex-1"
        />
        <select value={project} onChange={(e) => setProject(e.target.value)} className="input w-44" aria-label="案件">
          <option value="">すべての案件</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="none">案件なし</option>
        </select>
        <button type="button" onClick={() => setAdding((v) => !v)} className="btn-ghost shrink-0">
          <Icon name={adding ? "close" : "plus"} size={15} />
          {adding ? "閉じる" : "追加"}
        </button>
      </div>

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void add(e.currentTarget);
          }}
          className="card grid gap-2 p-4 sm:grid-cols-2"
        >
          <input name="label" required placeholder="名前（例: Xserver 管理画面）" className="input" />
          <select
            name="project_id"
            defaultValue={project && project !== "none" ? project : ""}
            className="input"
            aria-label="案件"
          >
            <option value="">案件なし</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input name="url" type="url" placeholder="URL" className="input sm:col-span-2" />
          <input name="account" placeholder="ログインID・メールアドレス" autoComplete="off" className="input" />
          <input
            name="secret"
            type="password"
            placeholder={vault ? "パスワード（暗号化して保存）" : "パスワード（金庫を作ると保存できます）"}
            disabled={!vault}
            autoComplete="new-password"
            className="input"
          />
          <input name="note" placeholder="メモ" className="input sm:col-span-2" />
          <button type="submit" disabled={busy} className="btn-primary sm:col-span-2 disabled:opacity-60">
            保存
          </button>
        </form>
      )}

      {/* 一覧 */}
      {shown.length === 0 ? (
        <p className="card p-4 text-sm text-muted">
          {items.length === 0
            ? "まだ何も登録されていません。Claude Code で作業すると、案件の URL やログイン情報が自動で集まります。"
            : "条件に合うものがありません。"}
        </p>
      ) : (
        groups.map(([pid, list]) => (
          <div key={pid || "none"} className="space-y-1.5">
            <h2 className="text-sm font-semibold text-ink">
              {pid ? (pName.get(pid) ?? "（不明な案件）") : "案件なし"}（{list.length}）
            </h2>
            {list.map((item) => {
              const plain = revealed[item.id];
              return (
                <div key={item.id} className="rounded-xl border border-border bg-surface px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {item.label}
                        {item.needs_review && (
                          <span className="chip ml-2 bg-warning/15 !py-0.5 text-warning">要確認</span>
                        )}
                        {SOURCE_LABEL[item.source] && (
                          <span className="ml-2 text-xs font-normal text-faint">{SOURCE_LABEL[item.source]}</span>
                        )}
                      </p>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-xs text-primary hover:underline"
                        >
                          {item.url}
                        </a>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {item.needs_review && (
                        <form action={confirmResource.bind(null, item.id)}>
                          <button type="submit" className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-bg hover:text-ink">
                            確認済みにする
                          </button>
                        </form>
                      )}
                      <button
                        type="button"
                        aria-label="削除"
                        onClick={async () => {
                          if (!window.confirm(`「${item.label}」を削除しますか？`)) return;
                          await deleteResource(item.id);
                          router.refresh();
                        }}
                        className="rounded-lg p-1.5 text-faint hover:bg-bg hover:text-danger"
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </div>

                  {(item.account || item.secret_enc) && (
                    <div className="mt-2 space-y-1 text-sm">
                      {item.account && (
                        <div className="flex items-center gap-2">
                          <span className="w-10 shrink-0 text-xs text-muted">ID</span>
                          <span className="min-w-0 flex-1 truncate font-mono text-ink">{item.account}</span>
                          <button
                            type="button"
                            onClick={() => copy(`a${item.id}`, item.account)}
                            className="rounded-lg p-1.5 text-muted hover:bg-bg hover:text-ink"
                            aria-label="IDをコピー"
                          >
                            <Icon name={copied === `a${item.id}` ? "check" : "copy"} size={15} />
                          </button>
                        </div>
                      )}
                      {item.secret_enc && (
                        <div className="flex items-center gap-2">
                          <span className="w-10 shrink-0 text-xs text-muted">PW</span>
                          <span className="min-w-0 flex-1 break-all font-mono text-ink">
                            {plain !== undefined ? plain : "••••••••"}
                          </span>
                          {privateKey ? (
                            <>
                              <button
                                type="button"
                                onClick={() => toggleReveal(item)}
                                className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-bg hover:text-ink"
                              >
                                {plain !== undefined ? "隠す" : "表示"}
                              </button>
                              <button
                                type="button"
                                onClick={async () => copy(`s${item.id}`, await plainOf(item))}
                                className="rounded-lg p-1.5 text-muted hover:bg-bg hover:text-ink"
                                aria-label="パスワードをコピー"
                              >
                                <Icon name={copied === `s${item.id}` ? "check" : "copy"} size={15} />
                              </button>
                            </>
                          ) : (
                            <Icon name="lock" size={14} className="text-faint" />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {item.note && <p className="mt-1.5 text-xs leading-relaxed text-muted">{item.note}</p>}
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
