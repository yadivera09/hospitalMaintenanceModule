/**
 * src/mocks/catalogos.ts
 * Datos mock para el módulo de Catálogos (4 tabs).
 * Extiende los tipos base con campos display para BLOQUE 1.
 */

import type { CategoriaEquipo, Insumo, Ubicacion, ActividadChecklist } from '@/types'
import { MOCK_CLIENTES } from './clientes'

// =============================================================================
// TAB 1 — Categorías de equipo (extendida con frecuencia_meses)
// =============================================================================

export interface CategoriaConFrecuencia extends CategoriaEquipo {
    frecuencia_meses: number
}

export const MOCK_CATEGORIAS_CATALOGO: CategoriaConFrecuencia[] = [
    {
        id: 'cat-0001-0001-0001-000000000001',
        nombre: 'Cama hospitalaria',
        descripcion: 'Camas eléctricas, manuales y articuladas',
        frecuencia_meses: 6,
        activa: true,
        created_at: '2024-01-01T00:00:00-05:00',
        updated_at: '2024-01-01T00:00:00-05:00',
    },
    {
        id: 'cat-0002-0002-0002-000000000002',
        nombre: 'Silla de ruedas',
        descripcion: 'Sillas estándar y eléctricas',
        frecuencia_meses: 6,
        activa: true,
        created_at: '2024-01-01T00:00:00-05:00',
        updated_at: '2024-01-01T00:00:00-05:00',
    },
    {
        id: 'cat-0003-0003-0003-000000000003',
        nombre: 'Camilla',
        descripcion: 'Camillas de transporte y de procedimientos',
        frecuencia_meses: 12,
        activa: true,
        created_at: '2024-01-01T00:00:00-05:00',
        updated_at: '2024-01-01T00:00:00-05:00',
    },
    {
        id: 'cat-0004-0004-0004-000000000004',
        nombre: 'Coche de paro',
        descripcion: 'Coches de reanimación cardiaca',
        frecuencia_meses: 3,
        activa: true,
        created_at: '2024-01-01T00:00:00-05:00',
        updated_at: '2024-01-01T00:00:00-05:00',
    },
    {
        id: 'cat-0005-0005-0005-000000000005',
        nombre: 'Monitor de signos',
        descripcion: 'Monitores de signos vitales y ECG',
        frecuencia_meses: 6,
        activa: true,
        created_at: '2024-01-01T00:00:00-05:00',
        updated_at: '2024-01-01T00:00:00-05:00',
    },
    {
        id: 'cat-0006-0006-0006-000000000006',
        nombre: 'Balanza clínica',
        descripcion: 'Balanzas pediátricas y de adultos',
        frecuencia_meses: 12,
        activa: false,
        created_at: '2024-01-01T00:00:00-05:00',
        updated_at: '2024-01-01T00:00:00-05:00',
    },
]

// =============================================================================
// TAB 2 — Insumos (extendida con gestiona_stock y stock_actual)
// =============================================================================

export interface InsumoConStock extends Insumo {
    gestiona_stock: boolean
    stock_actual: number | null
}

