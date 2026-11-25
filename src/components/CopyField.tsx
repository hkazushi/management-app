"use client";

import { useState } from "react";
import { Icon } from "./Icon";

// URL などを見せて、ボタンでコピーできるようにする
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} className="input min-w-0 flex-1 !text-xs" />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
        className="btn-ghost shrink-0 !px-3"
      >
        <Icon name={copied ? "check" : "copy"} size={15} />
        {copied ? "コピー済み" : "コピー"}
      </button>
    </div>
  );
}
