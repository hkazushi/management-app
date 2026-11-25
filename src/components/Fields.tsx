import { PALETTE, onColor } from "@/lib/colors";
import { whoOf } from "@/lib/members";
import type { Member } from "@/types/database";

// 「誰の」を選ぶ。空は「ふたり」
export function WhoSelect({
  members,
  name = "member_id",
  defaultValue = "",
  className = "",
}: {
  members: Member[];
  name?: string;
  defaultValue?: string | null;
  className?: string;
}) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} aria-label="誰の" className={`input ${className}`}>
      <option value="">ふたり</option>
      {members.map((m) => (
        <option key={m.user_id} value={m.user_id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

// 「誰の」を色つきの札で出す
export function WhoChip({ members, memberId }: { members: Member[]; memberId: string | null }) {
  const who = whoOf(members, memberId);
  return (
    <span className="chip shrink-0" style={{ background: who.color, color: onColor(who.color) }}>
      {who.name}
    </span>
  );
}

// 色を選ぶ（丸をタップ）
export function ColorPick({ name = "color", defaultValue }: { name?: string; defaultValue?: string | null }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="色">
      {PALETTE.map((c, i) => (
        <label key={c.value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={c.value}
            defaultChecked={defaultValue ? defaultValue === c.value : i === 0}
            className="peer sr-only"
          />
          <span
            title={c.name}
            className="block h-8 w-8 rounded-full border-2 border-ink transition peer-checked:scale-110 peer-checked:shadow-[0_0_0_3px_rgb(var(--bg)),0_0_0_5px_rgb(var(--ink))]"
            style={{ background: c.value }}
          />
        </label>
      ))}
    </div>
  );
}
