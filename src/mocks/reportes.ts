/**
 * src/mocks/reportes.ts
 * Datos mock para el módulo Reportes.
 * 6 reportes exactos:
 *   - 1 borrador
 *   - 1 pendiente_firma_tecnico
 *   - 1 pendiente_firma_cliente
 *   - 2 cerrados (con firmas y hash SHA-256 simulado)
 *   - 1 anulado
 *
 * Referencian equipos y técnicos de los mocks existentes.
 */

import type {
    ReporteMantenimiento,
    ReporteActividad,
    ReporteInsumoUsado,
    ReporteInsumoRequerido,
    ReporteTecnico,
} from '@/types'

// ---------------------------------------------------------------------------
// IDs externos referenciados (de mocks existentes)
// ---------------------------------------------------------------------------
// Equipos
const EQ_CAM_0001 = 'eq000001-0001-0001-0001-000000000001' // MH-CAM-0001
const EQ_CAM_0002 = 'eq000001-0001-0001-0001-000000000002' // MH-CAM-0002
const EQ_CP_0001 = 'eq000004-0004-0004-0004-000000000001' // MH-CP-0001
const EQ_SR_0001 = 'eq000002-0002-0002-0002-000000000001' // MH-SR-0001
const EQ_CAM_0010 = 'eq000001-0001-0001-0001-000000000003' // MH-CAM-0010
const EQ_BAL_0001 = 'eq000006-0006-0006-0006-000000000001' // MH-BAL-0001
// Técnicos
const TEC_MARCOS = 'tec-0001-0001-0001-0001-000000000001'
const TEC_LUIS = 'tec-0002-0002-0002-0002-000000000002'
const TEC_ANA = 'tec-0003-0003-0003-0003-000000000003'
// Tipo mantenimiento
const TM_PREV = 'tm-prev-0001-0001-0001-000000000001'
const TM_CORR = 'tm-corr-0002-0002-0002-000000000002'

// ---------------------------------------------------------------------------
// Datos de equipo/técnico para mostrar en UI (resueltos, sin FK join)
// ---------------------------------------------------------------------------
export interface ReporteResuelto extends ReporteMantenimiento {
    equipo_codigo_mh: string
    equipo_nombre: string
    equipo_categoria: string
    equipo_marca: string | null
    equipo_modelo: string | null
    equipo_ubicacion: string | null
    equipo_id_nav: string
    cliente_nombre: string
    tecnico_nombre: string
    tipo_nombre: string
}

// ---------------------------------------------------------------------------
// MOCK — 6 Reportes
// ---------------------------------------------------------------------------

