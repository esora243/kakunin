export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          line_uid: string;
          name: string | null;
          avatar_url: string | null;
          gender: string | null;
          grade: number | null;
          university: string | null;
          club: string | null;
          desired_dept: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          line_uid: string;
          name?: string | null;
          avatar_url?: string | null;
          gender?: string | null;
          grade?: number | null;
          university?: string | null;
          club?: string | null;
          desired_dept?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          line_uid?: string;
          name?: string | null;
          avatar_url?: string | null;
          gender?: string | null;
          grade?: number | null;
          university?: string | null;
          club?: string | null;
          desired_dept?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          description: string | null;
          category: string | null;
          contact_email: string | null;
          website_url: string | null;
          sns_url: string | null;
          logo_url: string | null;
          banner_image_url: string | null;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          description?: string | null;
          category?: string | null;
          contact_email?: string | null;
          website_url?: string | null;
          sns_url?: string | null;
          logo_url?: string | null;
          banner_image_url?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string | null;
          description?: string | null;
          category?: string | null;
          contact_email?: string | null;
          website_url?: string | null;
          sns_url?: string | null;
          logo_url?: string | null;
          banner_image_url?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          organization_id: string | null;
          title: string;
          employment_type: string | null;
          job_type: string | null;
          category: string | null;
          prefecture: string | null;
          location: string | null;
          location_type: string | null;
          company_name: string;
          description: string | null;
          salary: string | null;
          salary_display: string | null;
          schedule: string | null;
          requirements: string[] | null;
          apply_url: string | null;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          title: string;
          employment_type?: string | null;
          job_type?: string | null;
          category?: string | null;
          prefecture?: string | null;
          location?: string | null;
          location_type?: string | null;
          company_name: string;
          description?: string | null;
          salary?: string | null;
          salary_display?: string | null;
          schedule?: string | null;
          requirements?: string[] | null;
          apply_url?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          title?: string;
          employment_type?: string | null;
          job_type?: string | null;
          category?: string | null;
          prefecture?: string | null;
          location?: string | null;
          location_type?: string | null;
          company_name?: string;
          description?: string | null;
          salary?: string | null;
          salary_display?: string | null;
          schedule?: string | null;
          requirements?: string[] | null;
          apply_url?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      bookmarks: {
        Row: {
          id: string;
          user_id: string;
          job_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          job_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          job_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookmarks_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookmarks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      articles: {
        Row: {
          id: string;
          organization_id: string | null;
          title: string;
          category: string | null;
          section: string | null;
          excerpt: string | null;
          thumbnail_url: string | null;
          content: string;
          is_published: boolean;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          title: string;
          category?: string | null;
          section?: string | null;
          excerpt?: string | null;
          thumbnail_url?: string | null;
          content: string;
          is_published?: boolean;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          title?: string;
          category?: string | null;
          section?: string | null;
          excerpt?: string | null;
          thumbnail_url?: string | null;
          content?: string;
          is_published?: boolean;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "articles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      classes: {
        Row: {
          id: string;
          title: string;
          day_of_week: number | null;
          period: number | null;
          room: string | null;
          instructor_name: string | null;
          syllabus_url: string | null;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          day_of_week?: number | null;
          period?: number | null;
          room?: string | null;
          instructor_name?: string | null;
          syllabus_url?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          day_of_week?: number | null;
          period?: number | null;
          room?: string | null;
          instructor_name?: string | null;
          syllabus_url?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      class_assignments: {
        Row: {
          id: string;
          class_id: string;
          title: string;
          description: string | null;
          due_at: string | null;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          title: string;
          description?: string | null;
          due_at?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          class_id?: string;
          title?: string;
          description?: string | null;
          due_at?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_assignments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      class_assignment_completions: {
        Row: {
          id: string;
          assignment_id: string;
          user_id: string;
          completed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          user_id: string;
          completed_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          assignment_id?: string;
          user_id?: string;
          completed_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_assignment_completions_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "class_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_assignment_completions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      class_user_settings: {
        Row: {
          id: string;
          user_id: string;
          class_id: string;
          is_hidden: boolean;
          accent_color: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          class_id: string;
          is_hidden?: boolean;
          accent_color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          class_id?: string;
          is_hidden?: boolean;
          accent_color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_user_settings_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_user_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
