import { PALETTE, onColor } from "@/lib/colors";
import { whoOf } from "@/lib/members";
import type { Member } from "@/types/database";

// 「誰の」を選ぶ。ふたり／それぞれの名前を、押せる札で並べる。空の値が「ふたり」。
// group は、同じ画面に同じ選択肢がいくつもあるときに、札どうしを区別するための名前。
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
  const options = [{ value: "", label: "ふたり", color: "#C9A862" }, ...members.map((m) => ({ value: m.user_id, label: m.name, color: m.color }))];
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`} role="radiogroup" aria-label="誰の">
      <span className="mr-0.5 text-[11px] font-bold text-muted">誰の</span>
      {options.map((o) => (
        <label key={o.value} className="cursor-pointer">
          <input type="radio" name={name} value={o.value} defaultChecked={(defaultValue ?? "") === o.value} className="peer sr-only" />
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold text-muted transition peer-checked:border-primary peer-checked:bg-primary peer-checked:text-[#FAF4E4]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} />
            {o.label}
          </span>
        </label>
      ))}
    </div>
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
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="色">
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
            className="block h-7 w-7 rounded-full transition peer-checked:scale-110 peer-checked:shadow-[0_0_0_3px_rgb(var(--surface)),0_0_0_4.5px_rgb(var(--sun))]"
            style={{ background: c.value }}
          />
        </label>
      ))}
    </div>
  );
}
