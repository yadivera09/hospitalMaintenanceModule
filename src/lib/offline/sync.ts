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

        // BUG 1 - FIX: Verificar duplicados en servidor antes de procesar
        if (!reporte.reporte_server_id) {
            try {
                const supabase = createClient()
                const fechaDia = reporte.fecha_inicio.split('T')[0]
                const nextDay = new Date(fechaDia)
                nextDay.setDate(nextDay.getDate() + 1)
                const nextDayStr = nextDay.toISOString().split('T')[0]

                const { data: duplicado } = await supabase
                    .from('reportes_mantenimiento')
                    .select('id')
                    .eq('equipo_id', reporte.equipo_id)
                    .eq('tecnico_principal_id', reporte.tecnico_principal_id)
                    .gte('fecha_inicio', fechaDia)
                    .lt('fecha_inicio', nextDayStr)
                    .maybeSingle()

                if (duplicado) {
                    // Ya existe en el servidor. Asumimos que esta entrada de la cola es un rebote / duplicado
                    // Limpiamos de la cola y del borrador local sin reportar error
                    await eliminarReporteBorrador(reporte.id)
                    await eliminarDeSyncQueue(item.id!)
                    sincronizados++
                    continue
                }
            } catch (error) {
                console.error('Error al verificar duplicados:', error)
                // Continuar de todos modos, si falla el POST lo mandará a error_sync
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

export { sincronizarReportesPendientes as sync }
