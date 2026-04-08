'use server'

/**
 * src/app/actions/dashboard.ts
 * Server Actions para el Dashboard Admin.
 * Todas las consultas se ejecutan en paralelo con Promise.all.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface DashboardStats {
    equiposActivos: number
    reportesAbiertos: number
    mantenimientosVencidos: number
    tecnicosActivos: number
}

export interface ActividadReciente {
    id: string
    codigo_mh: string
    tecnico_nombre: string
    tipo_nombre: string | null
    estado_reporte: string
    updated_at: string
}

/**
 * Obtiene las 4 KPIs del dashboard admin de forma paralela.
 */
export async function getDashboardStats(): Promise<{ data: DashboardStats; error: null } | { data: null; error: string }> {
    try {
        const supabase = createClient()

        const [equiposRes, reportesRes, vencidosRes, tecnicosRes] = await Promise.all([
            // 1. Equipos activos con contrato vigente
            supabase
                .from('v_equipo_contrato_vigente')
                .select('equipo_id', { count: 'exact', head: true }),

            // 2. Reportes abiertos (en_progreso o pendiente_firma_cliente)
            supabase
                .from('reportes_mantenimiento')
                .select('id', { count: 'exact', head: true })
                .in('estado_reporte', ['en_progreso', 'pendiente_firma_cliente'])
                .eq('activo', true),

            // 3. Mantenimientos vencidos desde la vista
            supabase
                .from('v_equipos_mantenimiento_vencido')
                .select('equipo_id', { count: 'exact', head: true }),

            // 4. Técnicos activos
            supabase
                .from('tecnicos')
                .select('id', { count: 'exact', head: true })
                .eq('activo', true),
        ])

        return {
            data: {
                equiposActivos: equiposRes.count ?? 0,
                reportesAbiertos: reportesRes.count ?? 0,
                mantenimientosVencidos: vencidosRes.count ?? 0,
                tecnicosActivos: tecnicosRes.count ?? 0,
            },
            error: null,
        }
    } catch (err) {
        console.error('[getDashboardStats]', err)
        return { data: null, error: 'Error al cargar estadísticas del dashboard.' }
    }
}

/**
 * Obtiene los últimos 5 reportes creados o modificados.
 * JOIN: equipos (codigo_mh), tecnicos (nombre+apellido), tipos_mantenimiento (nombre)
 */
export async function getActividadReciente(): Promise<{ data: ActividadReciente[]; error: null } | { data: null; error: string }> {
    try {
        // Admin client para evitar restricciones RLS sobre la tabla tecnicos
        const supabase = createAdminClient()

        const { data, error } = await supabase
            .from('reportes_mantenimiento')
            .select(`
                id,
                estado_reporte,
                updated_at,
                equipo:equipos(codigo_mh),
                tecnico_principal:tecnicos(nombre, apellido),
                tipo:tipos_mantenimiento(nombre)
            `)
            .eq('activo', true)
            .order('updated_at', { ascending: false })
            .limit(5)

        if (error) throw error

        const actividad: ActividadReciente[] = (data ?? []).map((r: any) => ({
            id: r.id,
            codigo_mh: r.equipo?.codigo_mh ?? '—',
            tecnico_nombre: r.tecnico_principal
                ? `${r.tecnico_principal.nombre} ${r.tecnico_principal.apellido}`
                : '—',
            tipo_nombre: r.tipo?.nombre ?? null,
            estado_reporte: r.estado_reporte,
            updated_at: r.updated_at,
        }))

        return { data: actividad, error: null }
    } catch (err) {
        console.error('[getActividadReciente]', err)
        return { data: null, error: 'Error al cargar actividad reciente.' }
    }
}
