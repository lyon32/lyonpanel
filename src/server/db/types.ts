export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      admin_notes: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'admin_notes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      allowed_signups: {
        Row: {
          added_at: string;
          email: string;
        };
        Insert: {
          added_at?: string;
          email: string;
        };
        Update: {
          added_at?: string;
          email?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: Json | null;
          id: number;
          target_id: string | null;
          target_table: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json | null;
          id?: number;
          target_id?: string | null;
          target_table?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json | null;
          id?: number;
          target_id?: string | null;
          target_table?: string | null;
        };
        Relationships: [];
      };
      favorites: {
        Row: {
          created_at: string;
          service_id: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          service_id: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          service_id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'favorites_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'favorites_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services_public';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'favorites_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      idempotency_keys: {
        Row: {
          created_at: string;
          key: string;
          request_hash: string;
          response: Json | null;
          route: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          key: string;
          request_hash: string;
          response?: Json | null;
          route: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          key?: string;
          request_hash?: string;
          response?: Json | null;
          route?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      jap_balance_snapshots: {
        Row: {
          balance_usd: number;
          id: number;
          reserved_usd: number | null;
          taken_at: string;
        };
        Insert: {
          balance_usd: number;
          id?: number;
          reserved_usd?: number | null;
          taken_at?: string;
        };
        Update: {
          balance_usd?: number;
          id?: number;
          reserved_usd?: number | null;
          taken_at?: string;
        };
        Relationships: [];
      };
      login_attempts: {
        Row: {
          created_at: string;
          id: number;
          identifier_hash: string;
          ip_hash: string | null;
          success: boolean;
        };
        Insert: {
          created_at?: string;
          id?: number;
          identifier_hash: string;
          ip_hash?: string | null;
          success: boolean;
        };
        Update: {
          created_at?: string;
          id?: number;
          identifier_hash?: string;
          ip_hash?: string | null;
          success?: boolean;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          charged_xaf: number;
          comments: string[] | null;
          cost_usd: number | null;
          created_at: string;
          discount_pct: number;
          error: string | null;
          id: string;
          idem_key: string;
          jap_order_id: number | null;
          link: string;
          price_xaf_1000: number;
          quantity: number;
          remains: number | null;
          service_id: number;
          short_id: number;
          start_count: number | null;
          status: Database['public']['Enums']['order_status'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          charged_xaf: number;
          comments?: string[] | null;
          cost_usd?: number | null;
          created_at?: string;
          discount_pct?: number;
          error?: string | null;
          id?: string;
          idem_key: string;
          jap_order_id?: number | null;
          link: string;
          price_xaf_1000: number;
          quantity: number;
          remains?: number | null;
          service_id: number;
          short_id?: number;
          start_count?: number | null;
          status?: Database['public']['Enums']['order_status'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          charged_xaf?: number;
          comments?: string[] | null;
          cost_usd?: number | null;
          created_at?: string;
          discount_pct?: number;
          error?: string | null;
          id?: string;
          idem_key?: string;
          jap_order_id?: number | null;
          link?: string;
          price_xaf_1000?: number;
          quantity?: number;
          remains?: number | null;
          service_id?: number;
          short_id?: number;
          start_count?: number | null;
          status?: Database['public']['Enums']['order_status'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services_public';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          created_at: string;
          credited_xaf: number;
          fee_xaf: number;
          id: string;
          idem_key: string;
          pay_currency: string;
          raw_webhook: Json | null;
          saspay_network: string | null;
          saspay_session_id: string;
          saspay_transaction_id: string | null;
          status: Database['public']['Enums']['payment_status'];
          succeeded_at: string | null;
          total_paid: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          credited_xaf: number;
          fee_xaf: number;
          id?: string;
          idem_key: string;
          pay_currency: string;
          raw_webhook?: Json | null;
          saspay_network?: string | null;
          saspay_session_id: string;
          saspay_transaction_id?: string | null;
          status?: Database['public']['Enums']['payment_status'];
          succeeded_at?: string | null;
          total_paid: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          credited_xaf?: number;
          fee_xaf?: number;
          id?: string;
          idem_key?: string;
          pay_currency?: string;
          raw_webhook?: Json | null;
          saspay_network?: string | null;
          saspay_session_id?: string;
          saspay_transaction_id?: string | null;
          status?: Database['public']['Enums']['payment_status'];
          succeeded_at?: string | null;
          total_paid?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          blocked_reason: string | null;
          country: string;
          created_at: string;
          custom_discount_pct: number | null;
          daily_spend_limit_xaf: number;
          deleted_at: string | null;
          display_currency: Database['public']['Enums']['currency_code'];
          email: string | null;
          id: string;
          is_admin: boolean;
          language: string;
          phone: string | null;
          referral_code: string;
          referred_by: string | null;
          status: Database['public']['Enums']['user_status'];
          updated_at: string;
        };
        Insert: {
          blocked_reason?: string | null;
          country: string;
          created_at?: string;
          custom_discount_pct?: number | null;
          daily_spend_limit_xaf?: number;
          deleted_at?: string | null;
          display_currency?: Database['public']['Enums']['currency_code'];
          email?: string | null;
          id: string;
          is_admin?: boolean;
          language?: string;
          phone?: string | null;
          referral_code: string;
          referred_by?: string | null;
          status?: Database['public']['Enums']['user_status'];
          updated_at?: string;
        };
        Update: {
          blocked_reason?: string | null;
          country?: string;
          created_at?: string;
          custom_discount_pct?: number | null;
          daily_spend_limit_xaf?: number;
          deleted_at?: string | null;
          display_currency?: Database['public']['Enums']['currency_code'];
          email?: string | null;
          id?: string;
          is_admin?: boolean;
          language?: string;
          phone?: string | null;
          referral_code?: string;
          referred_by?: string | null;
          status?: Database['public']['Enums']['user_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_referred_by_fkey';
            columns: ['referred_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      rate_limits: {
        Row: {
          count: number;
          key: string;
          window_start: string;
        };
        Insert: {
          count?: number;
          key: string;
          window_start: string;
        };
        Update: {
          count?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      referral_rewards: {
        Row: {
          amount_xaf: number;
          created_at: string;
          id: string;
          payment_id: string;
          referee_id: string;
          referrer_id: string;
        };
        Insert: {
          amount_xaf: number;
          created_at?: string;
          id?: string;
          payment_id: string;
          referee_id: string;
          referrer_id: string;
        };
        Update: {
          amount_xaf?: number;
          created_at?: string;
          id?: string;
          payment_id?: string;
          referee_id?: string;
          referrer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'referral_rewards_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'referral_rewards_referee_id_fkey';
            columns: ['referee_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'referral_rewards_referrer_id_fkey';
            columns: ['referrer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      service_price_history: {
        Row: {
          changed_at: string;
          cost_usd_1000: number | null;
          id: number;
          margin_pct: number | null;
          price_xaf_1000: number | null;
          reason: string | null;
          service_id: number;
          usd_xaf_rate: number | null;
        };
        Insert: {
          changed_at?: string;
          cost_usd_1000?: number | null;
          id?: number;
          margin_pct?: number | null;
          price_xaf_1000?: number | null;
          reason?: string | null;
          service_id: number;
          usd_xaf_rate?: number | null;
        };
        Update: {
          changed_at?: string;
          cost_usd_1000?: number | null;
          id?: number;
          margin_pct?: number | null;
          price_xaf_1000?: number | null;
          reason?: string | null;
          service_id?: number;
          usd_xaf_rate?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'service_price_history_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_price_history_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services_public';
            referencedColumns: ['id'];
          },
        ];
      };
      services: {
        Row: {
          active: boolean;
          available: boolean;
          cancel: boolean;
          category: string | null;
          cost_usd_1000: number | null;
          dripfeed: boolean;
          id: number;
          jap_name: string | null;
          jap_type: string | null;
          margin_pct: number | null;
          max_qty: number;
          min_qty: number;
          name_fr: string | null;
          platform: string;
          price_xaf_1000: number | null;
          refill: boolean;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          available?: boolean;
          cancel?: boolean;
          category?: string | null;
          cost_usd_1000?: number | null;
          dripfeed?: boolean;
          id: number;
          jap_name?: string | null;
          jap_type?: string | null;
          margin_pct?: number | null;
          max_qty: number;
          min_qty: number;
          name_fr?: string | null;
          platform: string;
          price_xaf_1000?: number | null;
          refill?: boolean;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          available?: boolean;
          cancel?: boolean;
          category?: string | null;
          cost_usd_1000?: number | null;
          dripfeed?: boolean;
          id?: number;
          jap_name?: string | null;
          jap_type?: string | null;
          margin_pct?: number | null;
          max_qty?: number;
          min_qty?: number;
          name_fr?: string | null;
          platform?: string;
          price_xaf_1000?: number | null;
          refill?: boolean;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value: Json;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      ticket_attachments: {
        Row: {
          created_at: string;
          id: string;
          message_id: string;
          mime: string;
          size_bytes: number;
          storage_path: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message_id: string;
          mime: string;
          size_bytes: number;
          storage_path: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          message_id?: string;
          mime?: string;
          size_bytes?: number;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ticket_attachments_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'ticket_messages';
            referencedColumns: ['id'];
          },
        ];
      };
      ticket_messages: {
        Row: {
          body: string | null;
          created_at: string;
          from_admin: boolean;
          id: string;
          ticket_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          from_admin?: boolean;
          id?: string;
          ticket_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          from_admin?: boolean;
          id?: string;
          ticket_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ticket_messages_ticket_id_fkey';
            columns: ['ticket_id'];
            isOneToOne: false;
            referencedRelation: 'tickets';
            referencedColumns: ['id'];
          },
        ];
      };
      tickets: {
        Row: {
          created_at: string;
          id: string;
          order_id: string | null;
          status: Database['public']['Enums']['ticket_status'];
          subject: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          order_id?: string | null;
          status?: Database['public']['Enums']['ticket_status'];
          subject: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          order_id?: string | null;
          status?: Database['public']['Enums']['ticket_status'];
          subject?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tickets_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      wallet_transactions: {
        Row: {
          amount_xaf: number;
          balance_after_xaf: number;
          created_at: string;
          created_by: string | null;
          id: string;
          note: string | null;
          order_id: string | null;
          payment_id: string | null;
          ref: string;
          type: Database['public']['Enums']['tx_type'];
          user_id: string;
        };
        Insert: {
          amount_xaf: number;
          balance_after_xaf: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string | null;
          order_id?: string | null;
          payment_id?: string | null;
          ref: string;
          type: Database['public']['Enums']['tx_type'];
          user_id: string;
        };
        Update: {
          amount_xaf?: number;
          balance_after_xaf?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string | null;
          order_id?: string | null;
          payment_id?: string | null;
          ref?: string;
          type?: Database['public']['Enums']['tx_type'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wallet_transactions_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wallet_transactions_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wallet_transactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      wallets: {
        Row: {
          balance_xaf: number;
          total_recharged_xaf: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          balance_xaf?: number;
          total_recharged_xaf?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          balance_xaf?: number;
          total_recharged_xaf?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wallets_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      services_public: {
        Row: {
          cancel: boolean | null;
          category: string | null;
          dripfeed: boolean | null;
          id: number | null;
          jap_type: string | null;
          max_qty: number | null;
          min_qty: number | null;
          name_fr: string | null;
          platform: string | null;
          price_xaf_1000: number | null;
          refill: boolean | null;
          sort_order: number | null;
        };
        Insert: {
          cancel?: boolean | null;
          category?: string | null;
          dripfeed?: boolean | null;
          id?: number | null;
          jap_type?: string | null;
          max_qty?: number | null;
          min_qty?: number | null;
          name_fr?: string | null;
          platform?: string | null;
          price_xaf_1000?: number | null;
          refill?: boolean | null;
          sort_order?: number | null;
        };
        Update: {
          cancel?: boolean | null;
          category?: string | null;
          dripfeed?: boolean | null;
          id?: number | null;
          jap_type?: string | null;
          max_qty?: number | null;
          min_qty?: number | null;
          name_fr?: string | null;
          platform?: string | null;
          price_xaf_1000?: number | null;
          refill?: boolean | null;
          sort_order?: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      admin_adjust: {
        Args: {
          p_admin: string;
          p_amount: number;
          p_note: string;
          p_user: string;
        };
        Returns: number;
      };
      anonymize_user: { Args: { p_user: string }; Returns: undefined };
      caller_not_deleted: { Args: never; Returns: boolean };
      credit_payment: {
        Args: {
          p_fee_xaf: number;
          p_net_amount_xaf: number;
          p_network: string;
          p_payment_id: string;
          p_raw: Json;
          p_saspay_transaction_id: string;
          p_total_paid: number;
        };
        Returns: Json;
      };
      is_admin: { Args: never; Returns: boolean };
      place_order: {
        Args: {
          p_comments: string[];
          p_expected_price_xaf_1000?: number;
          p_idem_key: string;
          p_link: string;
          p_qty: number;
          p_service: number;
          p_user: string;
        };
        Returns: {
          charged_xaf: number;
          comments: string[] | null;
          cost_usd: number | null;
          created_at: string;
          discount_pct: number;
          error: string | null;
          id: string;
          idem_key: string;
          jap_order_id: number | null;
          link: string;
          price_xaf_1000: number;
          quantity: number;
          remains: number | null;
          service_id: number;
          short_id: number;
          start_count: number | null;
          status: Database['public']['Enums']['order_status'];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'orders';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      refund_order: {
        Args: { p_admin: string; p_amount: number; p_order: string };
        Returns: {
          charged_xaf: number;
          comments: string[] | null;
          cost_usd: number | null;
          created_at: string;
          discount_pct: number;
          error: string | null;
          id: string;
          idem_key: string;
          jap_order_id: number | null;
          link: string;
          price_xaf_1000: number;
          quantity: number;
          remains: number | null;
          service_id: number;
          short_id: number;
          start_count: number | null;
          status: Database['public']['Enums']['order_status'];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'orders';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      currency_code: 'XAF' | 'XOF' | 'USD';
      order_status:
        'pending' | 'in_progress' | 'completed' | 'partial' | 'canceled' | 'to_review' | 'refunded';
      payment_status: 'created' | 'pending' | 'succeeded' | 'failed';
      ticket_status: 'open' | 'answered' | 'closed';
      tx_type: 'recharge' | 'order' | 'refund' | 'referral_bonus' | 'adjustment';
      user_status: 'active' | 'blocked' | 'deleted';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      currency_code: ['XAF', 'XOF', 'USD'],
      order_status: [
        'pending',
        'in_progress',
        'completed',
        'partial',
        'canceled',
        'to_review',
        'refunded',
      ],
      payment_status: ['created', 'pending', 'succeeded', 'failed'],
      ticket_status: ['open', 'answered', 'closed'],
      tx_type: ['recharge', 'order', 'refund', 'referral_bonus', 'adjustment'],
      user_status: ['active', 'blocked', 'deleted'],
    },
  },
} as const;
