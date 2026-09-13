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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_media: {
        Row: {
          acquire_url: string | null
          demo_url: string | null
          description: string | null
          github_url: string | null
          id: number
          image_urls: string[] | null
          indiehackers_url: string | null
          instagram_url: string | null
          producthunt_url: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          acquire_url?: string | null
          demo_url?: string | null
          description?: string | null
          github_url?: string | null
          id?: number
          image_urls?: string[] | null
          indiehackers_url?: string | null
          instagram_url?: string | null
          producthunt_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          acquire_url?: string | null
          demo_url?: string | null
          description?: string | null
          github_url?: string | null
          id?: number
          image_urls?: string[] | null
          indiehackers_url?: string | null
          instagram_url?: string | null
          producthunt_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      auction_settings: {
        Row: {
          app_name: string
          demo_video_url: string | null
          description: string
          end_time: string
          features: Json
          hero_image_url: string | null
          id: number
          includes: Json
          is_manually_ended: boolean
          perks: Json
          reserve_price: number
          start_time: string
          starting_bid: number
          tagline: string
          tech_stack: Json
          updated_at: string
          winner_announced: boolean
          winner_profile_id: string | null
        }
        Insert: {
          app_name?: string
          demo_video_url?: string | null
          description?: string
          end_time: string
          features?: Json
          hero_image_url?: string | null
          id: number
          includes?: Json
          is_manually_ended?: boolean
          perks?: Json
          reserve_price?: number
          start_time: string
          starting_bid?: number
          tagline?: string
          tech_stack?: Json
          updated_at?: string
          winner_announced?: boolean
          winner_profile_id?: string | null
        }
        Update: {
          app_name?: string
          demo_video_url?: string | null
          description?: string
          end_time?: string
          features?: Json
          hero_image_url?: string | null
          id?: number
          includes?: Json
          is_manually_ended?: boolean
          perks?: Json
          reserve_price?: number
          start_time?: string
          starting_bid?: number
          tagline?: string
          tech_stack?: Json
          updated_at?: string
          winner_announced?: boolean
          winner_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auction_settings_winner_profile_id_fkey"
            columns: ["winner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_settings_winner_profile_id_fkey"
            columns: ["winner_profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          amount: number
          country: string
          created_at: string
          display_name: string
          id: string
          is_winner: boolean
          profile_id: string | null
        }
        Insert: {
          amount: number
          country: string
          created_at?: string
          display_name: string
          id?: string
          is_winner?: boolean
          profile_id?: string | null
        }
        Update: {
          amount?: number
          country?: string
          created_at?: string
          display_name?: string
          id?: string
          is_winner?: boolean
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bids_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agreed_to_pay: boolean
          agreed_to_public: boolean
          country: string
          created_at: string
          display_name: string
          email: string
          id: string
          phone: string | null
          user_id: string
        }
        Insert: {
          agreed_to_pay?: boolean
          agreed_to_public?: boolean
          country: string
          created_at?: string
          display_name: string
          email: string
          id?: string
          phone?: string | null
          user_id: string
        }
        Update: {
          agreed_to_pay?: boolean
          agreed_to_public?: boolean
          country?: string
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          phone?: string | null
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
    }
    Views: {
      public_bids: {
        Row: {
          amount: number | null
          country: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          is_winner: boolean | null
          profile_id: string | null
        }
        Insert: {
          amount?: number | null
          country?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          is_winner?: boolean | null
          profile_id?: string | null
        }
        Update: {
          amount?: number | null
          country?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          is_winner?: boolean | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bids_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profiles: {
        Row: {
          country: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_public_auction_settings: {
        Args: never
        Returns: {
          app_name: string
          demo_video_url: string
          description: string
          end_time: string
          features: Json
          hero_image_url: string
          id: number
          includes: Json
          is_manually_ended: boolean
          perks: Json
          start_time: string
          starting_bid: number
          tagline: string
          tech_stack: Json
          updated_at: string
          winner_announced: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      place_bid: {
        Args: { _amount: number }
        Returns: {
          amount: number | null
          country: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          is_winner: boolean | null
          profile_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "public_bids"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
