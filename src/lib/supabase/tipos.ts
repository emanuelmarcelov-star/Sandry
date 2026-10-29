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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ajustes: {
        Row: {
          actualizado_en: string
          descuento_max_sin_autorizacion: number
          id: number
          minutos_inactividad: number
          nombre_tienda: string
          redondeo_precio: number
        }
        Insert: {
          actualizado_en?: string
          descuento_max_sin_autorizacion?: number
          id?: number
          minutos_inactividad?: number
          nombre_tienda?: string
          redondeo_precio?: number
        }
        Update: {
          actualizado_en?: string
          descuento_max_sin_autorizacion?: number
          id?: number
          minutos_inactividad?: number
          nombre_tienda?: string
          redondeo_precio?: number
        }
        Relationships: []
      }
      bitacora: {
        Row: {
          accion: string
          detalle: Json
          entidad: string | null
          entidad_id: string | null
          fecha: string
          id: number
          usuario_id: string | null
        }
        Insert: {
          accion: string
          detalle?: Json
          entidad?: string | null
          entidad_id?: string | null
          fecha?: string
          id?: never
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          detalle?: Json
          entidad?: string | null
          entidad_id?: string | null
          fecha?: string
          id?: never
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bitacora_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          activa: boolean
          color: string
          creado_en: string
          icono: string | null
          id: string
          margen_objetivo: number | null
          nombre: string
          orden: number
          padre_id: string | null
          tarifa_iva: string | null
        }
        Insert: {
          activa?: boolean
          color?: string
          creado_en?: string
          icono?: string | null
          id?: string
          margen_objetivo?: number | null
          nombre: string
          orden?: number
          padre_id?: string | null
          tarifa_iva?: string | null
        }
        Update: {
          activa?: boolean
          color?: string
          creado_en?: string
          icono?: string | null
          id?: string
          margen_objetivo?: number | null
          nombre?: string
          orden?: number
          padre_id?: string | null
          tarifa_iva?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_padre_id_fkey"
            columns: ["padre_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      codigos_barras: {
        Row: {
          codigo: string
          creado_en: string
          es_interno: boolean
          presentacion_id: string | null
          producto_id: string
        }
        Insert: {
          codigo: string
          creado_en?: string
          es_interno?: boolean
          presentacion_id?: string | null
          producto_id: string
        }
        Update: {
          codigo?: string
          creado_en?: string
          es_interno?: boolean
          presentacion_id?: string | null
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "codigos_barras_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "codigos_barras_producto_id_presentacion_id_fkey"
            columns: ["producto_id", "presentacion_id"]
            isOneToOne: false
            referencedRelation: "presentaciones"
            referencedColumns: ["producto_id", "id"]
          },
        ]
      }
      dispositivo_usuarios: {
        Row: {
          dispositivo_id: string
          ultimo_acceso: string
          usuario_id: string
        }
        Insert: {
          dispositivo_id: string
          ultimo_acceso?: string
          usuario_id: string
        }
        Update: {
          dispositivo_id?: string
          ultimo_acceso?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispositivo_usuarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      etiquetas_pendientes: {
        Row: {
          desde: string
          presentacion_id: string
          producto_id: string
        }
        Insert: {
          desde?: string
          presentacion_id: string
          producto_id: string
        }
        Update: {
          desde?: string
          presentacion_id?: string
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "etiquetas_pendientes_presentacion_id_fkey"
            columns: ["presentacion_id"]
            isOneToOne: true
            referencedRelation: "presentaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etiquetas_pendientes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      existencias: {
        Row: {
          actualizado_en: string
          cantidad: number
          producto_id: string
        }
        Insert: {
          actualizado_en?: string
          cantidad?: number
          producto_id: string
        }
        Update: {
          actualizado_en?: string
          cantidad?: number
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "existencias_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: true
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      historial_precios: {
        Row: {
          antes: number | null
          despues: number | null
          fecha: string
          id: number
          origen: string
          presentacion_id: string | null
          producto_id: string
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          antes?: number | null
          despues?: number | null
          fecha?: string
          id?: never
          origen?: string
          presentacion_id?: string | null
          producto_id: string
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          antes?: number | null
          despues?: number | null
          fecha?: string
          id?: never
          origen?: string
          presentacion_id?: string | null
          producto_id?: string
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historial_precios_presentacion_id_fkey"
            columns: ["presentacion_id"]
            isOneToOne: false
            referencedRelation: "presentaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_precios_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_precios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      intentos_recuperar_correo: {
        Row: {
          clave: string
          fecha: string
          id: number
        }
        Insert: {
          clave: string
          fecha?: string
          id?: never
        }
        Update: {
          clave?: string
          fecha?: string
          id?: never
        }
        Relationships: []
      }
      movimientos_stock: {
        Row: {
          cantidad: number
          costo_unitario: number | null
          fecha: string
          id: number
          nota: string
          producto_id: string
          referencia_id: string | null
          referencia_tipo: string | null
          saldo: number
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          cantidad: number
          costo_unitario?: number | null
          fecha?: string
          id?: never
          nota?: string
          producto_id: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          saldo: number
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          cantidad?: number
          costo_unitario?: number | null
          fecha?: string
          id?: never
          nota?: string
          producto_id?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          saldo?: number
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_stock_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_stock_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          aprobado_en: string | null
          aprobado_por: string | null
          cedula: string | null
          correo: string
          creado_en: string
          estado: Database["public"]["Enums"]["estado_usuario"]
          foto_ruta: string | null
          id: string
          nombre_completo: string
          rol_id: string | null
          telefono: string
        }
        Insert: {
          aprobado_en?: string | null
          aprobado_por?: string | null
          cedula?: string | null
          correo: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_usuario"]
          foto_ruta?: string | null
          id: string
          nombre_completo: string
          rol_id?: string | null
          telefono?: string
        }
        Update: {
          aprobado_en?: string | null
          aprobado_por?: string | null
          cedula?: string | null
          correo?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_usuario"]
          foto_ruta?: string | null
          id?: string
          nombre_completo?: string
          rol_id?: string | null
          telefono?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_aprobado_por_fkey"
            columns: ["aprobado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfiles_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      permisos: {
        Row: {
          codigo: string
          descripcion: string
          grupo: string
          orden: number
        }
        Insert: {
          codigo: string
          descripcion: string
          grupo: string
          orden?: number
        }
        Update: {
          codigo?: string
          descripcion?: string
          grupo?: string
          orden?: number
        }
        Relationships: []
      }
      pines: {
        Row: {
          actualizado_en: string
          bloqueado_hasta: string | null
          intentos_fallidos: number
          pin_hash: string
          usuario_id: string
        }
        Insert: {
          actualizado_en?: string
          bloqueado_hasta?: string | null
          intentos_fallidos?: number
          pin_hash: string
          usuario_id: string
        }
        Update: {
          actualizado_en?: string
          bloqueado_hasta?: string | null
          intentos_fallidos?: number
          pin_hash?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pines_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      presentaciones: {
        Row: {
          activa: boolean
          es_base: boolean
          factor: number
          id: string
          nombre: string
          orden: number
          para_compra: boolean
          para_venta: boolean
          precio_venta: number | null
          producto_id: string
        }
        Insert: {
          activa?: boolean
          es_base?: boolean
          factor: number
          id?: string
          nombre: string
          orden?: number
          para_compra?: boolean
          para_venta?: boolean
          precio_venta?: number | null
          producto_id: string
        }
        Update: {
          activa?: boolean
          es_base?: boolean
          factor?: number
          id?: string
          nombre?: string
          orden?: number
          para_compra?: boolean
          para_venta?: boolean
          precio_venta?: number | null
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presentaciones_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_costos: {
        Row: {
          actualizado_en: string
          costo_promedio: number
          producto_id: string
          ultimo_costo: number | null
        }
        Insert: {
          actualizado_en?: string
          costo_promedio?: number
          producto_id: string
          ultimo_costo?: number | null
        }
        Update: {
          actualizado_en?: string
          costo_promedio?: number
          producto_id?: string
          ultimo_costo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "producto_costos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: true
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          actualizado_en: string
          categoria_id: string | null
          creado_en: string
          foto_ruta: string | null
          id: string
          maneja_caducidad: boolean
          marca: string
          nombre: string
          pendiente: boolean
          plu: string | null
          retornable: boolean
          sinonimos: string[]
          solo_mayores: boolean
          stock_minimo: number
          tarifa_iva: string
          texto_busqueda: string
          ubicacion: string
          unidad_base: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          categoria_id?: string | null
          creado_en?: string
          foto_ruta?: string | null
          id?: string
          maneja_caducidad?: boolean
          marca?: string
          nombre: string
          pendiente?: boolean
          plu?: string | null
          retornable?: boolean
          sinonimos?: string[]
          solo_mayores?: boolean
          stock_minimo?: number
          tarifa_iva?: string
          texto_busqueda?: string
          ubicacion?: string
          unidad_base?: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          categoria_id?: string | null
          creado_en?: string
          foto_ruta?: string | null
          id?: string
          maneja_caducidad?: boolean
          marca?: string
          nombre?: string
          pendiente?: boolean
          plu?: string | null
          retornable?: boolean
          sinonimos?: string[]
          solo_mayores?: boolean
          stock_minimo?: number
          tarifa_iva?: string
          texto_busqueda?: string
          ubicacion?: string
          unidad_base?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      rol_permisos: {
        Row: {
          permiso: string
          rol_id: string
        }
        Insert: {
          permiso: string
          rol_id: string
        }
        Update: {
          permiso?: string
          rol_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rol_permisos_permiso_fkey"
            columns: ["permiso"]
            isOneToOne: false
            referencedRelation: "permisos"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "rol_permisos_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          descripcion: string
          es_administradora: boolean
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          descripcion?: string
          es_administradora?: boolean
          id: string
          nombre: string
          orden?: number
        }
        Update: {
          descripcion?: string
          es_administradora?: boolean
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      actualizar_ajustes: {
        Args: {
          p_descuento_max: number
          p_minutos_inactividad: number
          p_redondeo_precio?: number
        }
        Returns: undefined
      }
      actualizar_mi_perfil: {
        Args: {
          p_cedula: string
          p_foto_ruta: string
          p_nombre_completo: string
          p_telefono: string
        }
        Returns: undefined
      }
      actualizar_permisos_rol: {
        Args: { p_permisos: string[]; p_rol: string }
        Returns: undefined
      }
      aprobar_usuario: {
        Args: { p_rol: string; p_usuario: string }
        Returns: undefined
      }
      buscar_correo_por_dato: { Args: { p_dato: string }; Returns: string }
      buscar_productos: {
        Args: {
          p_categoria?: string
          p_incluir_inactivos?: boolean
          p_limite?: number
          p_texto: string
        }
        Returns: {
          activo: boolean
          actualizado_en: string
          categoria_id: string | null
          creado_en: string
          foto_ruta: string | null
          id: string
          maneja_caducidad: boolean
          marca: string
          nombre: string
          pendiente: boolean
          plu: string | null
          retornable: boolean
          sinonimos: string[]
          solo_mayores: boolean
          stock_minimo: number
          tarifa_iva: string
          texto_busqueda: string
          ubicacion: string
          unidad_base: string
        }[]
        SetofOptions: {
          from: "*"
          to: "productos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cambiar_estado_usuario: {
        Args: { p_activo: boolean; p_usuario: string }
        Returns: undefined
      }
      cambiar_rol_usuario: {
        Args: { p_rol: string; p_usuario: string }
        Returns: undefined
      }
      cantidad_administradoras_activas: { Args: never; Returns: number }
      categoria_y_descendientes: {
        Args: { p_categoria: string }
        Returns: string[]
      }
      definir_mi_pin: { Args: { p_pin: string }; Returns: undefined }
      ean13_verificador: { Args: { p_doce: string }; Returns: number }
      exigir_permiso: { Args: { p_permiso: string }; Returns: undefined }
      generar_codigo_interno: { Args: never; Returns: string }
      guardar_categoria: { Args: { p: Json }; Returns: string }
      guardar_producto: {
        Args: { p: Json; p_origen?: string }
        Returns: string
      }
      importar_productos: { Args: { p_productos: Json }; Returns: Json }
      marcar_etiquetas_impresas: {
        Args: { p_presentaciones: string[] }
        Returns: undefined
      }
      mis_permisos: { Args: never; Returns: string[] }
      normalizar: { Args: { p_texto: string }; Returns: string }
      registrar_evento: {
        Args: {
          p_accion: string
          p_detalle?: Json
          p_entidad: string
          p_entidad_id: string
          p_usuario: string
        }
        Returns: undefined
      }
      registrar_movimiento: {
        Args: {
          p_cantidad: number
          p_costo: number
          p_nota?: string
          p_producto: string
          p_referencia_id?: string
          p_referencia_tipo?: string
          p_tipo: string
        }
        Returns: number
      }
      resetear_pin: { Args: { p_usuario: string }; Returns: undefined }
      siguiente_plu: { Args: never; Returns: string }
      tengo_pin: { Args: never; Returns: boolean }
      tiene_permiso: { Args: { p_permiso: string }; Returns: boolean }
      usuario_activo: { Args: never; Returns: boolean }
      valores_categoria: {
        Args: { p_categoria: string }
        Returns: {
          margen_objetivo: number
          tarifa_iva: string
        }[]
      }
      verificar_pin: {
        Args: { p_pin: string; p_usuario: string }
        Returns: string
      }
    }
    Enums: {
      estado_usuario: "pendiente" | "activo" | "desactivado"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      estado_usuario: ["pendiente", "activo", "desactivado"],
    },
  },
} as const
