// DB 型定義（spec §5 のスキーマに対応）。
// 最初は手書き。Supabase CLI 導入後は `supabase gen types typescript` で置換可能。
// 各テーブル/ビューに Relationships を持たせる（supabase-js の結果型推論に必要）。

export type ProjectStatus =
  | "draft"
  | "active"
  | "on_hold"
  | "done"
  | "archived";
export type PhaseStatus = "not_started" | "in_progress" | "done";
export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "low" | "mid" | "high";
export type ResourceType = "link" | "account" | "tool";
export type ActivitySource = "claude_code" | "manual";

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          color?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          client: string | null;
          category_id: string | null;
          status: ProjectStatus;
          repo_path: string | null;
          due_date: string | null;
          note: string | null;
          summary: string | null;
          summary_updated_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          client?: string | null;
          category_id?: string | null;
          status?: ProjectStatus;
          repo_path?: string | null;
          due_date?: string | null;
          note?: string | null;
          summary?: string | null;
          summary_updated_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
        Relationships: [];
      };
      phases: {
        Row: {
          id: string;
          user_id: string;
          project_id: string;
          name: string;
          position: number;
          status: PhaseStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          project_id: string;
          name: string;
          position?: number;
          status?: PhaseStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["phases"]["Insert"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          project_id: string;
          phase_id: string | null;
          title: string;
          status: TaskStatus;
          priority: TaskPriority;
          due_date: string | null;
          sort_order: number;
          done_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          project_id: string;
          phase_id?: string | null;
          title: string;
          status?: TaskStatus;
          priority?: TaskPriority;
          due_date?: string | null;
          sort_order?: number;
          done_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: [];
      };
      project_resources: {
        Row: {
          id: string;
          user_id: string;
          project_id: string;
          type: ResourceType;
          label: string;
          url: string | null;
          account: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          project_id: string;
          type?: ResourceType;
          label: string;
          url?: string | null;
          account?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["project_resources"]["Insert"]
        >;
        Relationships: [];
      };
      activity_log: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          action: string;
          detail: string | null;
          source: ActivitySource;
          session_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          action: string;
          detail?: string | null;
          source?: ActivitySource;
          session_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["activity_log"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      phase_progress: {
        Row: {
          phase_id: string;
          project_id: string;
          done_count: number;
          total_count: number;
          progress_pct: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
