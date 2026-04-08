/**
 * src/types/index.ts
 * Tipos globales del Módulo de Mantenimiento Mobilhospital.
 * Fuente de verdad: db/schema.sql
 * Convenciones:
 *   - PKs: string (UUID)
 *   - Fechas: string (ISO 8601 / TIMESTAMPTZ)
 *   - Soft delete via campo `activo`
 */

// =============================================================================
// TABLAS MAESTRAS
// =============================================================================

export interface Cliente {
    id: string
    razon_social: string
    ruc: string | null
    email: string | null
    telefono: string | null
    direccion: string | null
    activo: boolean
    created_at: string
    updated_at: string
}

export interface Contrato {
    id: string
    cliente_id: string
    numero_contrato: string
    fecha_inicio: string // DATE → string ISO (YYYY-MM-DD)
    fecha_fin: string | null
    tipo_contrato: string // 'anual' | custom
    observaciones: string | null
    activo: boolean
    /**
     * Campo de display UI — NO existe en DB.
     * Derivado de activo + fecha_fin en BLOQUE 1 mock.
     * En BLOQUE 2 se calcula server-side.
     * Valores: 'activo' | 'vencido' | 'suspendido' | 'cancelado'
     */
    estado_display?: EstadoContrato
    created_at: string
    updated_at: string
    // Relaciones opcionales (joins)
    cliente?: Cliente
}

/** Estado visual de un contrato — derivado de activo + fecha_fin */
export type EstadoContrato = 'activo' | 'vencido' | 'suspendido' | 'cancelado'

/**
 * Computa el estado visual de un contrato a partir de sus campos DB.
 * Prioridad: estado_display explícito (mock) > vencido ó activo.
 */
export function computarEstadoContrato(contrato: Contrato): EstadoContrato {
    if (contrato.estado_display) return contrato.estado_display
    if (!contrato.activo) return 'cancelado'
    if (contrato.fecha_fin && new Date(contrato.fecha_fin) < new Date()) return 'vencido'
    return 'activo'
}

export interface CategoriaEquipo {
    id: string
    nombre: string
    descripcion: string | null
    activa: boolean
    created_at: string
    updated_at: string
}

export interface Tecnico {
    id: string
    user_id: string | null // FK a auth.users
    nombre: string
    apellido: string
    cedula: string | null
    email: string
    telefono: string | null
    activo: boolean
    /** Estado visual UI — NO existe en DB con estos valores. */
    estado_display?: EstadoTecnico
    created_at: string
    updated_at: string
    // Columnas MFA (migration 001_add_mfa_columns)
    mfa_configurado: boolean
    mfa_metodo: 'totp' | 'email' | null
    mfa_configurado_en: string | null  // TIMESTAMPTZ → ISO 8601
    mfa_sesion_verificada: boolean
}

/** Estado visual de un técnico */
export type EstadoTecnico = 'activo' | 'inactivo' | 'suspendido'

export function computarEstadoTecnico(t: Tecnico): EstadoTecnico {
    if (t.estado_display) return t.estado_display
    return t.activo ? 'activo' : 'inactivo'
}

export interface TipoMantenimiento {
    id: string
    nombre: string
    descripcion: string | null
    periodicidad_dias: number
    es_planificado: boolean
    activo: boolean
    created_at: string
    updated_at: string
}

export interface Insumo {
    id: string
    nombre: string
    codigo: string | null
    unidad_medida: string
    descripcion: string | null
    activo: boolean
    created_at: string
    updated_at: string
}

export interface Ubicacion {
    id: string
    cliente_id: string
    nombre: string
    descripcion: string | null
    activa: boolean
    created_at: string
    updated_at: string
    // Relaciones opcionales
    cliente?: Cliente
}

// =============================================================================
// EQUIPOS
// =============================================================================

