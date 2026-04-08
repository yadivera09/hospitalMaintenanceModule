/**
 * src/mocks/equipos.ts
 * Datos mock para el módulo de Equipos.
 * Reglas especiales:
 *   - Al menos 2 equipos con el MISMO numero_serie (para el banner de advertencia)
 *   - Al menos 1 equipo sin contrato vigente
 *   - Al menos 1 equipo con historial de 2 contratos anteriores
 */

import type { Equipo, CategoriaEquipo } from '@/types'

// =============================================================================
// MOCK — Categorías de equipo
// =============================================================================

export const MOCK_CATEGORIAS: CategoriaEquipo[] = [
    {
        id: 'cat-0001-0001-0001-000000000001',
        nombre: 'Cama hospitalaria',
        descripcion: 'Camas eléctricas, manuales y articuladas',
        activa: true,
        created_at: '2024-01-01T00:00:00-05:00',
        updated_at: '2024-01-01T00:00:00-05:00',
    },
    {
        id: 'cat-0002-0002-0002-000000000002',
        nombre: 'Silla de ruedas',
        descripcion: 'Sillas estándar y eléctricas',
        activa: true,
        created_at: '2024-01-01T00:00:00-05:00',
        updated_at: '2024-01-01T00:00:00-05:00',
    },
    {
        id: 'cat-0003-0003-0003-000000000003',
        nombre: 'Camilla',
        descripcion: 'Camillas de transporte y de procedimientos',
        activa: true,
        created_at: '2024-01-01T00:00:00-05:00',
        updated_at: '2024-01-01T00:00:00-05:00',
    },
    {
        id: 'cat-0004-0004-0004-000000000004',
        nombre: 'Coche de paro',
        descripcion: 'Coches de reanimación cardiaca',
        activa: true,
        created_at: '2024-01-01T00:00:00-05:00',
        updated_at: '2024-01-01T00:00:00-05:00',
    },
    {
        id: 'cat-0005-0005-0005-000000000005',
        nombre: 'Monitor de signos',
        descripcion: 'Monitores de signos vitales y ECG',
        activa: true,
        created_at: '2024-01-01T00:00:00-05:00',
        updated_at: '2024-01-01T00:00:00-05:00',
    },
    {
        id: 'cat-0006-0006-0006-000000000006',
        nombre: 'Balanza clínica',
        descripcion: 'Balanzas pediátricas y de adultos',
        activa: true,
        created_at: '2024-01-01T00:00:00-05:00',
        updated_at: '2024-01-01T00:00:00-05:00',
    },
]

// IDs para acceso rápido en mocks
export const CAT_CAMA = 'cat-0001-0001-0001-000000000001'
export const CAT_SILLA = 'cat-0002-0002-0002-000000000002'
export const CAT_CAMILLA = 'cat-0003-0003-0003-000000000003'
export const CAT_COCHE = 'cat-0004-0004-0004-000000000004'
export const CAT_MONITOR = 'cat-0005-0005-0005-000000000005'
export const CAT_BALANZA = 'cat-0006-0006-0006-000000000006'

// tipo_mantenimiento_id genérico (en BLOQUE 2 vendrá de la tabla real)
const TM_PREVENTIVO = 'tm-prev-0001-0001-0001-000000000001'
const TM_CORRECTIVO = 'tm-corr-0002-0002-0002-000000000002'

// =============================================================================
// MOCK — Equipos
// ⚠️  MH-CAM-0001 y MH-SR-0001 comparten numero_serie = "SN-DUPLICADO-2024"
//     para probar el banner de advertencia en la búsqueda.
// =============================================================================