export const MOCK_REPORTES: ReporteResuelto[] = [
    // ── 1. BORRADOR ──────────────────────────────────────────────────────────
    {
        id: 'rep00001-0001-0001-0001-000000000001',
        equipo_id: EQ_CAM_0002,
        tecnico_principal_id: TEC_MARCOS,
        tipo_mantenimiento_id: TM_PREV,
        estado_reporte: 'borrador',
        fecha_inicio: '2025-03-01T08:00:00-05:00',
        fecha_fin: null,
        diagnostico: null,
        trabajo_realizado: null,
        observaciones: null,
        firma_tecnico: null, firma_tecnico_hash: null, fecha_firma_tecnico: null,
        firma_cliente: null, firma_cliente_hash: null, fecha_firma_cliente: null,
        nombre_cliente_firma: null,
        dispositivo_origen: 'tablet-001', sincronizado: false, fecha_sincronizacion: null,
        // Campos fase6 — null en mocks
        hora_entrada: null, hora_salida: null, ciudad: null, solicitado_por: null,
        numero_reporte_fisico: null, motivo_visita: null, estado_equipo_post: null,
        equipo_marca_snapshot: null, equipo_modelo_snapshot: null, equipo_serie_snapshot: null,
        created_at: '2025-03-01T08:00:00-05:00', updated_at: '2025-03-01T08:00:00-05:00',
        // Campos resueltos para UI
        equipo_codigo_mh: 'MH-CAM-0002', equipo_nombre: 'Cama hospitalaria manual',
        equipo_categoria: 'Cama hospitalaria', equipo_marca: 'Stryker', equipo_modelo: 'InTouch',
        equipo_ubicacion: 'Piso 2 — Hospitalización', equipo_id_nav: EQ_CAM_0002,
        cliente_nombre: 'Clínica San Lucas S.A.',
        tecnico_nombre: 'Marcos Rodríguez', tipo_nombre: 'Preventivo',
    },

    // ── 2. PENDIENTE FIRMA TÉCNICO ────────────────────────────────────────────
    {
        id: 'rep00002-0002-0002-0002-000000000002',
        equipo_id: EQ_CP_0001,
        tecnico_principal_id: TEC_LUIS,
        tipo_mantenimiento_id: TM_PREV,
        estado_reporte: 'pendiente_firma_tecnico',
        fecha_inicio: '2025-02-20T09:00:00-05:00',
        fecha_fin: '2025-02-20T12:30:00-05:00',
        diagnostico: 'Revisión trimestral de coche de paro según protocolo.',
        trabajo_realizado: 'Se verificaron medicamentos, desfibrilador y material de vía aérea. Medicamentos vencidos reemplazados. Monitor de ritmo calibrado.',
        observaciones: 'Se recomienda reemplazar las paletas del desfibrilador en el próximo ciclo.',
        firma_tecnico: null, firma_tecnico_hash: null, fecha_firma_tecnico: null,
        firma_cliente: null, firma_cliente_hash: null, fecha_firma_cliente: null,
        nombre_cliente_firma: null,
        dispositivo_origen: 'tablet-002', sincronizado: true, fecha_sincronizacion: '2025-02-20T13:00:00-05:00',
        // Campos fase6  null en mocks
        hora_entrada: null, hora_salida: null, ciudad: null, solicitado_por: null,
        numero_reporte_fisico: null, motivo_visita: null, estado_equipo_post: null,
        equipo_marca_snapshot: null, equipo_modelo_snapshot: null, equipo_serie_snapshot: null,
        created_at: '2025-02-20T09:00:00-05:00', updated_at: '2025-02-20T13:00:00-05:00',
        equipo_codigo_mh: 'MH-CP-0001', equipo_nombre: 'Coche de paro adultos',
        equipo_categoria: 'Coche de paro', equipo_marca: 'Medline', equipo_modelo: 'Emergency Cart Pro',
        equipo_ubicacion: 'UCI', equipo_id_nav: EQ_CP_0001,
        cliente_nombre: 'Hospital General del Norte',
        tecnico_nombre: 'Luis Vera', tipo_nombre: 'Preventivo',
    },

    // ── 3. PENDIENTE FIRMA CLIENTE ─────────────────────────────────────────────
    {
        id: 'rep00003-0003-0003-0003-000000000003',
        equipo_id: EQ_SR_0001,
        tecnico_principal_id: TEC_MARCOS,
        tipo_mantenimiento_id: TM_PREV,
        estado_reporte: 'pendiente_firma_cliente',
        fecha_inicio: '2025-01-15T10:00:00-05:00',
        fecha_fin: '2025-01-15T12:00:00-05:00',
        diagnostico: 'Mantenimiento preventivo semestral.',
        trabajo_realizado: 'Revisión de llantas y presión. Lubricación de rodamientos. Frenos verificados y ajustados.',
        observaciones: null,
        firma_tecnico: 'FIRMA_TEC_B64_PLACEHOLDER', firma_tecnico_hash: 'a3f1b2c4d5e6f789', fecha_firma_tecnico: '2025-01-15T12:30:00-05:00',
        firma_cliente: null, firma_cliente_hash: null, fecha_firma_cliente: null,
        nombre_cliente_firma: null,
        dispositivo_origen: 'tablet-001', sincronizado: true, fecha_sincronizacion: '2025-01-15T12:00:00-05:00',
        // Campos fase6  null en mocks
        hora_entrada: null, hora_salida: null, ciudad: null, solicitado_por: null,
        numero_reporte_fisico: null, motivo_visita: null, estado_equipo_post: null,
        equipo_marca_snapshot: null, equipo_modelo_snapshot: null, equipo_serie_snapshot: null,
        created_at: '2025-01-15T10:00:00-05:00', updated_at: '2025-01-15T12:30:00-05:00',
        equipo_codigo_mh: 'MH-SR-0001', equipo_nombre: 'Silla de ruedas estándar',
        equipo_categoria: 'Silla de ruedas', equipo_marca: 'Invacare', equipo_modelo: 'Action 2 NG',
        equipo_ubicacion: 'Planta baja', equipo_id_nav: EQ_SR_0001,
        cliente_nombre: 'Hospital General del Norte',
        tecnico_nombre: 'Marcos Rodríguez', tipo_nombre: 'Preventivo',
    },

    // ── 4. CERRADO #1 ──────────────────────────────────────────────────────────
    {
        id: 'rep00004-0004-0004-0004-000000000004',
        equipo_id: EQ_CAM_0001,
        tecnico_principal_id: TEC_MARCOS,
        tipo_mantenimiento_id: TM_PREV,
        estado_reporte: 'cerrado',
        fecha_inicio: '2025-01-20T08:00:00-05:00',
        fecha_fin: '2025-01-20T11:00:00-05:00',
        diagnostico: 'Mantenimiento preventivo semestral programado.',
        trabajo_realizado: 'Revisión completa del sistema eléctrico y mecánico. Motor verificado en todas las posiciones Trendelenburg. Lubricación de mecanismos de articulación. Barandas inspeccionadas y reajustadas. Cableado sin daños. Frenos en perfecto estado.',
        observaciones: 'Se recomienda revisión de colchón en próximo ciclo.',
        firma_tecnico: 'FIRMA_TEC_B64_PLACEHOLDER',
        firma_tecnico_hash: 'sha256:3a7f8c2e1b904d56a77e3f91c2d84b05f3e829c01a4d6b2e',
        fecha_firma_tecnico: '2025-01-20T11:15:00-05:00',
        firma_cliente: 'FIRMA_CLI_B64_PLACEHOLDER',
        firma_cliente_hash: 'sha256:9d1e6a3b74c0f28e5291a04b7f3c96d2e8b52a71c0d94e3f',
        fecha_firma_cliente: '2025-01-20T11:30:00-05:00',
        nombre_cliente_firma: 'Dra. María Torres',
        dispositivo_origen: 'tablet-001', sincronizado: true, fecha_sincronizacion: '2025-01-20T11:35:00-05:00',
        // Campos fase6  null en mocks
        hora_entrada: null, hora_salida: null, ciudad: null, solicitado_por: null,
        numero_reporte_fisico: null, motivo_visita: null, estado_equipo_post: null,
        equipo_marca_snapshot: null, equipo_modelo_snapshot: null, equipo_serie_snapshot: null,
        created_at: '2025-01-20T08:00:00-05:00', updated_at: '2025-01-20T11:35:00-05:00',
        equipo_codigo_mh: 'MH-CAM-0001', equipo_nombre: 'Cama hospitalaria eléctrica',
        equipo_categoria: 'Cama hospitalaria', equipo_marca: 'Hill-Rom', equipo_modelo: 'Progressa',
        equipo_ubicacion: 'Piso 2 — Hospitalización', equipo_id_nav: EQ_CAM_0001,
        cliente_nombre: 'Clínica San Lucas S.A.',
        tecnico_nombre: 'Marcos Rodríguez', tipo_nombre: 'Preventivo',
    },

    // ── 5. CERRADO #2 ──────────────────────────────────────────────────────────
    {
        id: 'rep00005-0005-0005-0005-000000000005',
        equipo_id: EQ_CAM_0010,
        tecnico_principal_id: TEC_LUIS,
        tipo_mantenimiento_id: TM_CORR,
        estado_reporte: 'cerrado',
        fecha_inicio: '2025-02-01T07:30:00-05:00',
        fecha_fin: '2025-02-01T10:45:00-05:00',
        diagnostico: 'Falla en sistema de elevación. Motor no responde a comandos de control.',
        trabajo_realizado: 'Diagnóstico de motor eléctrico: devanado con corte de circuito. Reemplazo de motor y controlador. Prueba funcional completa en todas las posiciones.',
        observaciones: null,
        firma_tecnico: 'FIRMA_TEC_B64_PLACEHOLDER',
        firma_tecnico_hash: 'sha256:f5a2c8e3b614d07e9381b25c4a0f7d6e2c91830fba5d4e27',
        fecha_firma_tecnico: '2025-02-01T11:00:00-05:00',
        firma_cliente: 'FIRMA_CLI_B64_PLACEHOLDER',
        firma_cliente_hash: 'sha256:4b8d1a5e7c930f26a84e2b71d5c39f08e1a726c8b05d3e94',
        fecha_firma_cliente: '2025-02-01T11:20:00-05:00',
        nombre_cliente_firma: 'Enf. Patricia Romero',
        dispositivo_origen: 'tablet-002', sincronizado: true, fecha_sincronizacion: '2025-02-01T11:25:00-05:00',
        // Campos fase6  null en mocks
        hora_entrada: null, hora_salida: null, ciudad: null, solicitado_por: null,
        numero_reporte_fisico: null, motivo_visita: null, estado_equipo_post: null,
        equipo_marca_snapshot: null, equipo_modelo_snapshot: null, equipo_serie_snapshot: null,
        created_at: '2025-02-01T07:30:00-05:00', updated_at: '2025-02-01T11:25:00-05:00',
        equipo_codigo_mh: 'MH-CAM-0010', equipo_nombre: 'Cama pediátrica',
        equipo_categoria: 'Cama hospitalaria', equipo_marca: 'Linet', equipo_modelo: 'Eleganza 5',
        equipo_ubicacion: 'Pediatría', equipo_id_nav: EQ_CAM_0010,
        cliente_nombre: 'Centro Médico Santa Rosa',
        tecnico_nombre: 'Luis Vera', tipo_nombre: 'Correctivo',
    },

    // ── 6. ANULADO ─────────────────────────────────────────────────────────────
    {
        id: 'rep00006-0006-0006-0006-000000000006',
        equipo_id: EQ_BAL_0001,
        tecnico_principal_id: TEC_ANA,
        tipo_mantenimiento_id: TM_PREV,
        estado_reporte: 'anulado',
        fecha_inicio: '2024-08-20T09:00:00-05:00',
        fecha_fin: null,
        diagnostico: null,
        trabajo_realizado: null,
        observaciones: 'Visita cancelada por el cliente. Equipo en proceso de reubicación.',
        firma_tecnico: null, firma_tecnico_hash: null, fecha_firma_tecnico: null,
        firma_cliente: null, firma_cliente_hash: null, fecha_firma_cliente: null,
        nombre_cliente_firma: null,
        dispositivo_origen: 'tablet-003', sincronizado: true, fecha_sincronizacion: '2024-08-20T10:00:00-05:00',
        // Campos fase6  null en mocks
        hora_entrada: null, hora_salida: null, ciudad: null, solicitado_por: null,
        numero_reporte_fisico: null, motivo_visita: null, estado_equipo_post: null,
        equipo_marca_snapshot: null, equipo_modelo_snapshot: null, equipo_serie_snapshot: null,
        created_at: '2024-08-20T09:00:00-05:00', updated_at: '2024-08-20T10:00:00-05:00',
        equipo_codigo_mh: 'MH-BAL-0001', equipo_nombre: 'Balanza clínica pediátrica',
        equipo_categoria: 'Balanza clínica', equipo_marca: 'Seca', equipo_modelo: '845',
        equipo_ubicacion: 'Piso 1 — Consulta externa', equipo_id_nav: EQ_BAL_0001,
        cliente_nombre: 'Clínica San Lucas S.A.',
        tecnico_nombre: 'Ana Pacheco', tipo_nombre: 'Preventivo',
    },
]