export interface Equipo {
    id: string
    codigo_mh: string
    numero_serie: string | null
    activo_fijo: string | null
    nombre: string
    marca: string | null
    modelo: string | null
    categoria_id: string
    tipo_mantenimiento_id: string
    fecha_fabricacion: string | null // DATE
    fecha_ultimo_mantenimiento: string | null // TIMESTAMPTZ
    observaciones: string | null
    activo: boolean
    /**
     * Estado visual UI — NO existe en DB con estos valores.
     * Derivado de activo en BLOQUE 1. En BLOQUE 2 se calcula server-side.
     * Valores: 'activo' | 'almacenado' | 'baja'
     */
    estado_display?: EstadoEquipo
    created_at: string
    updated_at: string
    // Relaciones opcionales
    categoria?: CategoriaEquipo
    tipo_mantenimiento?: TipoMantenimiento
}

/** Estado visual de un equipo en el sistema */
export type EstadoEquipo = 'activo' | 'almacenado' | 'baja'

/**
 * Computa el estado visual de un equipo.
 * Prioridad: estado_display explícito (mock) > activo boolean.
 */
export function computarEstadoEquipo(equipo: Equipo): EstadoEquipo {
    if (equipo.estado_display) return equipo.estado_display
    return equipo.activo ? 'activo' : 'baja'
}

export interface EquipoContrato {
    id: string
    equipo_id: string
    contrato_id: string
    ubicacion_id: string | null
    fecha_asignacion: string // DATE
    fecha_retiro: string | null // DATE — NULL = contrato vigente
    observaciones: string | null
    created_at: string
    updated_at: string
    // Relaciones opcionales
    equipo?: Equipo
    contrato?: Contrato
    ubicacion?: Ubicacion
}

// =============================================================================
// ESTADO DEL REPORTE — tipo estricto
// =============================================================================

export type EstadoReporte =
    | 'en_progreso'
    | 'pendiente_firma_cliente'
    | 'cerrado'
    | 'anulado'

/** Tipo resumen para listado de reportes en panel admin (datos denormalizados) */
export interface ReporteResumen {
    id: string
    estado_reporte: EstadoReporte
    fecha_inicio: string
    numero_reporte_fisico: string | null
    equipo_id: string
    tipo_mantenimiento_id: string
    equipo_codigo_mh: string
    equipo_nombre: string
    cliente_nombre: string
    tipo_nombre: string
    tecnico_nombre: string
}

/** Motivo de la visita técnica — formulario físico */
export type MotivoVisita =
    | 'garantia'
    | 'contrato'
    | 'demo'
    | 'emergencia'
    | 'llamada'
    | 'capacitacion'

/** Estado del equipo al cierre del reporte */
export type EstadoEquipoPost =
    | 'operativo'
    | 'restringido'
    | 'no_operativo'
    | 'almacenado'
    | 'dado_de_baja'

// =============================================================================
// REPORTES DE MANTENIMIENTO
// =============================================================================

export interface ReporteMantenimiento {
    id: string
    equipo_id: string
    tecnico_principal_id: string
    tipo_mantenimiento_id: string
    estado_reporte: EstadoReporte
    fecha_inicio: string // TIMESTAMPTZ
    fecha_fin: string | null
    diagnostico: string | null
    trabajo_realizado: string | null
    observaciones: string | null
    // Campos del formulario físico (fase6)
    hora_entrada: string | null        // HH:MM (TIME → string)
    hora_salida: string | null          // HH:MM
    ciudad: string | null
    solicitado_por: string | null
    numero_reporte_fisico: string | null
    motivo_visita: MotivoVisita | null
    estado_equipo_post: EstadoEquipoPost | null
    // Snapshots del equipo al momento del reporte
    equipo_marca_snapshot: string | null
    equipo_modelo_snapshot: string | null
    equipo_serie_snapshot: string | null
    // Firmas
    firma_tecnico: string | null
    firma_tecnico_hash: string | null
    fecha_firma_tecnico: string | null
    firma_cliente: string | null
    firma_cliente_hash: string | null
    fecha_firma_cliente: string | null
    nombre_cliente_firma: string | null
    // Sincronización offline
    dispositivo_origen: string | null
    sincronizado: boolean
    fecha_sincronizacion: string | null
    created_at: string
    updated_at: string
    // Relaciones opcionales
    equipo?: Equipo
    tecnico_principal?: Tecnico
    tipo_mantenimiento?: TipoMantenimiento
    accesorios?: ReporteAccesorio[]
}

