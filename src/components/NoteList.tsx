"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  addCalendarNote,
  updateCalendarNote,
  deleteCalendarNote,
} from "@/app/(app)/calendar/actions";
import { Icon } from "./Icon";

type Note = { id: string; body: string; updated_at: string | null };

function AddBtn({ label = "追加" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary text-sm">
      {pending ? "保存中…" : label}
    </button>
  );
}

function NoteItem({ note }: { note: Note }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLFormElement>(null);

  if (editing) {
    return (
      <form
        ref={ref}
        action={async (fd) => {
          await updateCalendarNote(note.id, fd);
          setEditing(false);
        }}
        className="card space-y-2 p-3"
      >
        <textarea
          name="body"
          defaultValue={note.body}
          rows={3}
          className="input"
          autoFocus
        />
        <div className="flex items-center gap-2">
          <AddBtn label="保存" />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-sm text-muted hover:text-ink"
          >
            キャンセル
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="card group flex items-start gap-3 p-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-warning/15 text-warning">
        📝
      </span>
      <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-ink">
        {note.body}
      </p>
      <button
        onClick={() => setEditing(true)}
        aria-label="編集"
        className="text-faint transition hover:text-ink"
      >
        <Icon name="edit" size={14} />
      </button>
      <form
        action={deleteCalendarNote.bind(null, note.id)}
        onSubmit={(e) => {
          if (!confirm("このメモを削除しますか？")) e.preventDefault();
        }}
      >
        <button
          type="submit"
          aria-label="削除"
          className="text-faint transition hover:text-danger"
        >
          <Icon name="trash" size={14} />
        </button>
      </form>
    </div>
  );
}

export function NoteList({ date, notes }: { date: string; notes: Note[] }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <div className="space-y-2">
      {notes.map((n) => (
        <NoteItem key={n.id} note={n} />
      ))}

      <form
        ref={ref}
        action={async (fd) => {
          await addCalendarNote(date, fd);
          ref.current?.reset();
        }}
        className="card space-y-2 p-3"
      >
        <textarea
          name="body"
          rows={2}
          placeholder="この日のメモ（自由記述）"
          className="input"
        />
        <div className="flex justify-end">
          <AddBtn />
        </div>
      </form>
    </div>
  );
}
