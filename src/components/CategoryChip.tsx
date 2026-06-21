// カテゴリの色付きチップ。色はDB保存の任意 hex なので style で指定する。
export function CategoryChip({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  return (
    <span className="chip" style={{ backgroundColor: `${color}1f`, color }}>
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {name}
    </span>
  );
}
