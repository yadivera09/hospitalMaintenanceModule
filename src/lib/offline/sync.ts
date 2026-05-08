import {
    getReporteBorradorById,
    actualizarEstadoReporte,
    eliminarReporteBorrador,
    getPendientesSyncQueue,
    eliminarDeSyncQueue,
} from './db'
import { createClient } from '@/lib/supabase/client'

export interface SyncResult {
    sincronizados: number
    errores: number
}

let syncEnProceso = false

export async function sincronizarReportesPendientes(): Promise<SyncResult> {
    if (syncEnProceso) return { sincronizados: 0, errores: 0 }
    syncEnProceso = true

    try {
        const cola = await getPendientesSyncQueue()
        if (cola.length === 0) return { sincronizados: 0, errores: 0 }

        let sincronizados = 0
        let errores = 0

        for (const item of cola) {
            const reporte = await getReporteBorradorById(item.reporte_local_id)

            if (!reporte) {
                await eliminarDeSyncQueue(item.id!)
                continue
            }

            if (reporte.estado === 'sincronizando') continue

            if (!reporte.reporte_server_id) {
                try {
                    const supabase = createClient()
                    const fechaSolo = reporte.fecha_inicio.substring(0, 10)

                    const { data: duplicado } = await supabase
                        .from('reportes_mantenimiento')
                        .select('id')
                        .eq('equipo_id', reporte.equipo_id)
                        .eq('tecnico_principal_id', reporte.tecnico_principal_id)
                        .gte('fecha_inicio', `${fechaSolo}T00:00:00.000Z`)
                        .lt('fecha_inicio', `${fechaSolo}T23:59:59.999Z`)
                        .maybeSingle()

                    if (duplicado) {
                        await eliminarReporteBorrador(reporte.id)
                        await eliminarDeSyncQueue(item.id!)
                        sincronizados++
                        continue
                    }
                } catch (error) {
                    console.error('Error al verificar duplicados:', error)
                }
            }

            try {
                await actualizarEstadoReporte(reporte.id, 'sincronizando')

                const res = await fetch('/api/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(reporte),
                })

                const json = await res.json()

                if (!res.ok || json.error) {
                    throw new Error(json.error ?? `HTTP ${res.status}`)
                }

                await eliminarReporteBorrador(reporte.id)
                await eliminarDeSyncQueue(item.id!)
                sincronizados++

            } catch (error: any) {
                errores++
                await actualizarEstadoReporte(reporte.id, 'error_sync', error.message)

                try {
                    const supabase = createClient()
                    await supabase.from('sync_conflicts').insert({
                        reporte_id: null,
                        dispositivo_origen: reporte.dispositivo_origen ?? 'desconocido',
                        detalle: `[${reporte.id}] ${error.message}`,
                        payload_conflicto: reporte,
                        resuelto: false,
                    })
                } catch {}
            }
        }

        return { sincronizados, errores }
    } finally {
        syncEnProceso = false
    }
}

export { sincronizarReportesPendientes as sync }
