/**
 * src/mocks/contratos.ts
 * Datos mock para el módulo de Contratos.
 * Reutiliza IDs de clientes de src/mocks/clientes.ts.
 * Usado únicamente en BLOQUE 1 (Frontend).
 */

import type { Contrato, EstadoContrato } from '@/types'
import { MOCK_CLIENTES } from './clientes'

// IDs de clientes mock (sincronizados con src/mocks/clientes.ts)
const C1 = '11111111-1111-1111-1111-111111111101' // Clínica San Lucas
const C2 = '11111111-1111-1111-1111-111111111102' // Hospital General del Norte
const C3 = '11111111-1111-1111-1111-111111111103' // Centro Médico Santa Rosa
const C4 = '11111111-1111-1111-1111-111111111104' // Policlínico del Sur (inactivo)
const C5 = '11111111-1111-1111-1111-111111111105' // Instituto Médico Cuenca

// =============================================================================
// MOCK — Contratos (cubre los 4 estados UI)
// =============================================================================

export const MOCK_CONTRATOS: Contrato[] = [
    // ── ACTIVOS ─────────────────────────────────────────────────────────────
    {
        id: 'cccc0000-0001-0001-0001-000000000001',
        cliente_id: C1,
        numero_contrato: 'CTR-2025-001',
        fecha_inicio: '2025-01-15',
        fecha_fin: '2026-01-14',
        tipo_contrato: 'anual',
        observaciones: 'Contrato de mantenimiento preventivo anual para equipos de hospitalización.',
        activo: true,
        estado_display: 'activo',
        created_at: '2025-01-10T08:00:00-05:00',
        updated_at: '2025-01-10T08:00:00-05:00',
        cliente: MOCK_CLIENTES.find((c) => c.id === C1),
    },
    {
        id: 'cccc0000-0002-0002-0002-000000000001',
        cliente_id: C2,
        numero_contrato: 'CTR-2024-002',
        fecha_inicio: '2024-02-20',
        fecha_fin: '2026-02-19',
        tipo_contrato: 'bianual',
        observaciones: null,
        activo: true,
        estado_display: 'activo',
        created_at: '2024-02-20T10:30:00-05:00',
        updated_at: '2024-02-20T10:30:00-05:00',
        cliente: MOCK_CLIENTES.find((c) => c.id === C2),
    },
    {
        id: 'cccc0000-0003-0003-0003-000000000001',
        cliente_id: C3,
        numero_contrato: 'CTR-2024-003',
        fecha_inicio: '2024-03-10',
        fecha_fin: null,
        tipo_contrato: 'indefinido',
        observaciones: 'Sin fecha de vencimiento definida.',
        activo: true,
        estado_display: 'activo',
        created_at: '2024-03-10T09:00:00-05:00',
        updated_at: '2024-03-10T09:00:00-05:00',
        cliente: MOCK_CLIENTES.find((c) => c.id === C3),
    },
    // ── VENCIDO ──────────────────────────────────────────────────────────────
    {
        id: 'cccc0000-0001-0001-0001-000000000002',
        cliente_id: C1,
        numero_contrato: 'CTR-2024-001',
        fecha_inicio: '2024-01-15',
        fecha_fin: '2025-01-14',
        tipo_contrato: 'anual',
        observaciones: 'Renovado en CTR-2025-001.',
        activo: true,
        estado_display: 'vencido',
        created_at: '2024-01-15T08:00:00-05:00',
        updated_at: '2024-01-15T08:00:00-05:00',
        cliente: MOCK_CLIENTES.find((c) => c.id === C1),
    },
    {
        id: 'cccc0000-0005-0005-0005-000000000001',
        cliente_id: C5,
        numero_contrato: 'CTR-2024-004',
        fecha_inicio: '2024-04-01',
        fecha_fin: '2025-03-31',
        tipo_contrato: 'anual',
        observaciones: null,
        activo: true,
        estado_display: 'vencido',
        created_at: '2024-04-01T08:00:00-05:00',
        updated_at: '2024-04-01T08:00:00-05:00',
        cliente: MOCK_CLIENTES.find((c) => c.id === C5),
    },
    // ── SUSPENDIDO ───────────────────────────────────────────────────────────
    {
        id: 'cccc0000-0002-0002-0002-000000000002',
        cliente_id: C2,
        numero_contrato: 'CTR-2023-005',
        fecha_inicio: '2023-06-01',
        fecha_fin: '2024-05-31',
        tipo_contrato: 'anual',
        observaciones: 'Suspendido por falta de pago — pendiente regularización.',
        activo: false,
        estado_display: 'suspendido',
        created_at: '2023-06-01T08:00:00-05:00',
        updated_at: '2024-06-15T09:00:00-05:00',
        cliente: MOCK_CLIENTES.find((c) => c.id === C2),
    },
    // ── CANCELADO ────────────────────────────────────────────────────────────
    {
        id: 'cccc0000-0004-0004-0004-000000000001',
        cliente_id: C4,
        numero_contrato: 'CTR-2023-006',
        fecha_inicio: '2023-08-05',
        fecha_fin: '2024-08-04',
        tipo_contrato: 'anual',
        observaciones: 'Cancelado por cierre de la unidad médica.',
        activo: false,
        estado_display: 'cancelado',
        created_at: '2023-08-05T11:00:00-05:00',
        updated_at: '2024-01-10T16:00:00-05:00',
        cliente: MOCK_CLIENTES.find((c) => c.id === C4),
    },
]

