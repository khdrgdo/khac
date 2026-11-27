export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      anonymous_authors: {
        Row: {
          author_id: string
          content_id: string
          content_type: string
          created_at: string
        }
        Insert: {
          author_id: string
          content_id: string
          content_type: string
          created_at?: string
        }
        Update: {
          author_id?: string
          content_id?: string
          content_type?: string
          created_at?: string
        }
        Relationships: []
      }
      app_version: {
        Row: {
          apk_url: string
          id: number
          latest_version_code: number
          latest_version_name: string
          min_supported_version_code: number
          notes: string
          updated_at: string
        }
        Insert: {
          apk_url?: string
          id?: number
          latest_version_code: number
          latest_version_name: string
          min_supported_version_code?: number
          notes?: string
          updated_at?: string
        }
        Update: {
          apk_url?: string
          id?: number
          latest_version_code?: number
          latest_version_name?: string
          min_supported_version_code?: number
          notes?: string
          updated_at?: string
        }
        Relationships: []
      }
      banned_words: {
        Row: {
          created_at: string
          id: string
          word: string
        }
        Insert: {
          created_at?: string
          id?: string
          word: string
        }
        Update: {
          created_at?: string
          id?: string
          word?: string
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          id: string
          is_anonymous: boolean
          parent_id: string | null
          post_id: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          parent_id?: string | null
          post_id: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          parent_id?: string | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          hidden_at: string | null
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          hidden_at?: string | null
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          hidden_at?: string | null
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_group: boolean
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      course_links: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          id: string
          is_important: boolean
          lecture_id: string | null
          link_type: string | null
          title: string
          url: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_important?: boolean
          lecture_id?: string | null
          link_type?: string | null
          title: string
          url: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_important?: boolean
          lecture_id?: string | null
          link_type?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_links_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_links_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      course_updates: {
        Row: {
          author_id: string
          content: string
          course_id: string
          created_at: string
          id: string
          image_paths: string[]
        }
        Insert: {
          author_id: string
          content: string
          course_id: string
          created_at?: string
          id?: string
          image_paths?: string[]
        }
        Update: {
          author_id?: string
          content?: string
          course_id?: string
          created_at?: string
          id?: string
          image_paths?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "course_updates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          major: Database["public"]["Enums"]["major_code"]
          name: string
          schedule: Json | null
          semester: number
          teacher_id: string | null
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          major: Database["public"]["Enums"]["major_code"]
          name: string
          schedule?: Json | null
          semester: number
          teacher_id?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          major?: Database["public"]["Enums"]["major_code"]
          name?: string
          schedule?: Json | null
          semester?: number
          teacher_id?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_requests: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          recipient_id: string
          sender_id: string
          status: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          recipient_id: string
          sender_id: string
          status?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          recipient_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_requests_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lecture_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          lecture_id: string
          parent_id: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          lecture_id: string
          parent_id?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          lecture_id?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lecture_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecture_comments_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecture_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "lecture_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      lectures: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lectures_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          id: string
          message_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          reaction: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reports: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          note: string | null
          reason: string
          reported_user_id: string
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          reason: string
          reported_user_id: string
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "message_reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      name_change_requests: {
        Row: {
          contact_info: string | null
          created_at: string
          current_name: string
          id: string
          processed_at: string | null
          reason: string
          requested_name: string
          status: string
          university_number: string | null
          user_id: string
        }
        Insert: {
          contact_info?: string | null
          created_at?: string
          current_name: string
          id?: string
          processed_at?: string | null
          reason?: string
          requested_name: string
          status?: string
          university_number?: string | null
          user_id: string
        }
        Update: {
          contact_info?: string | null
          created_at?: string
          current_name?: string
          id?: string
          processed_at?: string | null
          reason?: string
          requested_name?: string
          status?: string
          university_number?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "name_change_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_avatar: string | null
          actor_id: string | null
          actor_name: string | null
          body: string
          created_at: string
          id: string
          link: string | null
          priority: string
          read: boolean
          recipient_id: string
          title: string
          type: string
        }
        Insert: {
          actor_avatar?: string | null
          actor_id?: string | null
          actor_name?: string | null
          body: string
          created_at?: string
          id?: string
          link?: string | null
          priority?: string
          read?: boolean
          recipient_id: string
          title: string
          type?: string
        }
        Update: {
          actor_avatar?: string | null
          actor_id?: string | null
          actor_name?: string | null
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          priority?: string
          read?: boolean
          recipient_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pinned_cards: {
        Row: {
          action_button_text: string | null
          action_button_url: string | null
          badge_text: string
          created_at: string
          description: string
          enabled: boolean
          end_date: string | null
          id: string
          image_url: string | null
          participants: Json
          poll_options: Json
          target_major: string | null
          target_year: number | null
          theme: string
          title: string
          type: string
          updated_at: string
          votes: Json
        }
        Insert: {
          action_button_text?: string | null
          action_button_url?: string | null
          badge_text: string
          created_at?: string
          description: string
          enabled?: boolean
          end_date?: string | null
          id: string
          image_url?: string | null
          participants?: Json
          poll_options?: Json
          target_major?: string | null
          target_year?: number | null
          theme: string
          title: string
          type: string
          updated_at?: string
          votes?: Json
        }
        Update: {
          action_button_text?: string | null
          action_button_url?: string | null
          badge_text?: string
          created_at?: string
          description?: string
          enabled?: boolean
          end_date?: string | null
          id?: string
          image_url?: string | null
          participants?: Json
          poll_options?: Json
          target_major?: string | null
          target_year?: number | null
          theme?: string
          title?: string
          type?: string
          updated_at?: string
          votes?: Json
        }
        Relationships: []
      }
      post_reactions: {
        Row: {
          created_at: string
          post_id: string
          reaction: Database["public"]["Enums"]["reaction_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          reaction: Database["public"]["Enums"]["reaction_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          reaction?: Database["public"]["Enums"]["reaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reports: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reason: string
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reason: string
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reason?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          accepted_answer_id: string | null
          author_id: string | null
          content: string
          created_at: string
          id: string
          image_paths: string[]
          images: string[] | null
          is_anonymous: boolean
          lecture_id: string | null
          post_type: Database["public"]["Enums"]["post_type"]
          updated_at: string
        }
        Insert: {
          accepted_answer_id?: string | null
          author_id?: string | null
          content: string
          created_at?: string
          id?: string
          image_paths?: string[]
          images?: string[] | null
          is_anonymous?: boolean
          lecture_id?: string | null
          post_type?: Database["public"]["Enums"]["post_type"]
          updated_at?: string
        }
        Update: {
          accepted_answer_id?: string | null
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          image_paths?: string[]
          images?: string[] | null
          is_anonymous?: boolean
          lecture_id?: string | null
          post_type?: Database["public"]["Enums"]["post_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_accepted_answer_id_fkey"
            columns: ["accepted_answer_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned: boolean
          bio: string | null
          card_theme_id: string | null
          created_at: string
          dm_open: boolean
          email: string | null
          full_name: string
          hide_university_number: boolean | null
          id: string
          major: Database["public"]["Enums"]["major_code"] | null
          must_change_password: boolean
          points: number
          suspended_until: string | null
          terms_accepted_at: string | null
          theme: string | null
          university_number: string
          updated_at: string
          verified: boolean
          warning_count: number
          year: number | null
        }
        Insert: {
          avatar_url?: string | null
          banned?: boolean
          bio?: string | null
          card_theme_id?: string | null
          created_at?: string
          dm_open?: boolean
          email?: string | null
          full_name: string
          hide_university_number?: boolean | null
          id: string
          major?: Database["public"]["Enums"]["major_code"] | null
          must_change_password?: boolean
          points?: number
          suspended_until?: string | null
          terms_accepted_at?: string | null
          theme?: string | null
          university_number: string
          updated_at?: string
          verified?: boolean
          warning_count?: number
          year?: number | null
        }
        Update: {
          avatar_url?: string | null
          banned?: boolean
          bio?: string | null
          card_theme_id?: string | null
          created_at?: string
          dm_open?: boolean
          email?: string | null
          full_name?: string
          hide_university_number?: boolean | null
          id?: string
          major?: Database["public"]["Enums"]["major_code"] | null
          must_change_password?: boolean
          points?: number
          suspended_until?: string | null
          terms_accepted_at?: string | null
          theme?: string | null
          university_number?: string
          updated_at?: string
          verified?: boolean
          warning_count?: number
          year?: number | null
        }
        Relationships: []
      }
      push_config: {
        Row: {
          id: number
          secret: string
        }
        Insert: {
          id?: number
          secret?: string
        }
        Update: {
          id?: number
          secret?: string
        }
        Relationships: []
      }
      saved_posts: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      subadmin_permissions: {
        Row: {
          can_courses: boolean
          can_reports: boolean
          can_suspend: boolean
          can_teachers: boolean
          can_warn: boolean
          can_words: boolean
          created_at: string
          user_id: string
        }
        Insert: {
          can_courses?: boolean
          can_reports?: boolean
          can_suspend?: boolean
          can_teachers?: boolean
          can_warn?: boolean
          can_words?: boolean
          created_at?: string
          user_id: string
        }
        Update: {
          can_courses?: boolean
          can_reports?: boolean
          can_suspend?: boolean
          can_teachers?: boolean
          can_warn?: boolean
          can_words?: boolean
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_warnings: {
        Row: {
          created_at: string
          id: string
          issued_by: string | null
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issued_by?: string | null
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issued_by?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_points: {
        Args: { _delta: number; _user: string }
        Returns: number
      }
      admin_ban: {
        Args: { _reason: string; _user: string }
        Returns: undefined
      }
      admin_delete_user: { Args: { _user: string }; Returns: undefined }
      admin_set_teacher_role: { Args: { _user: string }; Returns: undefined }
      admin_set_user_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _user: string }
        Returns: undefined
      }
      admin_set_verified: {
        Args: { _user: string; _verified: boolean }
        Returns: undefined
      }
      admin_set_year: {
        Args: { _user: string; _year: number }
        Returns: undefined
      }
      admin_suspend: {
        Args: { _days: number; _reason: string; _user: string }
        Returns: undefined
      }
      admin_unban: { Args: { _user: string }; Returns: undefined }
      admin_warn: { Args: { _reason: string; _user: string }; Returns: number }
      assert_not_main_admin: { Args: { _target: string }; Returns: undefined }
      award_points: {
        Args: { _delta: number; _user: string }
        Returns: undefined
      }
      block_state: { Args: { _other: string }; Returns: Json }
      can_manage_courses: { Args: { _u: string }; Returns: boolean }
      compute_rank: {
        Args: { _points: number }
        Returns: Database["public"]["Enums"]["rank_tier"]
      }
      create_comment_as: {
        Args: {
          _anonymous?: boolean
          _content: string
          _parent_id?: string
          _post_id: string
        }
        Returns: string
      }
      create_dm: { Args: { _other: string }; Returns: string }
      create_group: {
        Args: { _members: string[]; _name: string }
        Returns: string
      }
      create_post_as: {
        Args: {
          _anonymous?: boolean
          _content: string
          _images?: string[]
          _post_type?: Database["public"]["Enums"]["post_type"]
        }
        Returns: string
      }
      delete_conversation: {
        Args: { _conv_id: string; _user_id: string }
        Returns: undefined
      }
      get_anonymous_authors: {
        Args: { _ids: string[]; _type: string }
        Returns: {
          author_id: string
          avatar_url: string
          content_id: string
          full_name: string
          university_number: string
        }[]
      }
      get_conversation_unread_counts: {
        Args: { _user_id: string }
        Returns: {
          conversation_id: string
          unread_count: number
        }[]
      }
      get_courses_with_counts: {
        Args: never
        Returns: {
          created_at: string
          files_count: number
          id: string
          links_count: number
          major: string
          name: string
          semester: number
          teacher_name: string
          year: number
        }[]
      }
      get_daily_posts: {
        Args: { since: string }
        Returns: {
          count: number
          day: string
        }[]
      }
      get_daily_user_registrations: {
        Args: { since: string }
        Returns: {
          count: number
          day: string
        }[]
      }
      get_leaderboard_profiles: {
        Args: {
          _major?: Database["public"]["Enums"]["major_code"]
          _year?: number
        }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          major: Database["public"]["Enums"]["major_code"]
          points: number
          university_number: string
          verified: boolean
          year: number
        }[]
      }
      get_public_profiles: {
        Args: { _ids: string[] }
        Returns: {
          avatar_url: string
          bio: string
          full_name: string
          id: string
          major: Database["public"]["Enums"]["major_code"]
          points: number
          university_number: string
          verified: boolean
          year: number
        }[]
      }
      get_recent_admin_activity: {
        Args: never
        Returns: {
          activity_type: string
          created_at: string
          description: string
          id: string
          user_name: string
        }[]
      }
      get_unread_message_count: { Args: { _user_id: string }; Returns: number }
      guardian_can_act_on: { Args: { _target: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_subadmin_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      hidden_univ_ids: { Args: { _ids: string[] }; Returns: Json }
      is_anonymous_owner: {
        Args: { _id: string; _type: string; _user: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_main_admin: { Args: { _user_id: string }; Returns: boolean }
      leave_conversation: {
        Args: { _conv_id: string; _user_id: string }
        Returns: undefined
      }
      main_admin_id: { Args: never; Returns: string }
      mark_conversation_read: {
        Args: { _conv_id: string; _user_id: string }
        Returns: undefined
      }
      my_staff_caps: { Args: never; Returns: Json }
      nexus_is_admin: { Args: never; Returns: boolean }
      public_card_theme: { Args: { _id: string }; Returns: string }
      reported_users: {
        Args: never
        Returns: {
          avatar_url: string
          full_name: string
          message_report_count: number
          post_report_count: number
          user_id: string
        }[]
      }
      resolve_login_email: { Args: { _number: string }; Returns: string }
      search_public_profiles: {
        Args: { _q: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          university_number: string
        }[]
      }
      set_terms_accepted: { Args: never; Returns: undefined }
      share_lecture_as_post: {
        Args: { _content: string; _lecture_id: string }
        Returns: string
      }
      toggle_pinned_card_participation: {
        Args: { p_user_id: string }
        Returns: Json
      }
      univ_number_exists: { Args: { _q: string }; Returns: boolean }
      user_has_reports: { Args: { _target: string }; Returns: boolean }
      vote_on_poll: {
        Args: { p_option_id: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "student" | "teacher" | "admin" | "sub_admin"
      major_code: "it" | "is" | "se"
      post_type: "general" | "question"
      rank_tier: "bronze" | "silver" | "gold" | "platinum" | "diamond"
      reaction_type: "like" | "love" | "haha" | "wow" | "sad"
      report_status: "pending" | "confirmed" | "dismissed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["student", "teacher", "admin", "sub_admin"],
      major_code: ["it", "is", "se"],
      post_type: ["general", "question"],
      rank_tier: ["bronze", "silver", "gold", "platinum", "diamond"],
      reaction_type: ["like", "love", "haha", "wow", "sad"],
      report_status: ["pending", "confirmed", "dismissed"],
    },
  },
} as const
