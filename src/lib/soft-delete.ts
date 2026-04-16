/**
 * src/lib/soft-delete.ts
 * Helper de verificación de dependencias para soft delete.
 * Usado por las actions de desactivación de cada entidad.
 */

import { createClient } from '@/lib/supabase/server'

/**
 * Verifica si un registro tiene filas hijas activas en una tabla relacionada.
 * Solo aplica a tablas que tienen columna `activo = true`.
 *
 * @returns { tiene: true, count: N } si TIENE dependencias activas → bloquear desactivación.
 */
export async function tieneDependenciasActivas(
    tabla: string,
    fkColumn: string,
    id: string
): Promise<{ tiene: boolean; count: number }> {
    try {
        const supabase = createClient()
        const { count, error } = await supabase
            .from(tabla)
            .select('*', { count: 'exact', head: true })
            .eq(fkColumn, id)
            .eq('activo', true)

        if (error) throw error
        return { tiene: (count ?? 0) > 0, count: count ?? 0 }
    } catch {
        // En caso de error, asumir que hay dependencias para evitar desactivaciones inseguras
        return { tiene: true, count: -1 }
    }
}

/**
 * Verifica si un equipo o contrato tiene asignaciones vigentes en equipo_contratos.
 * Una asignación es vigente cuando fecha_retiro IS NULL.
 */
export async function tieneAsignacionesVigentes(
    fkColumn: 'equipo_id' | 'contrato_id' | 'ubicacion_id',
    id: string
): Promise<{ tiene: boolean; count: number }> {
    try {
        const supabase = createClient()
        const { count, error } = await supabase
            .from('equipo_contratos')
            .select('*', { count: 'exact', head: true })
            .eq(fkColumn, id)
            .is('fecha_retiro', null)

        if (error) throw error
        return { tiene: (count ?? 0) > 0, count: count ?? 0 }
    } catch {
        return { tiene: true, count: -1 }
    }
}

/**
 * Verifica si hay reportes de mantenimiento activos (no cerrados) para un equipo o técnico.
 */
export async function tieneReportesActivos(
    fkColumn: 'equipo_id' | 'tecnico_principal_id',
    id: string
): Promise<{ tiene: boolean; count: number }> {
    try {
        const supabase = createClient()
        const { count, error } = await supabase
            .from('reportes_mantenimiento')
            .select('*', { count: 'exact', head: true })
            .eq(fkColumn, id)
            .neq('estado_reporte', 'cerrado')

        if (error) throw error
        return { tiene: (count ?? 0) > 0, count: count ?? 0 }
    } catch {
        return { tiene: true, count: -1 }
    }
}