export const MOCK_EQUIPOS: Equipo[] = [
    // ── CAMAS HOSPITALARIAS ──────────────────────────────────────
    {
        id: 'eq000001-0001-0001-0001-000000000001',
        codigo_mh: 'MH-CAM-0001',
        numero_serie: 'SN-DUPLICADO-2024',           // ← DUPLICADO intencional
        activo_fijo: 'AF-001-2024',
        nombre: 'Cama hospitalaria eléctrica',
        marca: 'Hill-Rom',
        modelo: 'Progressa',
        categoria_id: CAT_CAMA,
        tipo_mantenimiento_id: TM_PREVENTIVO,
        fecha_fabricacion: '2022-03-15',
        fecha_ultimo_mantenimiento: '2025-01-20T10:00:00-05:00',
        observaciones: null,
        activo: true,
        estado_display: 'activo',
        created_at: '2024-01-20T08:00:00-05:00',
        updated_at: '2025-01-20T10:00:00-05:00',
        categoria: MOCK_CATEGORIAS.find((c) => c.id === CAT_CAMA),
    },
    {
        id: 'eq000001-0001-0001-0001-000000000002',
        codigo_mh: 'MH-CAM-0002',
        numero_serie: 'SN-CAM-0002-2022',
        activo_fijo: 'AF-002-2024',
        nombre: 'Cama hospitalaria manual',
        marca: 'Stryker',
        modelo: 'InTouch',
        categoria_id: CAT_CAMA,
        tipo_mantenimiento_id: TM_PREVENTIVO,
        fecha_fabricacion: '2021-06-10',
        fecha_ultimo_mantenimiento: '2024-05-10T09:00:00-05:00',
        observaciones: 'Requiere revisión de rieles laterales.',
        activo: true,
        estado_display: 'activo',
        created_at: '2024-01-20T08:00:00-05:00',
        updated_at: '2024-05-10T09:00:00-05:00',
        categoria: MOCK_CATEGORIAS.find((c) => c.id === CAT_CAMA),
    },
    {
        id: 'eq000001-0001-0001-0001-000000000003',
        codigo_mh: 'MH-CAM-0010',
        numero_serie: 'SN-CAM-0010-2023',
        activo_fijo: 'AF-010-2024',
        nombre: 'Cama pediátrica',
        marca: 'Linet',
        modelo: 'Eleganza 5',
        categoria_id: CAT_CAMA,
        tipo_mantenimiento_id: TM_PREVENTIVO,
        fecha_fabricacion: '2023-01-20',
        fecha_ultimo_mantenimiento: '2025-02-01T08:00:00-05:00',
        observaciones: null,
        activo: true,
        estado_display: 'activo',
        created_at: '2024-03-15T08:00:00-05:00',
        updated_at: '2025-02-01T08:00:00-05:00',
        categoria: MOCK_CATEGORIAS.find((c) => c.id === CAT_CAMA),
    },
    // ── SILLAS DE RUEDAS ─────────────────────────────────────────
    {
        id: 'eq000002-0002-0002-0002-000000000001',
        codigo_mh: 'MH-SR-0001',
        numero_serie: 'SN-DUPLICADO-2024',           // ← DUPLICADO intencional
        activo_fijo: 'AF-SR-001-2024',
        nombre: 'Silla de ruedas estándar',
        marca: 'Invacare',
        modelo: 'Action 2 NG',
        categoria_id: CAT_SILLA,
        tipo_mantenimiento_id: TM_PREVENTIVO,
        fecha_fabricacion: '2023-05-10',
        fecha_ultimo_mantenimiento: '2025-01-05T10:00:00-05:00',
        observaciones: null,
        activo: true,
        estado_display: 'activo',
        created_at: '2024-02-25T08:00:00-05:00',
        updated_at: '2025-01-05T10:00:00-05:00',
        categoria: MOCK_CATEGORIAS.find((c) => c.id === CAT_SILLA),
    },
    {
        id: 'eq000002-0002-0002-0002-000000000002',
        codigo_mh: 'MH-SR-0010',
        numero_serie: 'SN-SR-0010-2023',
        activo_fijo: null,
        nombre: 'Silla de ruedas eléctrica',
        marca: 'Permobil',
        modelo: 'M300',
        categoria_id: CAT_SILLA,
        tipo_mantenimiento_id: TM_CORRECTIVO,
        fecha_fabricacion: '2020-09-01',
        fecha_ultimo_mantenimiento: '2023-12-01T08:00:00-05:00',
        observaciones: 'En bodega — motor en revisión.',
        activo: false,
        estado_display: 'almacenado',
        created_at: '2023-01-10T08:00:00-05:00',
        updated_at: '2024-06-01T08:00:00-05:00',
        categoria: MOCK_CATEGORIAS.find((c) => c.id === CAT_SILLA),
    },
    // ── CAMILLA ──────────────────────────────────────────────────
    {
        id: 'eq000003-0003-0003-0003-000000000001',
        codigo_mh: 'MH-CAM-0003',
        numero_serie: 'SN-CAM-0003-2022',
        activo_fijo: 'AF-003-2024',
        nombre: 'Camilla de transporte',
        marca: 'Ferno',
        modelo: 'model 35A',
        categoria_id: CAT_CAMILLA,
        tipo_mantenimiento_id: TM_PREVENTIVO,
        fecha_fabricacion: '2022-07-15',
        fecha_ultimo_mantenimiento: '2024-11-15T09:00:00-05:00',
        observaciones: null,
        activo: true,
        estado_display: 'activo',
        created_at: '2024-01-20T08:00:00-05:00',
        updated_at: '2024-11-15T09:00:00-05:00',
        categoria: MOCK_CATEGORIAS.find((c) => c.id === CAT_CAMILLA),
    },
    // ── COCHE DE PARO ────────────────────────────────────────────
    {
        id: 'eq000004-0004-0004-0004-000000000001',
        codigo_mh: 'MH-CP-0001',
        numero_serie: 'SN-CP-0001-2021',
        activo_fijo: 'AF-CP-001-2024',
        nombre: 'Coche de paro adultos',
        marca: 'Medline',
        modelo: 'Emergency Cart Pro',
        categoria_id: CAT_COCHE,
        tipo_mantenimiento_id: TM_PREVENTIVO,
        fecha_fabricacion: '2021-02-20',
        fecha_ultimo_mantenimiento: '2024-09-20T09:00:00-05:00',
        observaciones: null,
        activo: true,
        estado_display: 'activo',
        created_at: '2023-06-10T08:00:00-05:00',
        updated_at: '2024-09-20T09:00:00-05:00',
        categoria: MOCK_CATEGORIAS.find((c) => c.id === CAT_COCHE),
    },
    // ── MONITOR DE SIGNOS ────────────────────────────────────────
    {
        id: 'eq000005-0005-0005-0005-000000000001',
        codigo_mh: 'MH-MON-0001',
        numero_serie: 'SN-MON-0001-2020',
        activo_fijo: 'AF-MON-001-2020',
        nombre: 'Monitor de signos vitales',
        marca: 'Philips',
        modelo: 'IntelliVue MX40',
        categoria_id: CAT_MONITOR,
        tipo_mantenimiento_id: TM_PREVENTIVO,
        fecha_fabricacion: '2020-04-10',
        fecha_ultimo_mantenimiento: null,
        observaciones: 'Dado de baja por obsolescencia tecnológica.',
        activo: false,
        estado_display: 'baja',
        created_at: '2020-05-01T08:00:00-05:00',
        updated_at: '2024-10-15T08:00:00-05:00',
        categoria: MOCK_CATEGORIAS.find((c) => c.id === CAT_MONITOR),
    },
    // ── BALANZA CLÍNICA ──────────────────────────────────────────
    {
        id: 'eq000006-0006-0006-0006-000000000001',
        codigo_mh: 'MH-BAL-0001',
        numero_serie: 'SN-BAL-0001-2023',
        activo_fijo: null,
        nombre: 'Balanza clínica pediátrica',
        marca: 'Seca',
        modelo: '845',
        categoria_id: CAT_BALANZA,
        tipo_mantenimiento_id: TM_CORRECTIVO,
        fecha_fabricacion: '2023-08-01',
        fecha_ultimo_mantenimiento: '2024-12-10T10:00:00-05:00',
        observaciones: null,
        activo: true,
        estado_display: 'activo',
        created_at: '2024-05-20T08:00:00-05:00',
        updated_at: '2024-12-10T10:00:00-05:00',
        categoria: MOCK_CATEGORIAS.find((c) => c.id === CAT_BALANZA),
    },
]

