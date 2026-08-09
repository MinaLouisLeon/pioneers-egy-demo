/**
 * Database types for the pioneers-egy schema.
 *
 * Mirrors supabase/migrations/*.sql. Regenerate after any migration with:
 *   pnpm db:types
 * (requires the local stack running: `pnpm db:start`).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: Database["public"]["Enums"]["user_role"];
          phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          role?: Database["public"]["Enums"]["user_role"];
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: Database["public"]["Enums"]["user_role"];
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          client_id: string;
          project_name: string;
          company_name: string;
          visit_date: string;
          status: Database["public"]["Enums"]["job_status"];
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          submitted_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          client_id?: string;
          project_name: string;
          company_name: string;
          visit_date: string;
          status?: Database["public"]["Enums"]["job_status"];
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          submitted_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          client_id?: string;
          project_name?: string;
          company_name?: string;
          visit_date?: string;
          status?: Database["public"]["Enums"]["job_status"];
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          submitted_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      job_tasks: {
        Row: {
          id: string;
          client_id: string;
          job_id: string;
          category: Database["public"]["Enums"]["task_category"];
          subtype: Database["public"]["Enums"]["task_subtype"];
          sort_order: number;
          data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id?: string;
          job_id: string;
          category: Database["public"]["Enums"]["task_category"];
          subtype: Database["public"]["Enums"]["task_subtype"];
          sort_order?: number;
          data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          job_id?: string;
          category?: Database["public"]["Enums"]["task_category"];
          subtype?: Database["public"]["Enums"]["task_subtype"];
          sort_order?: number;
          data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_tasks_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      task_photos: {
        Row: {
          id: string;
          client_id: string;
          task_id: string;
          r2_key: string;
          file_name: string;
          content_type: string;
          size_bytes: number;
          width: number | null;
          height: number | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id?: string;
          task_id: string;
          r2_key: string;
          file_name: string;
          content_type?: string;
          size_bytes?: number;
          width?: number | null;
          height?: number | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          task_id?: string;
          r2_key?: string;
          file_name?: string;
          content_type?: string;
          size_bytes?: number;
          width?: number | null;
          height?: number | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_photos_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "job_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      certificates: {
        Row: {
          id: string;
          client_id: string;
          title: string;
          file_name: string;
          r2_key: string;
          content_type: string;
          size_bytes: number;
          company_name: string | null;
          certificate_number: string | null;
          issue_date: string | null;
          expiry_date: string | null;
          job_id: string | null;
          uploaded_by: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          client_id?: string;
          title: string;
          file_name: string;
          r2_key: string;
          content_type?: string;
          size_bytes?: number;
          company_name?: string | null;
          certificate_number?: string | null;
          issue_date?: string | null;
          expiry_date?: string | null;
          job_id?: string | null;
          uploaded_by: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          client_id?: string;
          title?: string;
          file_name?: string;
          r2_key?: string;
          content_type?: string;
          size_bytes?: number;
          company_name?: string | null;
          certificate_number?: string | null;
          issue_date?: string | null;
          expiry_date?: string | null;
          job_id?: string | null;
          uploaded_by?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "certificates_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "certificates_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      certificate_share_links: {
        Row: {
          id: string;
          certificate_id: string;
          token: string;
          label: string | null;
          is_revoked: boolean;
          expires_at: string | null;
          view_count: number;
          download_count: number;
          created_by: string;
          created_at: string;
          last_accessed_at: string | null;
        };
        Insert: {
          id?: string;
          certificate_id: string;
          token: string;
          label?: string | null;
          is_revoked?: boolean;
          expires_at?: string | null;
          view_count?: number;
          download_count?: number;
          created_by: string;
          created_at?: string;
          last_accessed_at?: string | null;
        };
        Update: {
          id?: string;
          certificate_id?: string;
          token?: string;
          label?: string | null;
          is_revoked?: boolean;
          expires_at?: string | null;
          view_count?: number;
          download_count?: number;
          created_by?: string;
          created_at?: string;
          last_accessed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "certificate_share_links_certificate_id_fkey";
            columns: ["certificate_id"];
            isOneToOne: false;
            referencedRelation: "certificates";
            referencedColumns: ["id"];
          },
        ];
      };
      certificate_access_log: {
        Row: {
          id: number;
          share_link_id: string;
          action: string;
          user_agent: string | null;
          accessed_at: string;
        };
        Insert: {
          id?: number;
          share_link_id: string;
          action: string;
          user_agent?: string | null;
          accessed_at?: string;
        };
        Update: {
          id?: number;
          share_link_id?: string;
          action?: string;
          user_agent?: string | null;
          accessed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "certificate_access_log_share_link_id_fkey";
            columns: ["share_link_id"];
            isOneToOne: false;
            referencedRelation: "certificate_share_links";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_active_user: { Args: Record<PropertyKey, never>; Returns: boolean };
      can_read_job: { Args: { p_job_id: string }; Returns: boolean };
      can_write_job: { Args: { p_job_id: string }; Returns: boolean };
    };
    Enums: {
      user_role: "admin" | "manager" | "inspector";
      job_status: "draft" | "submitted";
      task_category: "inspection" | "environmental";
      task_subtype: "lifting" | "ndt" | "testing" | "env_option_1" | "env_option_2" | "env_option_3";
    };
    CompositeTypes: Record<never, never>;
  };
};

// ---------------------------------------------------------------------------
// Convenience aliases
// ---------------------------------------------------------------------------

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