// =============================================================================
// Mock de equipos por contrato (para la vista de detalle)
// Los IDs de equipo reales se crean en el módulo Equipos.
// =============================================================================

export interface EquipoResumen {
    id: string
    codigo_mh: string
    nombre: string
    categoria: string
    ubicacion: string | null
    ultimo_mantenimiento: string | null
    estado_mantenimiento: 'al_dia' | 'proximo' | 'vencido'
}

export const MOCK_EQUIPOS_POR_CONTRATO: Record<string, EquipoResumen[]> = {
    'cccc0000-0001-0001-0001-000000000001': [
        {
            id: 'eeee0001-0001-0001-0001-000000000001',
            codigo_mh: 'MH-CAM-0001',
            nombre: 'Cama hospitalaria eléctrica',
            categoria: 'Cama hospitalaria',
            ubicacion: 'Piso 2 — Hospitalización',
            ultimo_mantenimiento: '2025-01-20',
            estado_mantenimiento: 'al_dia',
        },
        {
            id: 'eeee0001-0001-0001-0001-000000000002',
            codigo_mh: 'MH-CAM-0002',
            nombre: 'Cama hospitalaria manual',
            categoria: 'Cama hospitalaria',
            ubicacion: 'Piso 2 — Hospitalización',
            ultimo_mantenimiento: '2024-05-10',
            estado_mantenimiento: 'vencido',
        },
        {
            id: 'eeee0001-0001-0001-0001-000000000003',
            codigo_mh: 'MH-CAM-0003',
            nombre: 'Camilla de transporte',
            categoria: 'Camilla',
            ubicacion: 'Emergencias',
            ultimo_mantenimiento: '2024-11-15',
            estado_mantenimiento: 'proximo',
        },
    ],
    'cccc0000-0002-0002-0002-000000000001': [
        {
            id: 'eeee0002-0001-0001-0001-000000000001',
            codigo_mh: 'MH-SR-0001',
            nombre: 'Silla de ruedas estándar',
            categoria: 'Silla de ruedas',
            ubicacion: 'Planta baja',
            ultimo_mantenimiento: '2025-01-05',
            estado_mantenimiento: 'al_dia',
        },
        {
            id: 'eeee0002-0001-0001-0001-000000000002',
            codigo_mh: 'MH-CP-0001',
            nombre: 'Coche de paro adultos',
            categoria: 'Coche de paro',
            ubicacion: 'UCI',
            ultimo_mantenimiento: '2024-09-20',
            estado_mantenimiento: 'vencido',
        },
    ],
    'cccc0000-0003-0003-0003-000000000001': [
        {
            id: 'eeee0003-0001-0001-0001-000000000001',
            codigo_mh: 'MH-CAM-0010',
            nombre: 'Cama pediátrica',
            categoria: 'Cama hospitalaria',
            ubicacion: 'Pediatría',
            ultimo_mantenimiento: '2025-02-01',
            estado_mantenimiento: 'al_dia',
        },
    ],
}

// =============================================================================
// HELPERS
// =============================================================================

/** Obtener contrato por ID */
export function getMockContratoById(id: string): Contrato | undefined {
    return MOCK_CONTRATOS.find((c) => c.id === id)
}

/** Obtener equipos asignados a un contrato */
export function getMockEquiposPorContrato(contratoId: string): EquipoResumen[] {
    return MOCK_EQUIPOS_POR_CONTRATO[contratoId] ?? []
}

/** Opciones de tipos de contrato para el selector */
export const TIPOS_CONTRATO = [
    { value: 'anual', label: 'Anual' },
    { value: 'bianual', label: 'Bianual' },
    { value: 'semestral', label: 'Semestral' },
    { value: 'indefinido', label: 'Indefinido' },
] as const

/** Estados disponibles para el filtro */
export const ESTADOS_CONTRATO: { value: EstadoContrato | 'todos'; label: string }[] = [
    { value: 'todos', label: 'Todos los estados' },
    { value: 'activo', label: 'Activo' },
    { value: 'vencido', label: 'Vencido' },
    { value: 'suspendido', label: 'Suspendido' },
    { value: 'cancelado', label: 'Cancelado' },
]
