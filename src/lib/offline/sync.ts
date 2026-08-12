import {
    getReporteBorradorById,
    actualizarEstadoReporte,
    eliminarReporteBorrador,
    getPendientesSyncQueue,
    eliminarDeSyncQueue,
    guardarIdDeServidor,
} from './db'
import { createClient } from '@/lib/supabase/client'

export interface SyncResult {
    sincronizados: number
    errores: number
}

let syncEnProceso = false

/**
 * Margen tras el cual un reporte marcado 'sincronizando' se da por abandonado.
 *
 * Ese estado se escribe justo antes de llamar al servidor, así que si el envío
 * muere a mitad —la pestaña navega, se recarga la app, se cierra el móvil— el
 * reporte se queda marcado para siempre. Y como la cola saltaba todo lo que
 * estuviera 'sincronizando', ese reporte no volvía a intentarse NUNCA: el
 * contador de pendientes se quedaba clavado y ni el botón de "Sincronizar
 * ahora" lo movía.
 *
 * Dos minutos separan un envío realmente en vuelo (otra pestaña) de uno muerto.
 */
const MS_SYNC_ABANDONADO = 2 * 60 * 1000

/** ¿El intento anterior sigue vivo, o quedó abandonado? */
function siguePendienteDeRespuesta(actualizadoEn: string | undefined): boolean {
    const desde = Date.parse(actualizadoEn ?? '')
    if (!Number.isFinite(desde)) return false

    return Date.now() - desde < MS_SYNC_ABANDONADO
}

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

            // Solo se salta si el envío anterior puede seguir en vuelo.
            if (reporte.estado === 'sincronizando' && siguePendienteDeRespuesta(reporte.updated_at)) {
                continue
            }

            // Si el reporte ya existe en el servidor y allí no está en progreso,
            // el trabajo terminó por el camino normal del wizard y esta copia
            // local es un resto. Reenviarla haría que /api/sync intentara
            // actualizar un borrador cerrado y fallara para siempre.
            if (reporte.reporte_server_id) {
                try {
                    const supabase = createClient()
                    const { data: enServidor } = await supabase
                        .from('reportes_mantenimiento')
                        .select('estado_reporte')
                        .eq('id', reporte.reporte_server_id)
                        .maybeSingle()

                    if (enServidor && enServidor.estado_reporte !== 'en_progreso') {
                        await eliminarReporteBorrador(reporte.id)
                        await eliminarDeSyncQueue(item.id!)
                        sincronizados++
                        continue
                    }
                } catch (error) {
                    console.error('Error al comprobar el reporte en el servidor:', error)
                }
            }

            // AQUÍ HABÍA UNA COMPROBACIÓN DE DUPLICADOS. Se quitó a propósito.
            //
            // Buscaba un reporte con el mismo equipo, el mismo técnico y la
            // misma fecha, y si lo encontraba borraba el borrador local dándolo
            // por sincronizado. Dos reportes legítimos del mismo equipo el mismo
            // día —un preventivo por la mañana y un correctivo por la tarde— y el
            // segundo desaparecía sin subirse y sin avisar. Equipo + técnico +
            // fecha no distingue un reintento de un trabajo distinto, y no puede.
            //
            // Quien lo distingue es el id local, que identifica el trabajo sin
            // ambigüedad y ahora viaja al servidor: el índice único de la
            // migración 024 hace que el segundo intento actualice en vez de
            // duplicar. La decisión se toma donde está el dato, y ningún borrador
            // se borra sin haberse subido.

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
                    // El servidor manda el id del reporte también cuando falla,
                    // si llegó a crearlo. Guardarlo es lo que corta el ciclo de
                    // duplicados: el próximo intento entra por la rama de
                    // actualizar y trabaja sobre el reporte que ya existe.
                    if (json.data?.id) {
                        await guardarIdDeServidor(reporte.id, json.data.id)
                    }

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
