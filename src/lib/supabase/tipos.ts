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
      abonos: {
        Row: {
          caja_id: string | null
          cliente_id: string
          fecha: string
          forma_pago_id: string
          id: number
          monto: number
          nota: string
          usuario_id: string | null
        }
        Insert: {
          caja_id?: string | null
          cliente_id: string
          fecha?: string
          forma_pago_id: string
          id?: never
          monto: number
          nota?: string
          usuario_id?: string | null
        }
        Update: {
          caja_id?: string | null
          cliente_id?: string
          fecha?: string
          forma_pago_id?: string
          id?: never
          monto?: number
          nota?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abonos_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abonos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abonos_forma_pago_id_fkey"
            columns: ["forma_pago_id"]
            isOneToOne: false
            referencedRelation: "formas_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abonos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ajustes: {
        Row: {
          actualizado_en: string
          alcohol_desde: string | null
          alcohol_hasta: string | null
          banco: Json
          descuento_max_sin_autorizacion: number
          deuna_qr_ruta: string | null
          dias_aviso_caducidad: number
          dias_sin_movimiento: number
          id: number
          iva_compras: number
          minutos_inactividad: number
          nombre_tienda: string
          redondeo_precio: number
          ticket_ancho: number
          ticket_mensaje: string
          venta_sin_stock: string
        }
        Insert: {
          actualizado_en?: string
          alcohol_desde?: string | null
          alcohol_hasta?: string | null
          banco?: Json
          descuento_max_sin_autorizacion?: number
          deuna_qr_ruta?: string | null
          dias_aviso_caducidad?: number
          dias_sin_movimiento?: number
          id?: number
          iva_compras?: number
          minutos_inactividad?: number
          nombre_tienda?: string
          redondeo_precio?: number
          ticket_ancho?: number
          ticket_mensaje?: string
          venta_sin_stock?: string
        }
        Update: {
          actualizado_en?: string
          alcohol_desde?: string | null
          alcohol_hasta?: string | null
          banco?: Json
          descuento_max_sin_autorizacion?: number
          deuna_qr_ruta?: string | null
          dias_aviso_caducidad?: number
          dias_sin_movimiento?: number
          id?: number
          iva_compras?: number
          minutos_inactividad?: number
          nombre_tienda?: string
          redondeo_precio?: number
          ticket_ancho?: number
          ticket_mensaje?: string
          venta_sin_stock?: string
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
      cajas: {
        Row: {
          abierta_en: string
          abierta_por: string | null
          cerrada_en: string | null
          cerrada_por: string | null
          contado: number | null
          conteo: Json | null
          diferencia: number | null
          esperado: number | null
          estado: string
          fondo: number
          id: string
          nota: string
        }
        Insert: {
          abierta_en?: string
          abierta_por?: string | null
          cerrada_en?: string | null
          cerrada_por?: string | null
          contado?: number | null
          conteo?: Json | null
          diferencia?: number | null
          esperado?: number | null
          estado?: string
          fondo: number
          id?: string
          nota?: string
        }
        Update: {
          abierta_en?: string
          abierta_por?: string | null
          cerrada_en?: string | null
          cerrada_por?: string | null
          contado?: number | null
          conteo?: Json | null
          diferencia?: number | null
          esperado?: number | null
          estado?: string
          fondo?: number
          id?: string
          nota?: string
        }
        Relationships: [
          {
            foreignKeyName: "cajas_abierta_por_fkey"
            columns: ["abierta_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cajas_cerrada_por_fkey"
            columns: ["cerrada_por"]
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
      clientes: {
        Row: {
          activo: boolean
          correo: string
          creado_en: string
          direccion: string
          id: string
          identificacion: string
          limite_credito: number
          nombre: string
          notas: string
          telefono: string
        }
        Insert: {
          activo?: boolean
          correo?: string
          creado_en?: string
          direccion?: string
          id?: string
          identificacion?: string
          limite_credito?: number
          nombre: string
          notas?: string
          telefono?: string
        }
        Update: {
          activo?: boolean
          correo?: string
          creado_en?: string
          direccion?: string
          id?: string
          identificacion?: string
          limite_credito?: number
          nombre?: string
          notas?: string
          telefono?: string
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
      devoluciones: {
        Row: {
          autorizado_por: string | null
          cuenta_id: string | null
          fecha: string
          id: number
          lineas: Json
          monto: number
          motivo: string
          usuario_id: string | null
          venta_id: string
        }
        Insert: {
          autorizado_por?: string | null
          cuenta_id?: string | null
          fecha?: string
          id?: never
          lineas: Json
          monto: number
          motivo: string
          usuario_id?: string | null
          venta_id: string
        }
        Update: {
          autorizado_por?: string | null
          cuenta_id?: string | null
          fecha?: string
          id?: never
          lineas?: Json
          monto?: number
          motivo?: string
          usuario_id?: string | null
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devoluciones_autorizado_por_fkey"
            columns: ["autorizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas_dinero"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
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
      formas_pago: {
        Row: {
          activa: boolean
          codigo_sri: string
          cuenta_id: string | null
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          activa?: boolean
          codigo_sri?: string
          cuenta_id?: string | null
          id: string
          nombre: string
          orden?: number
        }
        Update: {
          activa?: boolean
          codigo_sri?: string
          cuenta_id?: string | null
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "formas_pago_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas_dinero"
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
      intentos_autorizacion: {
        Row: {
          fecha: string
          id: number
          usuario_id: string
        }
        Insert: {
          fecha?: string
          id?: never
          usuario_id: string
        }
        Update: {
          fecha?: string
          id?: never
          usuario_id?: string
        }
        Relationships: []
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
      venta_linea_costos: {
        Row: {
          costo_total: number
          costo_unitario: number
          linea_id: number
        }
        Insert: {
          costo_total: number
          costo_unitario: number
          linea_id: number
        }
        Update: {
          costo_total?: number
          costo_unitario?: number
          linea_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "venta_linea_costos_linea_id_fkey"
            columns: ["linea_id"]
            isOneToOne: true
            referencedRelation: "venta_lineas"
            referencedColumns: ["id"]
          },
        ]
      }
      venta_lineas: {
        Row: {
          cantidad: number
          descripcion: string
          descuento: number
          devuelto: number
          factor: number
          id: number
          precio: number
          presentacion_id: string | null
          producto_id: string | null
          revisar: boolean
          total: number
          venta_id: string
        }
        Insert: {
          cantidad: number
          descripcion: string
          descuento?: number
          devuelto?: number
          factor?: number
          id?: never
          precio: number
          presentacion_id?: string | null
          producto_id?: string | null
          revisar?: boolean
          total: number
          venta_id: string
        }
        Update: {
          cantidad?: number
          descripcion?: string
          descuento?: number
          devuelto?: number
          factor?: number
          id?: never
          precio?: number
          presentacion_id?: string | null
          producto_id?: string | null
          revisar?: boolean
          total?: number
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_lineas_presentacion_id_fkey"
            columns: ["presentacion_id"]
            isOneToOne: false
            referencedRelation: "presentaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_lineas_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      venta_pagos: {
        Row: {
          cambio: number | null
          forma_pago_id: string
          id: number
          monto: number
          recibido: number | null
          referencia: string
          venta_id: string
        }
        Insert: {
          cambio?: number | null
          forma_pago_id: string
          id?: never
          monto: number
          recibido?: number | null
          referencia?: string
          venta_id: string
        }
        Update: {
          cambio?: number | null
          forma_pago_id?: string
          id?: never
          monto?: number
          recibido?: number | null
          referencia?: string
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_pagos_forma_pago_id_fkey"
            columns: ["forma_pago_id"]
            isOneToOne: false
            referencedRelation: "formas_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_pagos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      ventas: {
        Row: {
          anulada_en: string | null
          anulada_por: string | null
          autorizado_por: string | null
          caja_id: string | null
          cliente_id: string | null
          descuento: number
          estado: string
          fecha: string
          id: string
          motivo_anulacion: string | null
          nota: string
          numero: number
          subtotal: number
          total: number
          usuario_id: string | null
        }
        Insert: {
          anulada_en?: string | null
          anulada_por?: string | null
          autorizado_por?: string | null
          caja_id?: string | null
          cliente_id?: string | null
          descuento?: number
          estado?: string
          fecha?: string
          id: string
          motivo_anulacion?: string | null
          nota?: string
          numero?: never
          subtotal: number
          total: number
          usuario_id?: string | null
        }
        Update: {
          anulada_en?: string | null
          anulada_por?: string | null
          autorizado_por?: string | null
          caja_id?: string | null
          cliente_id?: string | null
          descuento?: number
          estado?: string
          fecha?: string
          id?: string
          motivo_anulacion?: string | null
          nota?: string
          numero?: never
          subtotal?: number
          total?: number
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_anulada_por_fkey"
            columns: ["anulada_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_autorizado_por_fkey"
            columns: ["autorizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
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
      abrir_caja: { Args: { p_fondo: number }; Returns: string }
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
      autorizar: { Args: { p_permiso: string; p_pin: string }; Returns: string }
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
      cerrar_caja: { Args: { p_conteo: Json; p_nota?: string }; Returns: Json }
      clientes_con_saldo: {
        Args: never
        Returns: {
          activo: boolean
          id: string
          identificacion: string
          limite_credito: number
          nombre: string
          saldo: number
          telefono: string
          ultima_compra: string
        }[]
      }
      crear_producto_pendiente: {
        Args: { p_codigo?: string; p_nombre: string; p_precio: number }
        Returns: Json
      }
      cuenta_caja: { Args: never; Returns: string }
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
      devolver_venta: { Args: { p: Json }; Returns: number }
      ean13_verificador: { Args: { p_doce: string }; Returns: number }
      entrar_compra: { Args: { p_compra: string }; Returns: Json }
      enviar_conteo: { Args: { p_conteo: string }; Returns: undefined }
      exigir_permiso: { Args: { p_permiso: string }; Returns: undefined }
      generar_codigo_interno: { Args: never; Returns: string }
      guardar_ajustes_venta: { Args: { p: Json }; Returns: undefined }
      guardar_categoria: { Args: { p: Json }; Returns: string }
      guardar_cliente: { Args: { p: Json }; Returns: string }
      guardar_cuenta: { Args: { p: Json }; Returns: string }
      guardar_envase: { Args: { p: Json }; Returns: string }
      guardar_forma_pago: {
        Args: { p_activa: boolean; p_cuenta: string; p_id: string }
        Returns: undefined
      }
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
      productos_favoritos: {
        Args: { p_limite?: number }
        Returns: {
          producto_id: string
          puntos: number
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
      puede_ver_venta: { Args: { p_usuario: string }; Returns: boolean }
      reabrir_caja: { Args: never; Returns: undefined }
      recibir_viaje: {
        Args: { p_lineas?: Json; p_viaje: string }
        Returns: Json
      }
      registrar_abono: { Args: { p: Json }; Returns: undefined }
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
      registrar_venta: { Args: { p: Json }; Returns: Json }
      resetear_pin: { Args: { p_usuario: string }; Returns: undefined }
      resumen_caja: { Args: { p_caja?: string }; Returns: Json }
      saldo_cuenta: { Args: { p_cuenta: string }; Returns: number }
      saldo_fiado: { Args: { p_cliente: string }; Returns: number }
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
      usuario_tiene_permiso: {
        Args: { p_permiso: string; p_usuario: string }
        Returns: boolean
      }
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