// ---------------------------------------------------------------------------
// Checklist por reporte
// ---------------------------------------------------------------------------

export interface ReporteActividadUI extends ReporteActividad {
    descripcion: string
    obligatoria: boolean
}

export const MOCK_ACTIVIDADES_REPORTE: Record<string, ReporteActividadUI[]> = {
    // Preventivo de MH-CAM-0001 (cerrado)
    'rep00004-0004-0004-0004-000000000004': [
        { id: 'ra-001-1', reporte_id: 'rep00004-0004-0004-0004-000000000004', actividad_id: 'act-0001-001', completada: true, observacion: null, created_at: '', descripcion: 'Verificar funcionamiento de motor eléctrico y posiciones', obligatoria: true },
        { id: 'ra-001-2', reporte_id: 'rep00004-0004-0004-0004-000000000004', actividad_id: 'act-0001-002', completada: true, observacion: 'Lubricación con silicona realizada', created_at: '', descripcion: 'Limpiar y lubricar mecanismos de articulación', obligatoria: true },
        { id: 'ra-001-3', reporte_id: 'rep00004-0004-0004-0004-000000000004', actividad_id: 'act-0001-003', completada: true, observacion: null, created_at: '', descripcion: 'Revisar estado de barandas laterales', obligatoria: true },
        { id: 'ra-001-4', reporte_id: 'rep00004-0004-0004-0004-000000000004', actividad_id: 'act-0001-004', completada: true, observacion: null, created_at: '', descripcion: 'Verificar frenos y ruedas', obligatoria: true },
        { id: 'ra-001-5', reporte_id: 'rep00004-0004-0004-0004-000000000004', actividad_id: 'act-0001-005', completada: true, observacion: null, created_at: '', descripcion: 'Revisar cableado y conectores eléctricos', obligatoria: false },
        { id: 'ra-001-6', reporte_id: 'rep00004-0004-0004-0004-000000000004', actividad_id: 'act-0001-006', completada: false, observacion: 'Pendiente para siguiente visita', created_at: '', descripcion: 'Verificar colchón y cubierta impermeable', obligatoria: false },
    ],
    // Preventivo de MH-CP-0001 (pendiente_firma_tecnico)
    'rep00002-0002-0002-0002-000000000002': [
        { id: 'ra-002-1', reporte_id: 'rep00002-0002-0002-0002-000000000002', actividad_id: 'act-0004-001', completada: true, observacion: 'Medicamentos vencidos reemplazados', created_at: '', descripcion: 'Verificar fechas de vencimiento de medicamentos', obligatoria: true },
        { id: 'ra-002-2', reporte_id: 'rep00002-0002-0002-0002-000000000002', actividad_id: 'act-0004-002', completada: true, observacion: 'Monitor calibrado. Paletas con desgaste leve.', created_at: '', descripcion: 'Revisar desfibrilador (batería y paletas)', obligatoria: true },
        { id: 'ra-002-3', reporte_id: 'rep00002-0002-0002-0002-000000000002', actividad_id: 'act-0004-003', completada: true, observacion: null, created_at: '', descripcion: 'Comprobar material de vía aérea', obligatoria: true },
        { id: 'ra-002-4', reporte_id: 'rep00002-0002-0002-0002-000000000002', actividad_id: 'act-0004-004', completada: true, observacion: null, created_at: '', descripcion: 'Revisar ruedas y sistema de freno', obligatoria: false },
    ],
}

