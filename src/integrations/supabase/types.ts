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
      profiles: {
        Row: {
          active: boolean
          created_at: string
          department: string | null
          display_name: string | null
          employee_code: string | null
          id: string
          job_title: string | null
          shift: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          department?: string | null
          display_name?: string | null
          employee_code?: string | null
          id?: string
          job_title?: string | null
          shift?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          department?: string | null
          display_name?: string | null
          employee_code?: string | null
          id?: string
          job_title?: string | null
          shift?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analysis_records: {
        Row: {
          analyzed_at: string
          comparison_method: string | null
          created_at: string
          delta_e_measured: number | null
          delta_e_threshold: number | null
          failure_reason: string | null
          id: string
          measured_color_hex: string | null
          operator_user_id: string
          processing_time_ms: number
          precision_percent: number | null
          reference_code: string
          reference_color_hex: string | null
          result: string
          required_precision_percent: number | null
          tissue_type: string
        }
        Insert: {
          analyzed_at?: string
          comparison_method?: string | null
          created_at?: string
          delta_e_measured?: number | null
          delta_e_threshold?: number | null
          failure_reason?: string | null
          id?: string
          measured_color_hex?: string | null
          operator_user_id: string
          processing_time_ms: number
          precision_percent?: number | null
          reference_code: string
          reference_color_hex?: string | null
          result: string
          required_precision_percent?: number | null
          tissue_type: string
        }
        Update: {
          analyzed_at?: string
          comparison_method?: string | null
          created_at?: string
          delta_e_measured?: number | null
          delta_e_threshold?: number | null
          failure_reason?: string | null
          id?: string
          measured_color_hex?: string | null
          operator_user_id?: string
          processing_time_ms?: number
          precision_percent?: number | null
          reference_code?: string
          reference_color_hex?: string | null
          result?: string
          required_precision_percent?: number | null
          tissue_type?: string
        }
        Relationships: []
      }
      operator_configurations: {
        Row: {
          active_view: string
          analysis_area_configured: boolean
          color_configured: boolean
          created_at: string
          delta_configured: boolean
          delta_e: number
          id: string
          light_calibrated: boolean
          system_step: string
          reference_color_b: number
          reference_color_g: number
          reference_color_hex: string
          reference_color_r: number
          sample_area_height_percent: number
          sample_area_width_percent: number
          sample_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_view?: string
          analysis_area_configured?: boolean
          color_configured?: boolean
          created_at?: string
          delta_configured?: boolean
          delta_e?: number
          id?: string
          light_calibrated?: boolean
          system_step?: string
          reference_color_b?: number
          reference_color_g?: number
          reference_color_hex?: string
          reference_color_r?: number
          sample_area_height_percent?: number
          sample_area_width_percent?: number
          sample_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_view?: string
          analysis_area_configured?: boolean
          color_configured?: boolean
          created_at?: string
          delta_configured?: boolean
          delta_e?: number
          id?: string
          light_calibrated?: boolean
          system_step?: string
          reference_color_b?: number
          reference_color_g?: number
          reference_color_hex?: string
          reference_color_r?: number
          sample_area_height_percent?: number
          sample_area_width_percent?: number
          sample_points?: number
          updated_at?: string
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
      [_ in never]: never
    }
    Functions: {
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "operador" | "gestor"
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
      app_role: ["operador", "gestor"],
    },
  },
} as const