export const MOCK_INSUMOS: InsumoConStock[] = [
    {
        id: 'ins-0001-0001-0001-000000000001',
        nombre: 'Lubricante silicona para mecanismos',
        codigo: 'LUB-SIL-001',
        unidad_medida: 'Envase (250ml)',
        descripcion: 'Para lubricar articulaciones y guías de camas',
        gestiona_stock: true,
        stock_actual: 12,
        activo: true,
        created_at: '2024-01-15T08:00:00-05:00',
        updated_at: '2024-01-15T08:00:00-05:00',
    },
    {
        id: 'ins-0002-0002-0002-000000000002',
        nombre: 'Limpiador de contactos eléctricos',
        codigo: 'LIM-ELE-001',
        unidad_medida: 'Spray (300ml)',
        descripcion: null,
        gestiona_stock: true,
        stock_actual: 4,
        activo: true,
        created_at: '2024-01-15T08:00:00-05:00',
        updated_at: '2024-01-15T08:00:00-05:00',
    },
    {
        id: 'ins-0003-0003-0003-000000000003',
        nombre: 'Tornillo M6 acero inoxidable',
        codigo: 'TOR-M6-001',
        unidad_medida: 'Unidad',
        descripcion: 'Para fijación de barandas y mecanismos',
        gestiona_stock: true,
        stock_actual: 150,
        activo: true,
        created_at: '2024-02-01T08:00:00-05:00',
        updated_at: '2024-02-01T08:00:00-05:00',
    },
    {
        id: 'ins-0004-0004-0004-000000000004',
        nombre: 'Mano de obra correctiva',
        codigo: null,
        unidad_medida: 'Hora',
        descripcion: 'Hora técnica para mantenimiento correctivo',
        gestiona_stock: false,
        stock_actual: null,
        activo: true,
        created_at: '2024-01-10T08:00:00-05:00',
        updated_at: '2024-01-10T08:00:00-05:00',
    },
    {
        id: 'ins-0005-0005-0005-000000000005',
        nombre: 'Cable eléctrico 2x14 AWG',
        codigo: 'CAB-ELE-014',
        unidad_medida: 'Metro',
        descripcion: null,
        gestiona_stock: true,
        stock_actual: 0,
        activo: true,
        created_at: '2024-03-01T08:00:00-05:00',
        updated_at: '2024-03-01T08:00:00-05:00',
    },
    {
        id: 'ins-0006-0006-0006-000000000006',
        nombre: 'Batería 12V AGM',
        codigo: 'BAT-12V-001',
        unidad_medida: 'Unidad',
        descripcion: 'Para sillas de ruedas eléctricas',
        gestiona_stock: true,
        stock_actual: 3,
        activo: false,
        created_at: '2023-06-01T08:00:00-05:00',
        updated_at: '2024-11-01T08:00:00-05:00',
    },
]

// =============================================================================
// TAB 3 — Ubicaciones (con nombre de cliente resuelto)
// =============================================================================

export interface UbicacionConCliente extends Ubicacion {
    cliente_nombre: string
}

export const MOCK_UBICACIONES: UbicacionConCliente[] = [
    {
        id: 'ubic-0001-0001-0001-000000000001',
        cliente_id: '11111111-1111-1111-1111-111111111101',
        nombre: 'Piso 2 — Hospitalización',
        descripcion: null,
        activa: true,
        cliente_nombre: 'Clínica San Lucas S.A.',
        created_at: '2024-01-15T08:00:00-05:00',
        updated_at: '2024-01-15T08:00:00-05:00',
    },
    {
        id: 'ubic-0002-0002-0002-000000000002',
        cliente_id: '11111111-1111-1111-1111-111111111101',
        nombre: 'Emergencias',
        descripcion: null,
        activa: true,
        cliente_nombre: 'Clínica San Lucas S.A.',
        created_at: '2024-01-15T08:00:00-05:00',
        updated_at: '2024-01-15T08:00:00-05:00',
    },
    {
        id: 'ubic-0003-0003-0003-000000000003',
        cliente_id: '11111111-1111-1111-1111-111111111101',
        nombre: 'Piso 1 — Consulta externa',
        descripcion: null,
        activa: true,
        cliente_nombre: 'Clínica San Lucas S.A.',
        created_at: '2024-01-15T08:00:00-05:00',
        updated_at: '2024-01-15T08:00:00-05:00',
    },
    {
        id: 'ubic-0004-0004-0004-000000000004',
        cliente_id: '11111111-1111-1111-1111-111111111102',
        nombre: 'UCI',
        descripcion: 'Unidad de Cuidados Intensivos',
        activa: true,
        cliente_nombre: 'Hospital General del Norte',
        created_at: '2024-02-20T08:00:00-05:00',
        updated_at: '2024-02-20T08:00:00-05:00',
    },
    {
        id: 'ubic-0005-0005-0005-000000000005',
        cliente_id: '11111111-1111-1111-1111-111111111102',
        nombre: 'Planta baja',
        descripcion: null,
        activa: false,
        cliente_nombre: 'Hospital General del Norte',
        created_at: '2024-02-20T08:00:00-05:00',
        updated_at: '2024-02-20T08:00:00-05:00',
    },
    {
        id: 'ubic-0006-0006-0006-000000000006',
        cliente_id: '11111111-1111-1111-1111-111111111103',
        nombre: 'Pediatría',
        descripcion: null,
        activa: true,
        cliente_nombre: 'Centro Médico Santa Rosa',
        created_at: '2024-03-10T08:00:00-05:00',
        updated_at: '2024-03-10T08:00:00-05:00',
    },
]

