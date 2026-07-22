export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action: string;
          admin_id: string;
          created_at: string;
          details: Json | null;
          id: string;
          target_user_id: string | null;
        };
        Insert: {
          action: string;
          admin_id: string;
          created_at?: string;
          details?: Json | null;
          id?: string;
          target_user_id?: string | null;
        };
        Update: {
          action?: string;
          admin_id?: string;
          created_at?: string;
          details?: Json | null;
          id?: string;
          target_user_id?: string | null;
        };
        Relationships: [];
      };
      banned_words: {
        Row: {
          created_at: string;
          id: string;
          word: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          word: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          word?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          author_id: string;
          content: string;
          created_at: string;
          id: string;
          parent_id: string | null;
          post_id: string;
        };
        Insert: {
          author_id: string;
          content: string;
          created_at?: string;
          id?: string;
          parent_id?: string | null;
          post_id: string;
        };
        Update: {
          author_id?: string;
          content?: string;
          created_at?: string;
          id?: string;
          parent_id?: string | null;
          post_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_members: {
        Row: {
          conversation_id: string;
          joined_at: string;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          joined_at?: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          joined_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_group: boolean;
          name: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_group?: boolean;
          name?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_group?: boolean;
          name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      course_links: {
        Row: {
          course_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          link_type: string | null;
          title: string;
          url: string;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          link_type?: string | null;
          title: string;
          url: string;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          link_type?: string | null;
          title?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "course_links_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
        ];
      };
      course_updates: {
        Row: {
          author_id: string;
          content: string;
          course_id: string;
          created_at: string;
          id: string;
          image_paths: string[];
        };
        Insert: {
          author_id: string;
          content: string;
          course_id: string;
          created_at?: string;
          id?: string;
          image_paths?: string[];
        };
        Update: {
          author_id?: string;
          content?: string;
          course_id?: string;
          created_at?: string;
          id?: string;
          image_paths?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "course_updates_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
        ];
      };
      courses: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          major: Database["public"]["Enums"]["major_code"];
          name: string;
          schedule: Json | null;
          semester: number;
          teacher_id: string | null;
          updated_at: string;
          year: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          major: Database["public"]["Enums"]["major_code"];
          name: string;
          schedule?: Json | null;
          semester: number;
          teacher_id?: string | null;
          updated_at?: string;
          year: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          major?: Database["public"]["Enums"]["major_code"];
          name?: string;
          schedule?: Json | null;
          semester?: number;
          teacher_id?: string | null;
          updated_at?: string;
          year?: number;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          sender_id: string;
        };
        Insert: {
          content: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          sender_id: string;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      post_reactions: {
        Row: {
          created_at: string;
          post_id: string;
          reaction: Database["public"]["Enums"]["reaction_type"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          post_id: string;
          reaction: Database["public"]["Enums"]["reaction_type"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          post_id?: string;
          reaction?: Database["public"]["Enums"]["reaction_type"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_reports: {
        Row: {
          created_at: string;
          id: string;
          post_id: string;
          reason: string;
          reporter_id: string;
          status: Database["public"]["Enums"]["report_status"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          post_id: string;
          reason: string;
          reporter_id: string;
          status?: Database["public"]["Enums"]["report_status"];
        };
        Update: {
          created_at?: string;
          id?: string;
          post_id?: string;
          reason?: string;
          reporter_id?: string;
          status?: Database["public"]["Enums"]["report_status"];
        };
        Relationships: [
          {
            foreignKeyName: "post_reports_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          accepted_answer_id: string | null;
          author_id: string;
          content: string;
          created_at: string;
          id: string;
          image_paths: string[];
          images: string[] | null;
          post_type: Database["public"]["Enums"]["post_type"];
          updated_at: string;
        };
        Insert: {
          accepted_answer_id?: string | null;
          author_id: string;
          content: string;
          created_at?: string;
          id?: string;
          image_paths?: string[];
          images?: string[] | null;
          post_type?: Database["public"]["Enums"]["post_type"];
          updated_at?: string;
        };
        Update: {
          accepted_answer_id?: string | null;
          author_id?: string;
          content?: string;
          created_at?: string;
          id?: string;
          image_paths?: string[];
          images?: string[] | null;
          post_type?: Database["public"]["Enums"]["post_type"];
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          banned: boolean;
          bio: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          major: Database["public"]["Enums"]["major_code"] | null;
          must_change_password: boolean;
          points: number;
          suspended_until: string | null;
          university_number: string;
          updated_at: string;
          verified: boolean;
          warning_count: number;
          year: number | null;
        };
        Insert: {
          avatar_url?: string | null;
          banned?: boolean;
          bio?: string | null;
          created_at?: string;
          email?: string | null;
          full_name: string;
          id: string;
          major?: Database["public"]["Enums"]["major_code"] | null;
          must_change_password?: boolean;
          points?: number;
          suspended_until?: string | null;
          university_number: string;
          updated_at?: string;
          verified?: boolean;
          warning_count?: number;
          year?: number | null;
        };
        Update: {
          avatar_url?: string | null;
          banned?: boolean;
          bio?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          major?: Database["public"]["Enums"]["major_code"] | null;
          must_change_password?: boolean;
          points?: number;
          suspended_until?: string | null;
          university_number?: string;
          updated_at?: string;
          verified?: boolean;
          warning_count?: number;
          year?: number | null;
        };
        Relationships: [];
      };
      saved_posts: {
        Row: {
          created_at: string;
          post_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      user_warnings: {
        Row: {
          created_at: string;
          id: string;
          issued_by: string | null;
          reason: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          issued_by?: string | null;
          reason: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          issued_by?: string | null;
          reason?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_adjust_points: {
        Args: { _delta: number; _user: string };
        Returns: number;
      };
      admin_ban: {
        Args: { _reason: string; _user: string };
        Returns: undefined;
      };
      admin_delete_user: { Args: { _user: string }; Returns: undefined };
      admin_set_verified: {
        Args: { _user: string; _verified: boolean };
        Returns: undefined;
      };
      admin_set_year: {
        Args: { _user: string; _year: number };
        Returns: undefined;
      };
      admin_suspend: {
        Args: { _days: number; _reason: string; _user: string };
        Returns: undefined;
      };
      admin_unban: { Args: { _user: string }; Returns: undefined };
      admin_warn: { Args: { _reason: string; _user: string }; Returns: number };
      award_points: {
        Args: { _delta: number; _user: string };
        Returns: undefined;
      };
      compute_rank: {
        Args: { _points: number };
        Returns: Database["public"]["Enums"]["rank_tier"];
      };
      create_dm: { Args: { _other: string }; Returns: string };
      create_group: {
        Args: { _members: string[]; _name: string };
        Returns: string;
      };
      get_public_profiles: {
        Args: { _ids: string[] };
        Returns: {
          avatar_url: string;
          bio: string;
          full_name: string;
          id: string;
          major: Database["public"]["Enums"]["major_code"];
          points: number;
          university_number: string;
          verified: boolean;
          year: number;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_conversation_member: {
        Args: { _conv: string; _user: string };
        Returns: boolean;
      };
      search_public_profiles: {
        Args: { _q: string };
        Returns: {
          avatar_url: string;
          full_name: string;
          id: string;
          university_number: string;
        }[];
      };
    };
    Enums: {
      app_role: "student" | "teacher" | "admin";
      major_code: "it" | "is" | "se";
      post_type: "general" | "question";
      rank_tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
      reaction_type: "like" | "love" | "haha" | "wow" | "sad";
      report_status: "pending" | "confirmed" | "dismissed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["student", "teacher", "admin"],
      major_code: ["it", "is", "se"],
      post_type: ["general", "question"],
      rank_tier: ["bronze", "silver", "gold", "platinum", "diamond"],
      reaction_type: ["like", "love", "haha", "wow", "sad"],
      report_status: ["pending", "confirmed", "dismissed"],
    },
  },
} as const;
