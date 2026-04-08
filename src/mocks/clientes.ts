/**
 * src/mocks/clientes.ts
 * Datos mock para el módulo de Clientes.
 * Usado únicamente en BLOQUE 1 (Frontend).
 * Se reemplaza con llamadas a Supabase en BLOQUE 2.
 */

import type { Cliente, Contrato } from '@/types'

// =============================================================================
// MOCK — Clientes
// =============================================================================

export const MOCK_CLIENTES: Cliente[] = [
    {
        id: '11111111-1111-1111-1111-111111111101',
        razon_social: 'Clínica San Lucas S.A.',
        ruc: '0991234567001',
        email: 'contabilidad@sanlucas.ec',
        telefono: '+593 4 234-5678',
        direccion: 'Av. 9 de Octubre 1234, Guayaquil, Guayas',
        activo: true,
        created_at: '2024-01-15T08:00:00-05:00',
        updated_at: '2024-01-15T08:00:00-05:00',
    },
    {
        id: '11111111-1111-1111-1111-111111111102',
        razon_social: 'Hospital General del Norte',
        ruc: '1700987654001',
        email: 'admin@hgn.gob.ec',
        telefono: '+593 2 567-8901',
        direccion: 'Av. Amazonas N21-153, Quito, Pichincha',
        activo: true,
        created_at: '2024-02-20T10:30:00-05:00',
        updated_at: '2024-03-01T14:15:00-05:00',
    },
    {
        id: '11111111-1111-1111-1111-111111111103',
        razon_social: 'Centro Médico Santa Rosa',
        ruc: '0601456789001',
        email: 'gerencia@centrosantarosa.com',
        telefono: '+593 3 298-1234',
        direccion: 'Calle Primera 567, Riobamba, Chimborazo',
        activo: true,
        created_at: '2024-03-10T09:00:00-05:00',
        updated_at: '2024-03-10T09:00:00-05:00',
    },
    {
        id: '11111111-1111-1111-1111-111111111104',
        razon_social: 'Policlínico del Sur Cía. Ltda.',
        ruc: '0992345678001',
        email: 'info@policlinicosur.ec',
        telefono: '+593 4 456-7890',
        direccion: 'Cdla. Alborada, Mz. 15 Villa 8, Guayaquil',
        activo: false,
        created_at: '2023-08-05T11:00:00-05:00',
        updated_at: '2024-01-10T16:00:00-05:00',
    },
    {
        id: '11111111-1111-1111-1111-111111111105',
        razon_social: 'Instituto Médico Cuenca',
        ruc: '0100123456001',
        email: 'direccion@imcuenca.com',
        telefono: '+593 7 412-3456',
        direccion: 'Gran Colombia 12-34, Cuenca, Azuay',
        activo: true,
        created_at: '2024-04-01T08:00:00-05:00',
        updated_at: '2024-04-01T08:00:00-05:00',
    },
]

// =============================================================================
// MOCK — Contratos por cliente (para la vista de detalle)
// =============================================================================

export const MOCK_CONTRATOS_POR_CLIENTE: Record<string, Contrato[]> = {
    '11111111-1111-1111-1111-111111111101': [
        {
            id: 'cccccccc-0001-0001-0001-000000000001',
            cliente_id: '11111111-1111-1111-1111-111111111101',
            numero_contrato: 'CTR-2024-001',
            fecha_inicio: '2024-01-15',
            fecha_fin: '2025-01-14',
            tipo_contrato: 'anual',
            observaciones: 'Contrato de mantenimiento preventivo anual para equipos de hospitalización.',
            activo: true,
            created_at: '2024-01-15T08:00:00-05:00',
            updated_at: '2024-01-15T08:00:00-05:00',
        },
        {
            id: 'cccccccc-0001-0001-0001-000000000002',
            cliente_id: '11111111-1111-1111-1111-111111111101',
            numero_contrato: 'CTR-2025-001',
            fecha_inicio: '2025-01-15',
            fecha_fin: '2026-01-14',
            tipo_contrato: 'anual',
            observaciones: 'Renovación anual.',
            activo: true,
            created_at: '2025-01-10T08:00:00-05:00',
            updated_at: '2025-01-10T08:00:00-05:00',
        },
    ],
    '11111111-1111-1111-1111-111111111102': [
        {
            id: 'cccccccc-0002-0002-0002-000000000001',
            cliente_id: '11111111-1111-1111-1111-111111111102',
            numero_contrato: 'CTR-2024-002',
            fecha_inicio: '2024-02-20',
            fecha_fin: '2025-02-19',
            tipo_contrato: 'anual',
            observaciones: null,
            activo: true,
            created_at: '2024-02-20T10:30:00-05:00',
            updated_at: '2024-02-20T10:30:00-05:00',
        },
    ],
    '11111111-1111-1111-1111-111111111103': [
        {
            id: 'cccccccc-0003-0003-0003-000000000001',
            cliente_id: '11111111-1111-1111-1111-111111111103',
            numero_contrato: 'CTR-2024-003',
            fecha_inicio: '2024-03-10',
            fecha_fin: null,
            tipo_contrato: 'indefinido',
            observaciones: 'Sin fecha de vencimiento definida.',
            activo: true,
            created_at: '2024-03-10T09:00:00-05:00',
            updated_at: '2024-03-10T09:00:00-05:00',
        },
    ],
    '11111111-1111-1111-1111-111111111104': [],
    '11111111-1111-1111-1111-111111111105': [
        {
            id: 'cccccccc-0005-0005-0005-000000000001',
            cliente_id: '11111111-1111-1111-1111-111111111105',
            numero_contrato: 'CTR-2024-004',
            fecha_inicio: '2024-04-01',
            fecha_fin: '2025-03-31',
            tipo_contrato: 'anual',
            observaciones: null,
            activo: true,
            created_at: '2024-04-01T08:00:00-05:00',
            updated_at: '2024-04-01T08:00:00-05:00',
        },
    ],
}

// Helper: obtener cliente por ID
export function getMockClienteById(id: string): Cliente | undefined {
    return MOCK_CLIENTES.find((c) => c.id === id)
}

// Helper: obtener contratos de un cliente
export function getMockContratosByCliente(clienteId: string): Contrato[] {
    return MOCK_CONTRATOS_POR_CLIENTE[clienteId] ?? []
}