// =============================================================================
// MOCK — Contrato vigente por equipo
// =============================================================================

export interface ContratoVigente {
    contrato_id: string
    numero_contrato: string
    cliente_id: string
    cliente_nombre: string
    fecha_asignacion: string
    ubicacion: string | null
}

export const MOCK_CONTRATO_VIGENTE: Record<string, ContratoVigente | null> = {
    'eq000001-0001-0001-0001-000000000001': {
        contrato_id: 'cccc0000-0001-0001-0001-000000000001',
        numero_contrato: 'CTR-2025-001',
        cliente_id: '11111111-1111-1111-1111-111111111101',
        cliente_nombre: 'Clínica San Lucas S.A.',
        fecha_asignacion: '2025-01-15',
        ubicacion: 'Piso 2 — Hospitalización',
    },
    'eq000001-0001-0001-0001-000000000002': {
        contrato_id: 'cccc0000-0001-0001-0001-000000000001',
        numero_contrato: 'CTR-2025-001',
        cliente_id: '11111111-1111-1111-1111-111111111101',
        cliente_nombre: 'Clínica San Lucas S.A.',
        fecha_asignacion: '2025-01-15',
        ubicacion: 'Piso 2 — Hospitalización',
    },
    'eq000001-0001-0001-0001-000000000003': {
        contrato_id: 'cccc0000-0003-0003-0003-000000000001',
        numero_contrato: 'CTR-2024-003',
        cliente_id: '11111111-1111-1111-1111-111111111103',
        cliente_nombre: 'Centro Médico Santa Rosa',
        fecha_asignacion: '2024-03-10',
        ubicacion: 'Pediatría',
    },
    'eq000002-0002-0002-0002-000000000001': {
        contrato_id: 'cccc0000-0002-0002-0002-000000000001',
        numero_contrato: 'CTR-2024-002',
        cliente_id: '11111111-1111-1111-1111-111111111102',
        cliente_nombre: 'Hospital General del Norte',
        fecha_asignacion: '2024-02-20',
        ubicacion: 'Planta baja',
    },
    // MH-SR-0010 → sin contrato vigente (en almacenamiento)
    'eq000002-0002-0002-0002-000000000002': null,
    'eq000003-0003-0003-0003-000000000001': {
        contrato_id: 'cccc0000-0001-0001-0001-000000000001',
        numero_contrato: 'CTR-2025-001',
        cliente_id: '11111111-1111-1111-1111-111111111101',
        cliente_nombre: 'Clínica San Lucas S.A.',
        fecha_asignacion: '2025-01-15',
        ubicacion: 'Emergencias',
    },
    'eq000004-0004-0004-0004-000000000001': {
        contrato_id: 'cccc0000-0002-0002-0002-000000000001',
        numero_contrato: 'CTR-2024-002',
        cliente_id: '11111111-1111-1111-1111-111111111102',
        cliente_nombre: 'Hospital General del Norte',
        fecha_asignacion: '2024-02-20',
        ubicacion: 'UCI',
    },
    // MH-MON-0001 → baja, sin contrato
    'eq000005-0005-0005-0005-000000000001': null,
    'eq000006-0006-0006-0006-000000000001': {
        contrato_id: 'cccc0000-0001-0001-0001-000000000001',
        numero_contrato: 'CTR-2025-001',
        cliente_id: '11111111-1111-1111-1111-111111111101',
        cliente_nombre: 'Clínica San Lucas S.A.',
        fecha_asignacion: '2025-01-20',
        ubicacion: 'Piso 1 — Consulta externa',
    },
}

