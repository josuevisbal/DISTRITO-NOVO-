export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      caja_movimientos: {
        Row: {
          creado_en: string
          id: string
          medio: Database["public"]["Enums"]["medio_pago"] | null
          monto: number
          nota: string | null
          pedido_id: string | null
          tipo: string
          turno_id: string
          usuario_id: string | null
          propina: number
        }
        Insert: {
          creado_en?: string
          id?: string
          medio?: Database["public"]["Enums"]["medio_pago"] | null
          monto: number
          nota?: string | null
          pedido_id?: string | null
          tipo: string
          turno_id: string
          usuario_id?: string | null
          propina?: number
        }
        Update: {
          creado_en?: string
          id?: string
          medio?: Database["public"]["Enums"]["medio_pago"] | null
          monto?: number
          nota?: string | null
          pedido_id?: string | null
          tipo?: string
          turno_id?: string
          usuario_id?: string | null
          propina?: number
        }
        Relationships: [
          {
            foreignKeyName: "caja_movimientos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimientos_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "caja_turnos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimientos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      caja_turnos: {
        Row: {
          abierto_en: string
          abierto_por: string | null
          base_inicial: number
          cerrado_en: string | null
          cerrado_por: string | null
          diferencia: number | null
          efectivo_contado: number | null
          id: string
          nota: string | null
          restaurante_id: string
        }
        Insert: {
          abierto_en?: string
          abierto_por?: string | null
          base_inicial?: number
          cerrado_en?: string | null
          cerrado_por?: string | null
          diferencia?: number | null
          efectivo_contado?: number | null
          id?: string
          nota?: string | null
          restaurante_id: string
        }
        Update: {
          abierto_en?: string
          abierto_por?: string | null
          base_inicial?: number
          cerrado_en?: string | null
          cerrado_por?: string | null
          diferencia?: number | null
          efectivo_contado?: number | null
          id?: string
          nota?: string | null
          restaurante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caja_turnos_abierto_por_fkey"
            columns: ["abierto_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_turnos_cerrado_por_fkey"
            columns: ["cerrado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_turnos_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          activa: boolean
          id: string
          nombre: string
          orden: number
          restaurante_id: string
          slug: string
        }
        Insert: {
          activa?: boolean
          id?: string
          nombre: string
          orden?: number
          restaurante_id: string
          slug: string
        }
        Update: {
          activa?: boolean
          id?: string
          nombre?: string
          orden?: number
          restaurante_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      comandas: {
        Row: {
          disparo_en: string
          estacion_id: string
          estado: Database["public"]["Enums"]["estado_comanda"]
          id: string
          iniciado_en: string | null
          listo_en: string | null
          minutos: number
          pedido_id: string
          ronda: number
        }
        Insert: {
          disparo_en: string
          estacion_id: string
          estado?: Database["public"]["Enums"]["estado_comanda"]
          id?: string
          iniciado_en?: string | null
          listo_en?: string | null
          minutos: number
          pedido_id: string
          ronda?: number
        }
        Update: {
          disparo_en?: string
          estacion_id?: string
          estado?: Database["public"]["Enums"]["estado_comanda"]
          id?: string
          iniciado_en?: string | null
          listo_en?: string | null
          minutos?: number
          pedido_id?: string
          ronda?: number
        }
        Relationships: [
          {
            foreignKeyName: "comandas_estacion_id_fkey"
            columns: ["estacion_id"]
            isOneToOne: false
            referencedRelation: "estaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comandas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      estaciones: {
        Row: {
          activa: boolean
          color: string
          id: string
          nombre: string
          orden: number
          restaurante_id: string
          slug: string
        }
        Insert: {
          activa?: boolean
          color?: string
          id?: string
          nombre: string
          orden?: number
          restaurante_id: string
          slug: string
        }
        Update: {
          activa?: boolean
          color?: string
          id?: string
          nombre?: string
          orden?: number
          restaurante_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "estaciones_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      mesas: {
        Row: {
          activa: boolean
          id: string
          numero: number
          qr_token: string
          restaurante_id: string
        }
        Insert: {
          activa?: boolean
          id?: string
          numero: number
          qr_token?: string
          restaurante_id: string
        }
        Update: {
          activa?: boolean
          id?: string
          numero?: number
          qr_token?: string
          restaurante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mesas_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos: {
        Row: {
          comprobante_url: string | null
          creado_en: string
          estado: Database["public"]["Enums"]["estado_pago"]
          id: string
          medio: Database["public"]["Enums"]["medio_pago"]
          monto: number
          pedido_id: string
          referencia: string | null
          verificado_en: string | null
          verificado_por: string | null
        }
        Insert: {
          comprobante_url?: string | null
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_pago"]
          id?: string
          medio: Database["public"]["Enums"]["medio_pago"]
          monto: number
          pedido_id: string
          referencia?: string | null
          verificado_en?: string | null
          verificado_por?: string | null
        }
        Update: {
          comprobante_url?: string | null
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_pago"]
          id?: string
          medio?: Database["public"]["Enums"]["medio_pago"]
          monto?: number
          pedido_id?: string
          referencia?: string | null
          verificado_en?: string | null
          verificado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_verificado_por_fkey"
            columns: ["verificado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_items: {
        Row: {
          cantidad: number
          estacion_id: string
          id: string
          minutos_snap: number
          nombre_snap: string
          notas: string | null
          pedido_id: string
          precio_snap: number
          producto_id: string
          promocion_id: string | null
          ronda: number
        }
        Insert: {
          cantidad: number
          estacion_id: string
          id?: string
          minutos_snap: number
          nombre_snap: string
          notas?: string | null
          pedido_id: string
          precio_snap: number
          producto_id: string
          promocion_id?: string | null
          ronda?: number
        }
        Update: {
          cantidad?: number
          estacion_id?: string
          id?: string
          minutos_snap?: number
          nombre_snap?: string
          notas?: string | null
          pedido_id?: string
          precio_snap?: number
          producto_id?: string
          promocion_id?: string | null
          ronda?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_items_estacion_id_fkey"
            columns: ["estacion_id"]
            isOneToOne: false
            referencedRelation: "estaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_items_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          anulado_por: string | null
          canal: Database["public"]["Enums"]["canal_pedido"]
          cliente_nombre: string | null
          cliente_tel: string | null
          codigo_pago: number | null
          confirmado_en: string | null
          confirmado_por: string | null
          creado_en: string
          direccion: string | null
          domiciliario_id: string | null
          domicilio: number
          en_edicion: string | null
          entregado_en: string | null
          estado: Database["public"]["Enums"]["estado_pedido"]
          id: string
          indicaciones: string | null
          medio_pago: Database["public"]["Enums"]["medio_pago"] | null
          mesa_id: string | null
          monto_exacto: number | null
          motivo_anulacion: string | null
          nota_entrega: string | null
          numero: number
          objetivo_en: string | null
          restaurante_id: string
          subtotal: number
          token: string
          total: number
          zona_id: string | null
          propina: number
          servido_en: string | null
        }
        Insert: {
          anulado_por?: string | null
          canal: Database["public"]["Enums"]["canal_pedido"]
          cliente_nombre?: string | null
          cliente_tel?: string | null
          codigo_pago?: number | null
          confirmado_en?: string | null
          confirmado_por?: string | null
          creado_en?: string
          direccion?: string | null
          domiciliario_id?: string | null
          domicilio?: number
          en_edicion?: string | null
          entregado_en?: string | null
          estado?: Database["public"]["Enums"]["estado_pedido"]
          id?: string
          indicaciones?: string | null
          medio_pago?: Database["public"]["Enums"]["medio_pago"] | null
          mesa_id?: string | null
          monto_exacto?: number | null
          motivo_anulacion?: string | null
          nota_entrega?: string | null
          numero?: number
          objetivo_en?: string | null
          restaurante_id: string
          subtotal?: number
          token?: string
          total?: number
          zona_id?: string | null
          propina?: number
          servido_en?: string | null
        }
        Update: {
          anulado_por?: string | null
          canal?: Database["public"]["Enums"]["canal_pedido"]
          cliente_nombre?: string | null
          cliente_tel?: string | null
          codigo_pago?: number | null
          confirmado_en?: string | null
          confirmado_por?: string | null
          creado_en?: string
          direccion?: string | null
          domiciliario_id?: string | null
          domicilio?: number
          en_edicion?: string | null
          entregado_en?: string | null
          estado?: Database["public"]["Enums"]["estado_pedido"]
          id?: string
          indicaciones?: string | null
          medio_pago?: Database["public"]["Enums"]["medio_pago"] | null
          mesa_id?: string | null
          monto_exacto?: number | null
          motivo_anulacion?: string | null
          nota_entrega?: string | null
          numero?: number
          objetivo_en?: string | null
          restaurante_id?: string
          subtotal?: number
          token?: string
          total?: number
          zona_id?: string | null
          propina?: number
          servido_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_anulado_por_fkey"
            columns: ["anulado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_confirmado_por_fkey"
            columns: ["confirmado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_domiciliario_id_fkey"
            columns: ["domiciliario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_mesa_id_fkey"
            columns: ["mesa_id"]
            isOneToOne: false
            referencedRelation: "mesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_zona_id_fkey"
            columns: ["zona_id"]
            isOneToOne: false
            referencedRelation: "zonas_domicilio"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_costos: {
        Row: {
          actualizado_en: string
          costo: number
          producto_id: string
        }
        Insert: {
          actualizado_en?: string
          costo?: number
          producto_id: string
        }
        Update: {
          actualizado_en?: string
          costo?: number
          producto_id?: string
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
          categoria_id: string
          descripcion: string | null
          destacado: boolean
          disponible: boolean
          estacion_id: string
          foto_url: string | null
          id: string
          minutos_prep: number
          nombre: string
          orden: number
          precio: number
          restaurante_id: string
        }
        Insert: {
          activo?: boolean
          categoria_id: string
          descripcion?: string | null
          destacado?: boolean
          disponible?: boolean
          estacion_id: string
          foto_url?: string | null
          id?: string
          minutos_prep?: number
          nombre: string
          orden?: number
          precio: number
          restaurante_id: string
        }
        Update: {
          activo?: boolean
          categoria_id?: string
          descripcion?: string | null
          destacado?: boolean
          disponible?: boolean
          estacion_id?: string
          foto_url?: string | null
          id?: string
          minutos_prep?: number
          nombre?: string
          orden?: number
          precio?: number
          restaurante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_estacion_id_fkey"
            columns: ["estacion_id"]
            isOneToOne: false
            referencedRelation: "estaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      promocion_items: {
        Row: {
          cantidad: number
          producto_id: string
          promocion_id: string
        }
        Insert: {
          cantidad?: number
          producto_id: string
          promocion_id: string
        }
        Update: {
          cantidad?: number
          producto_id?: string
          promocion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promocion_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promocion_items_promocion_id_fkey"
            columns: ["promocion_id"]
            isOneToOne: false
            referencedRelation: "promociones"
            referencedColumns: ["id"]
          },
        ]
      }
      promociones: {
        Row: {
          activa: boolean
          creado_en: string
          descripcion: string | null
          desde: string | null
          etiqueta: string | null
          hasta: string | null
          id: string
          imagen_url: string | null
          monto_minimo: number | null
          orden: number
          precio_combo: number | null
          restaurante_id: string
          tipo: Database["public"]["Enums"]["tipo_promo"]
          titulo: string
        }
        Insert: {
          activa?: boolean
          creado_en?: string
          descripcion?: string | null
          desde?: string | null
          etiqueta?: string | null
          hasta?: string | null
          id?: string
          imagen_url?: string | null
          monto_minimo?: number | null
          orden?: number
          precio_combo?: number | null
          restaurante_id: string
          tipo: Database["public"]["Enums"]["tipo_promo"]
          titulo: string
        }
        Update: {
          activa?: boolean
          creado_en?: string
          descripcion?: string | null
          desde?: string | null
          etiqueta?: string | null
          hasta?: string | null
          id?: string
          imagen_url?: string | null
          monto_minimo?: number | null
          orden?: number
          precio_combo?: number | null
          restaurante_id?: string
          tipo?: Database["public"]["Enums"]["tipo_promo"]
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "promociones_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurantes: {
        Row: {
          activo: boolean
          base_caja: number
          creado_en: string
          cuenta_pago: string | null
          direccion: string | null
          foto_local_url: string | null
          hero_video_url: string | null
          horario: string | null
          id: string
          landing: Json
          llave_pago: string | null
          logo_url: string | null
          nombre: string
          portada_url: string | null
          slug: string
          whatsapp: string | null
          whatsapp_pedidos: string | null
        }
        Insert: {
          activo?: boolean
          base_caja?: number
          creado_en?: string
          cuenta_pago?: string | null
          direccion?: string | null
          foto_local_url?: string | null
          hero_video_url?: string | null
          horario?: string | null
          id?: string
          landing?: Json
          llave_pago?: string | null
          logo_url?: string | null
          nombre: string
          portada_url?: string | null
          slug: string
          whatsapp?: string | null
          whatsapp_pedidos?: string | null
        }
        Update: {
          activo?: boolean
          base_caja?: number
          creado_en?: string
          cuenta_pago?: string | null
          direccion?: string | null
          foto_local_url?: string | null
          hero_video_url?: string | null
          horario?: string | null
          id?: string
          landing?: Json
          llave_pago?: string | null
          logo_url?: string | null
          nombre?: string
          portada_url?: string | null
          slug?: string
          whatsapp?: string | null
          whatsapp_pedidos?: string | null
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          activo: boolean
          correo: string | null
          creado_en: string
          estacion_id: string | null
          id: string
          nombre: string
          restaurante_id: string
          rol: Database["public"]["Enums"]["rol_usuario"]
        }
        Insert: {
          activo?: boolean
          correo?: string | null
          creado_en?: string
          estacion_id?: string | null
          id: string
          nombre: string
          restaurante_id: string
          rol: Database["public"]["Enums"]["rol_usuario"]
        }
        Update: {
          activo?: boolean
          correo?: string | null
          creado_en?: string
          estacion_id?: string | null
          id?: string
          nombre?: string
          restaurante_id?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_estacion_id_fkey"
            columns: ["estacion_id"]
            isOneToOne: false
            referencedRelation: "estaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      zonas_domicilio: {
        Row: {
          activa: boolean
          id: string
          nombre: string
          restaurante_id: string
          valor: number
        }
        Insert: {
          activa?: boolean
          id?: string
          nombre: string
          restaurante_id: string
          valor: number
        }
        Update: {
          activa?: boolean
          id?: string
          nombre?: string
          restaurante_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "zonas_domicilio_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abrir_turno: { Args: { p_base: number }; Returns: string }
      actualizar_costo: {
        Args: { p_costo: number; p_producto: string }
        Returns: undefined
      }
      anular_pedido: {
        Args: { p_motivo: string; p_pedido: string }
        Returns: undefined
      }
      asignar_domiciliario: {
        Args: { p_domi: string; p_pedido: string }
        Returns: undefined
      }
      cerrar_turno: {
        Args: { p_efectivo_contado: number; p_nota?: string }
        Returns: Json
      }
      confirmar_contraentrega: {
        Args: { p_pedido: string }
        Returns: undefined
      }
      confirmar_pedido: { Args: { p_pedido: string }; Returns: undefined }
      crear_pedido: { Args: { p_payload: Json; p_slug: string }; Returns: Json }
      crear_usuario: {
        Args: {
          p_clave: string
          p_correo: string
          p_estacion?: string | null
          p_nombre: string
          p_rol: Database["public"]["Enums"]["rol_usuario"]
        }
        Returns: string
      }
      eliminar_usuario: { Args: { p_id: string }; Returns: undefined }
      estado_pedido_publico: {
        Args: { p_numero: number; p_slug: string; p_tel: string }
        Returns: Json
      }
      entregar_pedido: { Args: { p_pedido: string }; Returns: undefined }
      fallo_entrega: {
        Args: { p_motivo: string; p_pedido: string }
        Returns: undefined
      }
      legalizar_domiciliario: { Args: { p_domi: string }; Returns: number }
      actualizar_pedido_cliente: { Args: { p_payload: Json; p_token: string }; Returns: Json }
      cancelar_edicion_pedido: { Args: { p_token: string }; Returns: undefined }
      iniciar_edicion_pedido: { Args: { p_token: string }; Returns: Json }
      mi_estacion: { Args: never; Returns: string }
      mi_restaurante: { Args: never; Returns: string }
      mi_rol: {
        Args: never
        Returns: Database["public"]["Enums"]["rol_usuario"]
      }
      recoger_pedido: { Args: { p_pedido: string }; Returns: undefined }
      reporte_rentabilidad: { Args: { p_dias?: number }; Returns: Json }
      reporte_rango: {
        Args: { p_desde: string; p_hasta: string; p_zona?: string }
        Returns: Json
      }
      reporte_ventas: { Args: { p_dias?: number }; Returns: Json }
      registrar_cobro: {
        Args: {
          p_medio: Database["public"]["Enums"]["medio_pago"]
          p_monto?: number
          p_pedido: string
          p_propina?: number
        }
        Returns: undefined
      }
      crear_pedido_interno: {
        Args: { p_confirmar?: boolean; p_payload: Json }
        Returns: Json
      }
      agregar_items_pedido: {
        Args: { p_items: Json; p_pedido: string }
        Returns: Json
      }
      marcar_servido: { Args: { p_pedido: string }; Returns: undefined }
      turno_abierto: { Args: never; Returns: string }
      verificar_transferencia: {
        Args: { p_motivo?: string; p_ok: boolean; p_pedido: string }
        Returns: undefined
      }
    }
    Enums: {
      canal_pedido: "mesa" | "whatsapp" | "domicilio" | "recoger" | "mostrador"
      estado_comanda: "pendiente" | "preparando" | "listo" | "cancelada"
      estado_pago: "pendiente" | "verificado" | "rechazado"
      estado_pedido:
        | "esperando_pago"
        | "pendiente"
        | "en_cocina"
        | "listo"
        | "en_despacho"
        | "en_camino"
        | "entregado"
        | "cerrado"
        | "anulado"
      medio_pago:
        | "efectivo"
        | "transferencia"
        | "datafono"
        | "pasarela"
        | "mesa"
      rol_usuario: "admin" | "cajero" | "mesero" | "cocina" | "domicilio"
      tipo_promo: "envio" | "combo" | "aviso" | "descuento"
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

export const Constants = {
  public: {
    Enums: {
      canal_pedido: ["mesa", "whatsapp", "domicilio", "recoger", "mostrador"],
      estado_comanda: ["pendiente", "preparando", "listo", "cancelada"],
      estado_pago: ["pendiente", "verificado", "rechazado"],
      estado_pedido: [
        "esperando_pago",
        "pendiente",
        "en_cocina",
        "listo",
        "en_despacho",
        "en_camino",
        "entregado",
        "cerrado",
        "anulado",
      ],
      medio_pago: ["efectivo", "transferencia", "datafono", "pasarela", "mesa"],
      rol_usuario: ["admin", "cajero", "mesero", "cocina", "domicilio"],
      tipo_promo: ["envio", "combo", "aviso", "descuento"],
    },
  },
} as const
