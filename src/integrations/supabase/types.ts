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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      guests: {
        Row: {
          archived_at: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      reservations: {
        Row: {
          base_price: number
          check_in_date: string
          check_out_date: string
          created_at: string
          discount: number
          final_price: number
          guest_id: string
          id: string
          notes: string | null
          room_id: string
          room_rate_id: string | null
          status: string
        }
        Insert: {
          base_price: number
          check_in_date: string
          check_out_date: string
          created_at?: string
          discount?: number
          final_price: number
          guest_id: string
          id?: string
          notes?: string | null
          room_id: string
          room_rate_id?: string | null
          status?: string
        }
        Update: {
          base_price?: number
          check_in_date?: string
          check_out_date?: string
          created_at?: string
          discount?: number
          final_price?: number
          guest_id?: string
          id?: string
          notes?: string | null
          room_id?: string
          room_rate_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_guest_fk"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_room_fk"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_room_rate_id_fkey"
            columns: ["room_rate_id"]
            isOneToOne: false
            referencedRelation: "room_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      room_rates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          occupancy: Database["public"]["Enums"]["room_occupancy"]
          price: number
          room_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          occupancy: Database["public"]["Enums"]["room_occupancy"]
          price: number
          room_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          occupancy?: Database["public"]["Enums"]["room_occupancy"]
          price?: number
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_rates_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          archived_at: string | null
          base_price: number
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          number: string
          status: string
          type: string
        }
        Insert: {
          archived_at?: string | null
          base_price: number
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          number: string
          status?: string
          type: string
        }
        Update: {
          archived_at?: string | null
          base_price?: number
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          number?: string
          status?: string
          type?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_user_id: string
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          email: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_guest: { Args: { p_guest_id: string }; Returns: undefined }
      archive_room: { Args: { p_room_id: string }; Returns: undefined }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      report_kpis: {
        Args: { p_end: string; p_start: string }
        Returns: {
          ingresos_estimados: number
          total_canceladas: number
          total_no_show: number
          total_reservas_activas: number
        }[]
      }
      report_occupancy_daily: {
        Args: { p_end: string; p_start: string }
        Returns: {
          day: string
          occupancy_pct: number
          occupied_rooms: number
          total_rooms: number
        }[]
      }
      report_reservations: {
        Args: {
          p_end: string
          p_guest_id?: string
          p_room_id?: string
          p_start: string
          p_status?: string
        }
        Returns: {
          check_in_date: string
          check_out_date: string
          final_price: number
          guest_name: string
          id: string
          occupancy: string
          room_number: string
          status: string
        }[]
      }
      report_revenue_daily: {
        Args: { p_end: string; p_start: string }
        Returns: {
          day: string
          revenue: number
        }[]
      }
      set_room_status: {
        Args: { p_notes?: string; p_room_id: string; p_status: string }
        Returns: undefined
      }
      unarchive_guest: { Args: { p_guest_id: string }; Returns: undefined }
      unarchive_room: { Args: { p_room_id: string }; Returns: undefined }
      update_guest_recent:
        | {
            Args: {
              p_email: string
              p_guest_id: string
              p_name: string
              p_phone: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_email: string
              p_guest_id: string
              p_name: string
              p_notes: string
              p_phone: string
            }
            Returns: undefined
          }
    }
    Enums: {
      room_occupancy: "sencilla" | "doble" | "triple"
      user_role: "admin" | "receptionist"
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
      room_occupancy: ["sencilla", "doble", "triple"],
      user_role: ["admin", "receptionist"],
    },
  },
} as const
