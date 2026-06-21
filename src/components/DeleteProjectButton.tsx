"use client";

// 案件削除（確認ダイアログ付き）。bind 済みのサーバーアクションを受け取る。
export function DeleteProjectButton({
  action,
  name,
}: {
  action: () => void | Promise<void>;
  name: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(`「${name}」を削除します。関連フェーズ・タスクも消えます。よろしいですか？`)
        ) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10"
      >
        削除
      </button>
    </form>
  );
}