// =============================================================================
// TAB 4 — Actividades de checklist por categoría
// =============================================================================

export const MOCK_ACTIVIDADES: ActividadChecklist[] = [
    // ── Cama hospitalaria (cat-0001)
    { id: 'act-0001-001', categoria_id: 'cat-0001-0001-0001-000000000001', descripcion: 'Verificar funcionamiento de motor eléctrico y posiciones', orden: 1, obligatoria: true, activa: true, created_at: '', updated_at: '' },
    { id: 'act-0001-002', categoria_id: 'cat-0001-0001-0001-000000000001', descripcion: 'Limpiar y lubricar mecanismos de articulación', orden: 2, obligatoria: true, activa: true, created_at: '', updated_at: '' },
    { id: 'act-0001-003', categoria_id: 'cat-0001-0001-0001-000000000001', descripcion: 'Revisar estado de barandas laterales', orden: 3, obligatoria: true, activa: true, created_at: '', updated_at: '' },
    { id: 'act-0001-004', categoria_id: 'cat-0001-0001-0001-000000000001', descripcion: 'Verificar frenos y ruedas', orden: 4, obligatoria: true, activa: true, created_at: '', updated_at: '' },
    { id: 'act-0001-005', categoria_id: 'cat-0001-0001-0001-000000000001', descripcion: 'Revisar cableado y conectores eléctricos', orden: 5, obligatoria: false, activa: true, created_at: '', updated_at: '' },
    { id: 'act-0001-006', categoria_id: 'cat-0001-0001-0001-000000000001', descripcion: 'Verificar colchón y cubierta impermeable', orden: 6, obligatoria: false, activa: false, created_at: '', updated_at: '' },
    // ── Coche de paro (cat-0004)
    { id: 'act-0004-001', categoria_id: 'cat-0004-0004-0004-000000000004', descripcion: 'Verificar fechas de vencimiento de medicamentos', orden: 1, obligatoria: true, activa: true, created_at: '', updated_at: '' },
    { id: 'act-0004-002', categoria_id: 'cat-0004-0004-0004-000000000004', descripcion: 'Revisar desfibrilador (batería y paletas)', orden: 2, obligatoria: true, activa: true, created_at: '', updated_at: '' },
    { id: 'act-0004-003', categoria_id: 'cat-0004-0004-0004-000000000004', descripcion: 'Comprobar material de vía aérea', orden: 3, obligatoria: true, activa: true, created_at: '', updated_at: '' },
    { id: 'act-0004-004', categoria_id: 'cat-0004-0004-0004-000000000004', descripcion: 'Revisar ruedas y sistema de freno', orden: 4, obligatoria: false, activa: true, created_at: '', updated_at: '' },
    // ── Silla de ruedas (cat-0002)
    { id: 'act-0002-001', categoria_id: 'cat-0002-0002-0002-000000000002', descripcion: 'Revisar llantas y presión de neumáticos', orden: 1, obligatoria: true, activa: true, created_at: '', updated_at: '' },
    { id: 'act-0002-002', categoria_id: 'cat-0002-0002-0002-000000000002', descripcion: 'Lubricar rodamientos y ejes', orden: 2, obligatoria: true, activa: true, created_at: '', updated_at: '' },
    { id: 'act-0002-003', categoria_id: 'cat-0002-0002-0002-000000000002', descripcion: 'Verificar frenos manuales', orden: 3, obligatoria: true, activa: true, created_at: '', updated_at: '' },
]

export function getActividadesByCategoria(categoriaId: string): ActividadChecklist[] {
    return MOCK_ACTIVIDADES.filter((a) => a.categoria_id === categoriaId)
        .sort((a, b) => a.orden - b.orden)
}

export { MOCK_CLIENTES }
