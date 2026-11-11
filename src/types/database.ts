// DB の行型（手書き）。supabase クライアントは緩い型のまま使い、結果をここへキャストする。

export type Project = {
  id: string;
  name: string;
  client: string | null;
  status: string;
};

export type MeetingStatus = "recording" | "done";

export type Meeting = {
  id: string;
  project_id: string | null;
  title: string;
  status: MeetingStatus;
  started_at: string;
  duration_sec: number | null;
  transcript: string | null;
  summary: string | null;
  decisions: string[];
  next_agenda: string[];
  email_draft: string | null;
};

export type ActionItem = {
  id: string;
  meeting_id: string | null;
  project_id: string | null;
  owner: string;
  content: string;
  due_date: string | null;
  done: boolean;
};