// ---------------------------------------------------------------------------
// Insumos usados por reporte
// ---------------------------------------------------------------------------
export interface InsumoUsadoUI extends ReporteInsumoUsado {
    insumo_nombre: string
    insumo_codigo: string | null
    unidad_medida: string
}

export const MOCK_INSUMOS_USADOS: Record<string, InsumoUsadoUI[]> = {
    'rep00004-0004-0004-0004-000000000004': [
        { id: 'riu-001-1', reporte_id: 'rep00004-0004-0004-0004-000000000004', insumo_id: 'ins-0001-0001-0001-000000000001', cantidad: 1, observacion: null, created_at: '', insumo_nombre: 'Lubricante silicona para mecanismos', insumo_codigo: 'LUB-SIL-001', unidad_medida: 'Envase (250ml)' },
        { id: 'riu-001-2', reporte_id: 'rep00004-0004-0004-0004-000000000004', insumo_id: 'ins-0002-0002-0002-000000000002', cantidad: 1, observacion: null, created_at: '', insumo_nombre: 'Limpiador de contactos eléctricos', insumo_codigo: 'LIM-ELE-001', unidad_medida: 'Spray (300ml)' },
    ],
    'rep00002-0002-0002-0002-000000000002': [
        { id: 'riu-002-1', reporte_id: 'rep00002-0002-0002-0002-000000000002', insumo_id: 'ins-0001-0001-0001-000000000001', cantidad: 1, observacion: null, created_at: '', insumo_nombre: 'Lubricante silicona para mecanismos', insumo_codigo: 'LUB-SIL-001', unidad_medida: 'Envase (250ml)' },
    ],
    'rep00005-0005-0005-0005-000000000005': [
        { id: 'riu-005-1', reporte_id: 'rep00005-0005-0005-0005-000000000005', insumo_id: 'ins-0005-0005-0005-000000000005', cantidad: 2, observacion: 'Reemplazo de cableado del controlador', created_at: '', insumo_nombre: 'Cable eléctrico 2x14 AWG', insumo_codigo: 'CAB-ELE-014', unidad_medida: 'Metro' },
        { id: 'riu-005-2', reporte_id: 'rep00005-0005-0005-0005-000000000005', insumo_id: 'ins-0004-0004-0004-000000000004', cantidad: 3, observacion: null, created_at: '', insumo_nombre: 'Mano de obra correctiva', insumo_codigo: null, unidad_medida: 'Hora' },
    ],
}

