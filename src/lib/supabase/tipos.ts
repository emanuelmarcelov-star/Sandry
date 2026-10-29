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
          dias_aviso_caducidad: number
          dias_sin_movimiento: number
          id: number
          iva_compras: number
          minutos_inactividad: number
          nombre_tienda: string
          redondeo_precio: number
        }
        Insert: {
          actualizado_en?: string
          descuento_max_sin_autorizacion?: number
          dias_aviso_caducidad?: number
          dias_sin_movimiento?: number
          id?: number
          iva_compras?: number
          minutos_inactividad?: number
          nombre_tienda?: string
          redondeo_precio?: number
        }
        Update: {
          actualizado_en?: string
          descuento_max_sin_autorizacion?: number
          dias_aviso_caducidad?: number
          dias_sin_movimiento?: number
          id?: number
          iva_compras?: number
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
      categorias_gasto: {
        Row: {
          activa: boolean
          es_transporte: boolean
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          activa?: boolean
          es_transporte?: boolean
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          activa?: boolean
          es_transporte?: boolean
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
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
      compra_lineas: {
        Row: {
          bonificacion: number
          cantidad: number
          compra_id: string
          costo_total: number
          danados: number
          factor: number
          id: number
          presentacion_id: string
          producto_id: string
          recibido: number | null
          vence: string | null
        }
        Insert: {
          bonificacion?: number
          cantidad: number
          compra_id: string
          costo_total: number
          danados?: number
          factor: number
          id?: never
          presentacion_id: string
          producto_id: string
          recibido?: number | null
          vence?: string | null
        }
        Update: {
          bonificacion?: number
          cantidad?: number
          compra_id?: string
          costo_total?: number
          danados?: number
          factor?: number
          id?: never
          presentacion_id?: string
          producto_id?: string
          recibido?: number | null
          vence?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compra_lineas_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_lineas_presentacion_id_fkey"
            columns: ["presentacion_id"]
            isOneToOne: false
            referencedRelation: "presentaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      compras: {
        Row: {
          con_factura: boolean
          cuenta_id: string | null
          estado: string
          fecha: string
          foto_ruta: string | null
          id: string
          nota: string
          numero_factura: string
          pago: string
          proveedor_id: string | null
          recibida_en: string | null
          recibida_por: string | null
          total: number
          usuario_id: string | null
          vence: string | null
          viaje_id: string | null
        }
        Insert: {
          con_factura?: boolean
          cuenta_id?: string | null
          estado: string
          fecha?: string
          foto_ruta?: string | null
          id: string
          nota?: string
          numero_factura?: string
          pago: string
          proveedor_id?: string | null
          recibida_en?: string | null
          recibida_por?: string | null
          total: number
          usuario_id?: string | null
          vence?: string | null
          viaje_id?: string | null
        }
        Update: {
          con_factura?: boolean
          cuenta_id?: string | null
          estado?: string
          fecha?: string
          foto_ruta?: string | null
          id?: string
          nota?: string
          numero_factura?: string
          pago?: string
          proveedor_id?: string | null
          recibida_en?: string | null
          recibida_por?: string | null
          total?: number
          usuario_id?: string | null
          vence?: string | null
          viaje_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compras_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas_dinero"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_recibida_por_fkey"
            columns: ["recibida_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "viajes"
            referencedColumns: ["id"]
          },
        ]
      }
      conteo_lineas: {
        Row: {
          contado: number | null
          contado_en: string | null
          contado_por: string | null
          conteo_id: string
          producto_id: string
          sistema: number | null
        }
        Insert: {
          contado?: number | null
          contado_en?: string | null
          contado_por?: string | null
          conteo_id: string
          producto_id: string
          sistema?: number | null
        }
        Update: {
          contado?: number | null
          contado_en?: string | null
          contado_por?: string | null
          conteo_id?: string
          producto_id?: string
          sistema?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conteo_lineas_contado_por_fkey"
            columns: ["contado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conteo_lineas_conteo_id_fkey"
            columns: ["conteo_id"]
            isOneToOne: false
            referencedRelation: "conteos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conteo_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      conteos: {
        Row: {
          aprobado_en: string | null
          aprobado_por: string | null
          categoria_id: string | null
          creado_en: string
          creado_por: string | null
          enviado_en: string | null
          estado: string
          id: string
          nombre: string
        }
        Insert: {
          aprobado_en?: string | null
          aprobado_por?: string | null
          categoria_id?: string | null
          creado_en?: string
          creado_por?: string | null
          enviado_en?: string | null
          estado?: string
          id?: string
          nombre: string
        }
        Update: {
          aprobado_en?: string | null
          aprobado_por?: string | null
          categoria_id?: string | null
          creado_en?: string
          creado_por?: string | null
          enviado_en?: string | null
          estado?: string
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "conteos_aprobado_por_fkey"
            columns: ["aprobado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conteos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conteos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cuentas_dinero: {
        Row: {
          activa: boolean
          creado_en: string
          id: string
          nombre: string
          orden: number
          tipo: string
        }
        Insert: {
          activa?: boolean
          creado_en?: string
          id?: string
          nombre: string
          orden?: number
          tipo: string
        }
        Update: {
          activa?: boolean
          creado_en?: string
          id?: string
          nombre?: string
          orden?: number
          tipo?: string
        }
        Relationships: []
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
      envases: {
        Row: {
          activo: boolean
          creado_en: string
          garantia: number
          id: string
          nombre: string
          proveedor_id: string | null
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          garantia?: number
          id?: string
          nombre: string
          proveedor_id?: string | null
        }
        Update: {
          activo?: boolean
          creado_en?: string
          garantia?: number
          id?: string
          nombre?: string
          proveedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "envases_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
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
      gastos: {
        Row: {
          categoria_id: string
          cuenta_id: string
          descripcion: string
          fecha: string
          foto_ruta: string | null
          id: string
          monto: number
          usuario_id: string | null
          viaje_id: string | null
        }
        Insert: {
          categoria_id: string
          cuenta_id: string
          descripcion?: string
          fecha?: string
          foto_ruta?: string | null
          id: string
          monto: number
          usuario_id?: string | null
          viaje_id?: string | null
        }
        Update: {
          categoria_id?: string
          cuenta_id?: string
          descripcion?: string
          fecha?: string
          foto_ruta?: string | null
          id?: string
          monto?: number
          usuario_id?: string | null
          viaje_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_gasto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas_dinero"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "viajes"
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
      lotes: {
        Row: {
          cantidad: number
          cantidad_inicial: number
          compra_id: string | null
          creado_en: string
          id: number
          producto_id: string
          vence: string
        }
        Insert: {
          cantidad: number
          cantidad_inicial: number
          compra_id?: string | null
          creado_en?: string
          id?: never
          producto_id: string
          vence: string
        }
        Update: {
          cantidad?: number
          cantidad_inicial?: number
          compra_id?: string | null
          creado_en?: string
          id?: never
          producto_id?: string
          vence?: string
        }
        Relationships: [
          {
            foreignKeyName: "lotes_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_dinero: {
        Row: {
          cuenta_id: string
          descripcion: string
          fecha: string
          id: number
          monto: number
          motivo: string
          referencia_id: string | null
          referencia_tipo: string | null
          usuario_id: string | null
        }
        Insert: {
          cuenta_id: string
          descripcion?: string
          fecha?: string
          id?: never
          monto: number
          motivo: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          usuario_id?: string | null
        }
        Update: {
          cuenta_id?: string
          descripcion?: string
          fecha?: string
          id?: never
          monto?: number
          motivo?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_dinero_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas_dinero"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_dinero_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_envases: {
        Row: {
          cantidad: number
          compra_id: string | null
          debidos: number
          envase_id: string
          fecha: string
          garantias: number
          id: number
          nota: string
          tipo: string
          usuario_id: string | null
          vacios: number
        }
        Insert: {
          cantidad: number
          compra_id?: string | null
          debidos?: number
          envase_id: string
          fecha?: string
          garantias?: number
          id?: never
          nota?: string
          tipo: string
          usuario_id?: string | null
          vacios?: number
        }
        Update: {
          cantidad?: number
          compra_id?: string | null
          debidos?: number
          envase_id?: string
          fecha?: string
          garantias?: number
          id?: never
          nota?: string
          tipo?: string
          usuario_id?: string | null
          vacios?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_envases_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_envases_envase_id_fkey"
            columns: ["envase_id"]
            isOneToOne: false
            referencedRelation: "envases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_envases_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
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
      pagos_proveedor: {
        Row: {
          compra_id: string
          cuenta_id: string
          fecha: string
          id: number
          monto: number
          nota: string
          usuario_id: string | null
        }
        Insert: {
          compra_id: string
          cuenta_id: string
          fecha?: string
          id?: never
          monto: number
          nota?: string
          usuario_id?: string | null
        }
        Update: {
          compra_id?: string
          cuenta_id?: string
          fecha?: string
          id?: never
          monto?: number
          nota?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_proveedor_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_proveedor_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas_dinero"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_proveedor_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_lineas: {
        Row: {
          cantidad: number
          pedido_id: string
          presentacion_id: string
          producto_id: string
        }
        Insert: {
          cantidad: number
          pedido_id: string
          presentacion_id: string
          producto_id: string
        }
        Update: {
          cantidad?: number
          pedido_id?: string
          presentacion_id?: string
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_lineas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_lineas_presentacion_id_fkey"
            columns: ["presentacion_id"]
            isOneToOne: false
            referencedRelation: "presentaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          compra_id: string | null
          estado: string
          fecha: string
          id: string
          nota: string
          proveedor_id: string
          usuario_id: string | null
        }
        Insert: {
          compra_id?: string | null
          estado?: string
          fecha?: string
          id?: string
          nota?: string
          proveedor_id: string
          usuario_id?: string | null
        }
        Update: {
          compra_id?: string | null
          estado?: string
          fecha?: string
          id?: string
          nota?: string
          proveedor_id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_usuario_id_fkey"
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
          compra_con_iva: boolean
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
          compra_con_iva?: boolean
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
          compra_con_iva?: boolean
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
      proveedores: {
        Row: {
          activo: boolean
          condiciones: string
          contacto: string
          creado_en: string
          dias_visita: number[]
          direccion: string
          id: string
          nombre: string
          notas: string
          ruc: string
          telefono: string
          tipo: string
        }
        Insert: {
          activo?: boolean
          condiciones?: string
          contacto?: string
          creado_en?: string
          dias_visita?: number[]
          direccion?: string
          id?: string
          nombre: string
          notas?: string
          ruc?: string
          telefono?: string
          tipo?: string
        }
        Update: {
          activo?: boolean
          condiciones?: string
          contacto?: string
          creado_en?: string
          dias_visita?: number[]
          direccion?: string
          id?: string
          nombre?: string
          notas?: string
          ruc?: string
          telefono?: string
          tipo?: string
        }
        Relationships: []
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
      viaje_lista: {
        Row: {
          cantidad: number | null
          producto_id: string
          tachado: boolean
          viaje_id: string
        }
        Insert: {
          cantidad?: number | null
          producto_id: string
          tachado?: boolean
          viaje_id: string
        }
        Update: {
          cantidad?: number | null
          producto_id?: string
          tachado?: boolean
          viaje_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viaje_lista_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viaje_lista_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "viajes"
            referencedColumns: ["id"]
          },
        ]
      }
      viajes: {
        Row: {
          estado: string
          id: string
          inicio: string
          nota: string
          recibido_en: string | null
          recibido_por: string | null
          usuario_id: string | null
        }
        Insert: {
          estado?: string
          id: string
          inicio?: string
          nota?: string
          recibido_en?: string | null
          recibido_por?: string | null
          usuario_id?: string | null
        }
        Update: {
          estado?: string
          id?: string
          inicio?: string
          nota?: string
          recibido_en?: string | null
          recibido_por?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "viajes_recibido_por_fkey"
            columns: ["recibido_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viajes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      actualizar_ajustes: {
        Args: {
          p_descuento_max: number
          p_iva_compras?: number
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
      ajustar_stock: {
        Args: {
          p_cantidad: number
          p_costo?: number
          p_nota?: string
          p_producto: string
          p_tipo: string
        }
        Returns: number
      }
      anotar_conteo: {
        Args: { p_contado: number; p_conteo: string; p_producto: string }
        Returns: undefined
      }
      anular_conteo: { Args: { p_conteo: string }; Returns: undefined }
      aprobar_conteo: {
        Args: { p_conteo: string; p_productos?: string[] }
        Returns: number
      }
      aprobar_usuario: {
        Args: { p_rol: string; p_usuario: string }
        Returns: undefined
      }
      asignar_codigo_interno: { Args: { p_producto: string }; Returns: string }
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
          compra_con_iva: boolean
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
      cuentas_por_pagar: {
        Args: never
        Returns: {
          compra_id: string
          fecha: string
          numero_factura: string
          pagado: number
          proveedor: string
          saldo: number
          telefono: string
          total: number
          vence: string
        }[]
      }
      definir_mi_pin: { Args: { p_pin: string }; Returns: undefined }
      detallar_compra: {
        Args: { p_compra: string; p_lineas: Json }
        Returns: undefined
      }
      ean13_verificador: { Args: { p_doce: string }; Returns: number }
      entrar_compra: { Args: { p_compra: string }; Returns: Json }
      enviar_conteo: { Args: { p_conteo: string }; Returns: undefined }
      exigir_permiso: { Args: { p_permiso: string }; Returns: undefined }
      generar_codigo_interno: { Args: never; Returns: string }
      guardar_categoria: { Args: { p: Json }; Returns: string }
      guardar_cuenta: { Args: { p: Json }; Returns: string }
      guardar_envase: { Args: { p: Json }; Returns: string }
      guardar_lineas_compra: {
        Args: { p_compra: string; p_lineas: Json }
        Returns: number
      }
      guardar_pedido: { Args: { p: Json }; Returns: string }
      guardar_producto: {
        Args: { p: Json; p_origen?: string }
        Returns: string
      }
      guardar_proveedor: { Args: { p: Json }; Returns: string }
      importar_productos: { Args: { p_productos: Json }; Returns: Json }
      iniciar_conteo: {
        Args: { p_categoria?: string; p_nombre: string }
        Returns: string
      }
      iniciar_viaje: { Args: { p_id: string; p_lista?: Json }; Returns: string }
      lista_sugerida: {
        Args: never
        Returns: {
          nombre: string
          producto_id: string
          proveedor: string
          proveedor_id: string
          stock: number
          stock_minimo: number
          sugerido: number
          unidad_base: string
          vendido_4_semanas: number
        }[]
      }
      marcar_etiquetas_impresas: {
        Args: { p_presentaciones: string[] }
        Returns: undefined
      }
      marcar_lista_viaje: {
        Args: { p_producto: string; p_tachado: boolean; p_viaje: string }
        Returns: undefined
      }
      marcar_pedido: {
        Args: { p_compra?: string; p_estado: string; p_pedido: string }
        Returns: undefined
      }
      mis_permisos: { Args: never; Returns: string[] }
      mover_dinero: { Args: { p: Json }; Returns: undefined }
      normalizar: { Args: { p_texto: string }; Returns: string }
      pagar_compra: { Args: { p: Json }; Returns: undefined }
      precios_por_lugar: {
        Args: { p_producto: string }
        Returns: {
          costo: number
          fecha: string
          lugar: string
          proveedor_id: string
        }[]
      }
      productos_sin_movimiento: {
        Args: { p_dias: number }
        Returns: {
          nombre: string
          producto_id: string
          stock: number
          ultimo: string
          unidad_base: string
        }[]
      }
      recibir_viaje: {
        Args: { p_lineas?: Json; p_viaje: string }
        Returns: Json
      }
      registrar_compra: { Args: { p: Json }; Returns: Json }
      registrar_dinero: {
        Args: {
          p_cuenta: string
          p_descripcion?: string
          p_monto: number
          p_motivo: string
          p_referencia_id?: string
          p_referencia_tipo?: string
        }
        Returns: undefined
      }
      registrar_envases: { Args: { p: Json }; Returns: undefined }
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
      registrar_gasto: { Args: { p: Json }; Returns: string }
      registrar_lote: {
        Args: { p_cantidad: number; p_producto: string; p_vence: string }
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
      saldos_cuentas: {
        Args: never
        Returns: {
          activa: boolean
          id: string
          nombre: string
          orden: number
          saldo: number
          tipo: string
        }[]
      }
      saldos_envases: {
        Args: never
        Returns: {
          activo: boolean
          debidos: number
          garantia: number
          garantias: number
          id: string
          nombre: string
          proveedor: string
          vacios: number
        }[]
      }
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