// =============================================================================
// MOCK — Historial de contratos por equipo
// =============================================================================

export interface HistorialContrato {
    contrato_id: string
    numero_contrato: string
    cliente_nombre: string
    fecha_asignacion: string
    fecha_retiro: string | null
    ubicacion: string | null
}

/**
 * MH-CP-0001 tiene 2 contratos anteriores + el vigente.
 * MH-SR-0010 tiene historial aunque ya no esté activo.
 */
export const MOCK_HISTORIAL_CONTRATOS: Record<string, HistorialContrato[]> = {
    'eq000001-0001-0001-0001-000000000001': [
        {
            contrato_id: 'cccc0000-0001-0001-0001-000000000002',
            numero_contrato: 'CTR-2024-001',
            cliente_nombre: 'Clínica San Lucas S.A.',
            fecha_asignacion: '2024-01-15',
            fecha_retiro: '2025-01-14',
            ubicacion: 'Piso 1 — Recuperación',
        },
    ],
    'eq000004-0004-0004-0004-000000000001': [
        // Historial de 2 contratos anteriores
        {
            contrato_id: 'cccc0000-0002-0002-0002-000000000002',
            numero_contrato: 'CTR-2023-005',
            cliente_nombre: 'Hospital General del Norte',
            fecha_asignacion: '2023-06-01',
            fecha_retiro: '2024-02-19',
            ubicacion: 'UCI',
        },
        {
            contrato_id: 'cccc0000-0004-0004-0004-000000000001',
            numero_contrato: 'CTR-2023-006',
            cliente_nombre: 'Policlínico del Sur Cía. Ltda.',
            fecha_asignacion: '2023-08-05',
            fecha_retiro: '2024-01-10',
            ubicacion: 'Urgencias',
        },
    ],
    'eq000002-0002-0002-0002-000000000002': [
        {
            contrato_id: 'cccc0000-0002-0002-0002-000000000001',
            numero_contrato: 'CTR-2024-002',
            cliente_nombre: 'Hospital General del Norte',
            fecha_asignacion: '2024-02-20',
            fecha_retiro: '2024-06-01',
            ubicacion: 'Planta baja',
        },
    ],
}

