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
      app_events: {
        Row: {
          created_at: string
          id: string
          path: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          archived_at: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          rtn: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          rtn: string
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          rtn?: string
        }
        Relationships: []
      }
      guests: {
        Row: {
          archived_at: string | null
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          base_price: number
          check_in_date: string
          check_out_date: string
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          base_price?: number
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          number: string
          status?: string
          type?: string
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
      salon_config: {
        Row: {
          coffee_station_capacity: number
          coffee_station_price: number
          cookies_price: number
          id: string
          updated_at: string
        }
        Insert: {
          coffee_station_capacity?: number
          coffee_station_price?: number
          cookies_price?: number
          id?: string
          updated_at?: string
        }
        Update: {
          coffee_station_capacity?: number
          coffee_station_price?: number
          cookies_price?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      salon_menus: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          price_per_person: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price_per_person?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price_per_person?: number
        }
        Relationships: []
      }
      salon_reservation_resources: {
        Row: {
          id: string
          quantity_requested: number
          reservation_id: string
          resource_id: string
        }
        Insert: {
          id?: string
          quantity_requested?: number
          reservation_id: string
          resource_id: string
        }
        Update: {
          id?: string
          quantity_requested?: number
          reservation_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_reservation_resources_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "salon_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_reservation_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "salon_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_reservations: {
        Row: {
          addons_price: number
          attendees: number | null
          base_price: number
          coffee_cookies: boolean
          coffee_station: boolean
          company_id: string | null
          created_at: string
          discount: number
          end_date: string
          final_price: number
          guest_id: string
          id: string
          menu_id: string | null
          notes: string | null
          slot_id: string
          space_id: string | null
          start_date: string
          status: string
        }
        Insert: {
          addons_price?: number
          attendees?: number | null
          base_price?: number
          coffee_cookies?: boolean
          coffee_station?: boolean
          company_id?: string | null
          created_at?: string
          discount?: number
          end_date: string
          final_price?: number
          guest_id: string
          id?: string
          menu_id?: string | null
          notes?: string | null
          slot_id: string
          space_id?: string | null
          start_date: string
          status?: string
        }
        Update: {
          addons_price?: number
          attendees?: number | null
          base_price?: number
          coffee_cookies?: boolean
          coffee_station?: boolean
          company_id?: string | null
          created_at?: string
          discount?: number
          end_date?: string
          final_price?: number
          guest_id?: string
          id?: string
          menu_id?: string | null
          notes?: string | null
          slot_id?: string
          space_id?: string | null
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_reservations_guest_fk"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_reservations_menu_fk"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "salon_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_reservations_slot_fk"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "salon_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_reservations_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "salon_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_resources: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price: number
          quantity: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          quantity?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          quantity?: number
        }
        Relationships: []
      }
      salon_slots: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          name: string
          price_per_day: number
          space_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          name: string
          price_per_day?: number
          space_id: string
          start_time: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          name?: string
          price_per_day?: number
          space_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_slots_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "salon_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_spaces: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
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
      apply_salon_discount: {
        Args: { p_discount: number; p_reservation_id: string }
        Returns: undefined
      }
      archive_company: { Args: { p_company_id: string }; Returns: undefined }
      archive_guest: { Args: { p_guest_id: string }; Returns: undefined }
      archive_room: { Args: { p_room_id: string }; Returns: undefined }
      create_salon_reservation: {
        Args: {
          p_addons_price: number
          p_attendees: number
          p_base_price: number
          p_coffee_cookies: boolean
          p_coffee_station: boolean
          p_end_date: string
          p_final_price: number
          p_guest_id: string
          p_menu_id: string
          p_notes: string
          p_resources: Json
          p_slot_id: string
          p_space_id: string
          p_start_date: string
        }
        Returns: string
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      log_app_event: { Args: { p_path: string }; Returns: undefined }
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
      unarchive_company: { Args: { p_company_id: string }; Returns: undefined }
      unarchive_guest: { Args: { p_guest_id: string }; Returns: undefined }
      unarchive_room: { Args: { p_room_id: string }; Returns: undefined }
      update_guest_recent: {
        Args: {
          p_company_id?: string
          p_email: string
          p_guest_id: string
          p_name: string
          p_phone: string
        }
        Returns: undefined
      }
      update_salon_reservation: {
        Args: {
          p_addons_price: number
          p_attendees: number
          p_base_price: number
          p_coffee_cookies: boolean
          p_coffee_station: boolean
          p_end_date: string
          p_final_price: number
          p_guest_id: string
          p_id: string
          p_menu_id: string
          p_notes: string
          p_resources: Json
          p_slot_id: string
          p_space_id: string
          p_start_date: string
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
