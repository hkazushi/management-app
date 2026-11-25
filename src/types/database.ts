// DB の行型（手書き）。supabase クライアントは緩い型のまま使い、結果をここへキャストする。
// 定義は supabase/migrations/0008_home.sql。

export type Member = {
  user_id: string;
  name: string;
  color: string;
  sort: number;
};

export type EventRow = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  start_time: string | null; // HH:MM:SS
  end_time: string | null;
  member_id: string | null; // null は「2人」
  color: string | null;
  memo: string | null;
  batch_id: string | null; // まとめて入れた予定は同じ値
};

export type EventPreset = {
  id: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  member_id: string | null;
  color: string | null;
  sort: number;
};

export type Wish = {
  id: string;
  title: string;
  url: string | null;
  price: number | null;
  memo: string | null;
  member_id: string | null;
  done: boolean;
  done_at: string | null;
  created_at: string;
};

export type FixedCost = {
  id: string;
  name: string;
  amount: number;
  due_day: number; // 1〜31（31 は月末扱い）
  memo: string | null;
  active: boolean;
};

export type FixedPayment = {
  id: string;
  fixed_cost_id: string;
  month: string; // YYYY-MM
  amount: number;
  paid_at: string;
};

export type Income = {
  id: string;
  name: string;
  amount: number;
  active: boolean;
};

export type IncomeActual = {
  id: string;
  income_id: string;
  month: string;
  amount: number;
};

export type SavingsGoal = {
  id: string;
  name: string;
  target: number | null;
  monthly: number;
  active: boolean;
};

export type SavingsEntry = {
  id: string;
  goal_id: string;
  amount: number; // 引き出しはマイナス
  date: string;
  memo: string | null;
};

// 単発のお金（その月だけの出費・収入）
export type OneOff = {
  id: string;
  kind: "expense" | "income";
  name: string;
  amount: number;
  date: string; // 出費なら期限、収入なら入る日
  paid_at: string | null;
  memo: string | null;
};