// =============================================================================
// MOCK — Historial de mantenimientos por equipo (máximo 5 por equipo)
// =============================================================================

export interface HistorialMantenimiento {
    id: string
    tipo: string
    fecha: string
    tecnico: string
    resultado: 'completado' | 'con_observaciones' | 'diferido'
    observaciones: string | null
}

export const MOCK_MANTENIMIENTOS: Record<string, HistorialMantenimiento[]> = {
    'eq000001-0001-0001-0001-000000000001': [
        {
            id: 'mant-0001-001',
            tipo: 'Preventivo',
            fecha: '2025-01-20T10:00:00-05:00',
            tecnico: 'Marcos Rodríguez',
            resultado: 'completado',
            observaciones: null,
        },
        {
            id: 'mant-0001-002',
            tipo: 'Preventivo',
            fecha: '2024-07-15T09:00:00-05:00',
            tecnico: 'Luis Vera',
            resultado: 'con_observaciones',
            observaciones: 'Se lubricaron mecanismos. Pendiente reemplazo de colchón.',
        },
        {
            id: 'mant-0001-003',
            tipo: 'Preventivo',
            fecha: '2024-01-20T10:00:00-05:00',
            tecnico: 'Marcos Rodríguez',
            resultado: 'completado',
            observaciones: null,
        },
    ],
    'eq000004-0004-0004-0004-000000000001': [
        {
            id: 'mant-0004-001',
            tipo: 'Preventivo',
            fecha: '2024-09-20T09:00:00-05:00',
            tecnico: 'Luis Vera',
            resultado: 'con_observaciones',
            observaciones: 'Medicamentos vencidos reemplazados. Monitor de ritmo en revisión.',
        },
        {
            id: 'mant-0004-002',
            tipo: 'Correctivo',
            fecha: '2024-03-10T11:00:00-05:00',
            tecnico: 'Marcos Rodríguez',
            resultado: 'completado',
            observaciones: 'Reparación de rueda delantera.',
        },
        {
            id: 'mant-0004-003',
            tipo: 'Preventivo',
            fecha: '2023-09-01T09:00:00-05:00',
            tecnico: 'Luis Vera',
            resultado: 'diferido',
            observaciones: 'Cliente solicitó reprogramar revisión de desfibrilador.',
        },
    ],
    'eq000002-0002-0002-0002-000000000001': [
        {
            id: 'mant-0002a-001',
            tipo: 'Preventivo',
            fecha: '2025-01-05T10:00:00-05:00',
            tecnico: 'Marcos Rodríguez',
            resultado: 'completado',
            observaciones: null,
        },
    ],
}

// =============================================================================
// HELPERS
// =============================================================================

export function getMockEquipoById(id: string): Equipo | undefined {
    return MOCK_EQUIPOS.find((e) => e.id === id)
}

export function getMockContratoVigente(equipoId: string): ContratoVigente | null {
    return MOCK_CONTRATO_VIGENTE[equipoId] ?? null
}

export function getMockHistorialContratos(equipoId: string): HistorialContrato[] {
    return MOCK_HISTORIAL_CONTRATOS[equipoId] ?? []
}

export function getMockMantenimientos(equipoId: string): HistorialMantenimiento[] {
    return MOCK_MANTENIMIENTOS[equipoId] ?? []
}

export function getCategoriaById(id: string): CategoriaEquipo | undefined {
    return MOCK_CATEGORIAS.find((c) => c.id === id)
}
