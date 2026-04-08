/**
 * src/mocks/tecnicos.ts
 * Datos mock para el módulo de Técnicos.
 * 4 técnicos con los 3 estados posibles y datos de intervenciones.
 */

import type { Tecnico } from '@/types'

// =============================================================================
// MOCK — Técnicos
// =============================================================================

export const MOCK_TECNICOS: Tecnico[] = [
    {
        id: 'tec-0001-0001-0001-0001-000000000001',
        user_id: null,
        nombre: 'Marcos',
        apellido: 'Rodríguez',
        cedula: '0912345678',
        email: 'marcos.rodriguez@mobilhospital.com',
        telefono: '+593 99 234-5678',
        activo: true,
        estado_display: 'activo',
        created_at: '2023-01-10T08:00:00-05:00',
        updated_at: '2024-12-01T08:00:00-05:00',
    },
    {
        id: 'tec-0002-0002-0002-0002-000000000002',
        user_id: null,
        nombre: 'Luis',
        apellido: 'Vera',
        cedula: '1712345678',
        email: 'luis.vera@mobilhospital.com',
        telefono: '+593 98 567-8901',
        activo: true,
        estado_display: 'activo',
        created_at: '2023-03-15T08:00:00-05:00',
        updated_at: '2025-01-05T08:00:00-05:00',
    },
    {
        id: 'tec-0003-0003-0003-0003-000000000003',
        user_id: null,
        nombre: 'Ana',
        apellido: 'Pacheco',
        cedula: '0612345678',
        email: 'ana.pacheco@mobilhospital.com',
        telefono: '+593 97 890-1234',
        activo: false,
        estado_display: 'suspendido',
        created_at: '2022-08-20T08:00:00-05:00',
        updated_at: '2024-09-01T08:00:00-05:00',
    },
    {
        id: 'tec-0004-0004-0004-0004-000000000004',
        user_id: null,
        nombre: 'Pedro',
        apellido: 'Moncayo',
        cedula: '1012345678',
        email: 'pedro.moncayo@mobilhospital.com',
        telefono: null,
        activo: false,
        estado_display: 'inactivo',
        created_at: '2021-05-01T08:00:00-05:00',
        updated_at: '2023-12-15T08:00:00-05:00',
    },
]

// =============================================================================
// MOCK — Últimas intervenciones por técnico
// =============================================================================

export interface Intervencion {
    id: string
    equipo_codigo: string
    equipo_nombre: string
    tipo: string
    fecha: string
    cliente: string
    resultado: 'completado' | 'con_observaciones' | 'diferido'
}

export const MOCK_INTERVENCIONES: Record<string, Intervencion[]> = {
    'tec-0001-0001-0001-0001-000000000001': [
        {
            id: 'int-0001-001',
            equipo_codigo: 'MH-CAM-0001',
            equipo_nombre: 'Cama hospitalaria eléctrica',
            tipo: 'Preventivo',
            fecha: '2025-01-20T10:00:00-05:00',
            cliente: 'Clínica San Lucas S.A.',
            resultado: 'completado',
        },
        {
            id: 'int-0001-002',
            equipo_codigo: 'MH-CP-0001',
            equipo_nombre: 'Coche de paro adultos',
            tipo: 'Correctivo',
            fecha: '2024-11-05T09:00:00-05:00',
            cliente: 'Hospital General del Norte',
            resultado: 'con_observaciones',
        },
        {
            id: 'int-0001-003',
            equipo_codigo: 'MH-SR-0001',
            equipo_nombre: 'Silla de ruedas estándar',
            tipo: 'Preventivo',
            fecha: '2024-09-12T10:00:00-05:00',
            cliente: 'Hospital General del Norte',
            resultado: 'completado',
        },
    ],
    'tec-0002-0002-0002-0002-000000000002': [
        {
            id: 'int-0002-001',
            equipo_codigo: 'MH-CP-0001',
            equipo_nombre: 'Coche de paro adultos',
            tipo: 'Preventivo',
            fecha: '2024-09-20T09:00:00-05:00',
            cliente: 'Hospital General del Norte',
            resultado: 'con_observaciones',
        },
        {
            id: 'int-0002-002',
            equipo_codigo: 'MH-CAM-0002',
            equipo_nombre: 'Cama hospitalaria manual',
            tipo: 'Preventivo',
            fecha: '2024-07-15T09:00:00-05:00',
            cliente: 'Clínica San Lucas S.A.',
            resultado: 'completado',
        },
        {
            id: 'int-0002-003',
            equipo_codigo: 'MH-CP-0001',
            equipo_nombre: 'Coche de paro adultos',
            tipo: 'Correctivo',
            fecha: '2024-03-10T11:00:00-05:00',
            cliente: 'Hospital General del Norte',
            resultado: 'completado',
        },
        {
            id: 'int-0002-004',
            equipo_codigo: 'MH-CAM-0010',
            equipo_nombre: 'Cama pediátrica',
            tipo: 'Preventivo',
            fecha: '2024-01-08T09:00:00-05:00',
            cliente: 'Centro Médico Santa Rosa',
            resultado: 'diferido',
        },
    ],
    'tec-0003-0003-0003-0003-000000000003': [
        {
            id: 'int-0003-001',
            equipo_codigo: 'MH-BAL-0001',
            equipo_nombre: 'Balanza clínica pediátrica',
            tipo: 'Verificación',
            fecha: '2024-08-20T10:00:00-05:00',
            cliente: 'Clínica San Lucas S.A.',
            resultado: 'completado',
        },
    ],
    'tec-0004-0004-0004-0004-000000000004': [],
}

export function getMockTecnicoById(id: string): Tecnico | undefined {
    return MOCK_TECNICOS.find((t) => t.id === id)
}

export function getMockIntervenciones(tecnicoId: string): Intervencion[] {
    return (MOCK_INTERVENCIONES[tecnicoId] ?? []).slice(0, 5)
}
