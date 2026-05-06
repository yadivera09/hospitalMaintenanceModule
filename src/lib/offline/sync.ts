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

export async function sincronizarReportesPendientes(): Promise<SyncResult> {
    const cola = await getPendientesSyncQueue()
    if (cola.length === 0) return { sincronizados: 0, errores: 0 }

    let sincronizados = 0
    let errores = 0

    for (const item of cola) {
        const reporte = await getReporteBorradorById(item.reporte_local_id)

        if (!reporte) {
            // Entrada huérfana en la cola — limpiar sin contar error
            await eliminarDeSyncQueue(item.id!)
            continue
        }

        // Evitar doble envío si sync() se llama dos veces en paralelo
        if (reporte.estado === 'sincronizando') continue

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

            // Registrar conflicto en Supabase para revisión del admin
            try {
                const supabase = createClient()
                await supabase.from('sync_conflicts').insert({
                    reporte_id: null,
                    dispositivo_origen: reporte.dispositivo_origen ?? 'desconocido',
                    detalle: `[${reporte.id}] ${error.message}`,
                    payload_conflicto: reporte,
                    resuelto: false,
                })
            } catch {
                // Si Supabase no está disponible, el reporte queda en error_sync en IDB
            }
        }
    }

    return { sincronizados, errores }
}
