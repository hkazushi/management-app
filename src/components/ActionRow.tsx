"use client";

import Link from "next/link";
import { toggleAction, deleteAction } from "@/app/(app)/meetings/actions";
import { fmtDue } from "@/lib/format";
import { Icon } from "./Icon";
import type { ActionItem } from "@/types/database";

// 宿題1件。チェックで完了／未完了を切り替える。
export function ActionRow({
  item,
  today,
  context,
  meetingHref,
}: {
  item: ActionItem;
  today: string;
  context?: string;
  meetingHref?: string;
}) {
  const overdue = !item.done && !!item.due_date && item.due_date < today;
  const dueToday = !item.done && item.due_date === today;
  const mine = item.owner === "自分";

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      <form action={toggleAction.bind(null, item.id, !item.done)}>
        <button
          type="submit"
          aria-label={item.done ? "未完了に戻す" : "完了にする"}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
            item.done
              ? "border-success bg-success text-white"
              : "border-muted/40 text-transparent hover:border-primary"
          }`}
        >
          <Icon name="check" size={13} />
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p className={`text-sm ${item.done ? "text-faint line-through" : "text-ink"}`}>
          {item.content}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span
            className={`chip !py-0.5 ${mine ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}
          >
            {item.owner}
          </span>
          {item.due_date && (
            <span
              className={
                overdue
                  ? "font-semibold text-danger"
                  : dueToday
                    ? "font-semibold text-warning"
                    : "text-muted"
              }
            >
              {overdue ? "期限超過 " : dueToday ? "今日まで " : "〆"}
              {fmtDue(item.due_date)}
            </span>
          )}
          {context &&
            (meetingHref ? (
              <Link href={meetingHref} className="truncate text-muted hover:text-ink hover:underline">
                {context}
              </Link>
            ) : (
              <span className="truncate text-muted">{context}</span>
            ))}
        </div>
      </div>

      <form
        action={deleteAction.bind(null, item.id)}
        onSubmit={(e) => {
          if (!confirm("この宿題を削除しますか？")) e.preventDefault();
        }}
      >
        <button type="submit" aria-label="削除" className="mt-0.5 text-faint transition hover:text-danger">
          <Icon name="trash" size={15} />
        </button>
      </form>
    </div>
  );
}