// ---------------------------------------------------------------------------
// Insumos requeridos por reporte
// ---------------------------------------------------------------------------
export interface InsumoRequeridoUI extends ReporteInsumoRequerido {
    insumo_nombre: string
    insumo_codigo: string | null
    unidad_medida: string
}

export const MOCK_INSUMOS_REQUERIDOS: Record<string, InsumoRequeridoUI[]> = {
    'rep00002-0002-0002-0002-000000000002': [
        { id: 'rir-002-1', reporte_id: 'rep00002-0002-0002-0002-000000000002', insumo_id: 'ins-0006-0006-0006-000000000006', cantidad: 1, urgente: true, observacion: 'Paletas del desfibrilador presentan desgaste. Reemplazo urgente.', created_at: '', insumo_nombre: 'Batería 12V AGM', insumo_codigo: 'BAT-12V-001', unidad_medida: 'Unidad' },
    ],
}

// ---------------------------------------------------------------------------
// Técnicos de apoyo por reporte
// ---------------------------------------------------------------------------
export interface TecnicoApoyoUI extends ReporteTecnico {
    tecnico_nombre: string
}

export const MOCK_TECNICOS_APOYO: Record<string, TecnicoApoyoUI[]> = {
    'rep00004-0004-0004-0004-000000000004': [
        { id: 'rta-004-1', reporte_id: 'rep00004-0004-0004-0004-000000000004', tecnico_id: TEC_LUIS, rol: 'apoyo', created_at: '', tecnico_nombre: 'Luis Vera' },
    ],
    'rep00005-0005-0005-0005-000000000005': [
        { id: 'rta-005-1', reporte_id: 'rep00005-0005-0005-0005-000000000005', tecnico_id: TEC_MARCOS, rol: 'apoyo', created_at: '', tecnico_nombre: 'Marcos Rodríguez' },
    ],
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

export function getMockReporteById(id: string): ReporteResuelto | undefined {
    return MOCK_REPORTES.find((r) => r.id === id)
}

export function getMockActividadesReporte(reporteId: string): ReporteActividadUI[] {
    return MOCK_ACTIVIDADES_REPORTE[reporteId] ?? []
}

export function getMockInsumosUsados(reporteId: string): InsumoUsadoUI[] {
    return MOCK_INSUMOS_USADOS[reporteId] ?? []
}

export function getMockInsumosRequeridos(reporteId: string): InsumoRequeridoUI[] {
    return MOCK_INSUMOS_REQUERIDOS[reporteId] ?? []
}

export function getMockTecnicosApoyo(reporteId: string): TecnicoApoyoUI[] {
    return MOCK_TECNICOS_APOYO[reporteId] ?? []
}

/** Abrevia un ID para mostrar en tabla (primeros 8 chars) */
export function abreviarId(id: string): string {
    return id.replace(/-/g, '').substring(0, 8).toUpperCase()
}

/** Abrevia hash SHA-256 para mostrar en firmas (primeros 12 chars) */
export function abreviarHash(hash: string | null): string {
    if (!hash) return ''
    const clean = hash.replace('sha256:', '')
    return clean.substring(0, 12) + '…'
}

/** Tipos de mantenimiento para selector de filtro */
export const TIPOS_MANTENIMIENTO_OPTIONS = [
    { value: 'todos', label: 'Todos los tipos' },
    { value: TM_PREV, label: 'Preventivo' },
    { value: TM_CORR, label: 'Correctivo' },
]

export { TM_PREV, TM_CORR }