export interface ReporteTecnico {
    id: string
    reporte_id: string
    tecnico_id: string
    rol: string // 'apoyo' | custom
    created_at: string
    // Relaciones opcionales
    tecnico?: Tecnico
}

export interface ActividadChecklist {
    id: string
    categoria_id: string
    descripcion: string
    orden: number
    obligatoria: boolean
    activa: boolean
    created_at: string
    updated_at: string
}

export interface ReporteActividad {
    id: string
    reporte_id: string
    actividad_id: string
    completada: boolean
    observacion: string | null
    created_at: string
    // Relaciones opcionales
    actividad?: ActividadChecklist
}

export interface ReporteInsumoUsado {
    id: string
    reporte_id: string
    insumo_id: string
    cantidad: number
    observacion: string | null
    created_at: string
    // Relaciones opcionales
    insumo?: Insumo
}

export interface ReporteInsumoRequerido {
    id: string
    reporte_id: string
    insumo_id: string
    cantidad: number
    urgente: boolean
    observacion: string | null
    created_at: string
    // Relaciones opcionales
    insumo?: Insumo
}

/** Accesorio o repuesto registrado en el reporte (fase6) */
export interface ReporteAccesorio {
    id: string
    reporte_id: string
    descripcion: string
    cantidad: number
    estado_equipo_contexto: 'operativo' | 'restringido' | 'no_operativo'
    created_at: string
}

export interface SyncConflict {
    id: string
    reporte_id: string | null
    dispositivo_origen: string
    descripcion: string
    payload_conflicto: Record<string, unknown> | null
    resuelto: boolean
    created_at: string
}

// =============================================================================
// VISTAS SQL (tipos para respuestas de vistas)
// =============================================================================

/** Resultado de v_correctivos_por_marca_modelo */
export interface VistaCorrectivosModelo {
    marca: string
    modelo: string
    nombre_categoria: string
    total_correctivos: number
    equipos_afectados: number
    promedio_correctivos_por_equipo: number
    ultimo_correctivo: string | null
    nivel_alerta: 'critico' | 'alerta' | 'normal'
    tipo_frecuente?: string
}

/** Resultado de v_duracion_intervenciones */
export interface VistaDuracionIntervencion {
    id_reporte: string
    codigo_mh: string
    marca: string
    modelo: string
    nombre_tipo: string
    fecha_ejecucion: string
    hora_entrada: string | null
    hora_salida: string | null
    duracion_minutos: number | null
    tecnico_responsable: string
    cliente_nombre: string | null
}

/** Resultado de v_equipo_contrato_vigente */
export interface VistaEquipoContratoVigente {
    equipo_id: string
    codigo_mh: string
    equipo_nombre: string
    numero_serie: string | null
    activo_fijo: string | null
    equipo_contrato_id: string
    contrato_id: string
    numero_contrato: string
    cliente_id: string
    cliente_nombre: string
    ubicacion_id: string | null
    ubicacion_nombre: string | null
    fecha_asignacion: string
}

/** Resultado de v_equipos_mantenimiento_vencido */
export interface VistaEquipoMantenimientoVencido {
    id: string
    codigo_mh: string
    nombre: string
    fecha_ultimo_mantenimiento: string | null
    tipo_mantenimiento: string
    periodicidad_dias: number
    fecha_proximo_mantenimiento: string | null
    cliente_nombre: string | null
    ubicacion_nombre: string | null
}

// =============================================================================
// TIPOS DE UTILIDAD — Autenticación / Sesión (mock para BLOQUE 1)
// =============================================================================

export type Rol = 'administrador' | 'tecnico'

export interface UsuarioSesion {
    id: string
    email: string
    nombre: string
    apellido: string
    rol: Rol
}

// =============================================================================
// TIPOS DE RESPUESTA API
// =============================================================================

export interface ApiResponse<T> {
    data: T | null
    error: string | null
    meta?: {
        total?: number
        page?: number
        pageSize?: number
    }
}
