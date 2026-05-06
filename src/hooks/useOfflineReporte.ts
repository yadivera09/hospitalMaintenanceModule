'use client'

import { useCallback } from 'react'
import { useOfflineStatus } from './useOfflineStatus'
import {
    generarIdLocal,
    guardarReporteBorrador,
    actualizarEstadoReporte,
    agregarASyncQueue,
    type ReporteBorrador,
} from '@/lib/offline/db'

// Datos necesarios para iniciar/guardar un borrador paso a paso
export type DatosPaso = Partial<
    Omit<ReporteBorrador, 'id' | 'estado' | 'motivo_error' | 'created_at' | 'updated_at'>
>

// Datos completos requeridos para finalizar el reporte
export type DatosReporte = Omit<
    ReporteBorrador,
    'id' | 'estado' | 'motivo_error' | 'created_at' | 'updated_at'
>

export interface OfflineReporteResult {
    id: string
    modoOffline: boolean
}

export function useOfflineReporte() {
    const { isOnline } = useOfflineStatus()

    /**
     * Guarda el progreso de un paso del wizard en IndexedDB.
     * Funciona tanto online como offline: sirve de recuperación ante
     * cierres accidentales aunque haya conexión.
     */
    const guardarPaso = useCallback(
        async (idLocal: string, datos: DatosPaso): Promise<void> => {
            const now = new Date().toISOString()
            const db = await import('@/lib/offline/db')
            const existing = await db.getReporteBorradorById(idLocal)

            if (existing) {
                await guardarReporteBorrador({
                    ...existing,
                    ...datos,
                    updated_at: now,
                })
            } else {
                await guardarReporteBorrador({
                    id: idLocal,
                    equipo_id: '',
                    tecnico_principal_id: '',
                    tipo_mantenimiento_id: '',
                    fecha_inicio: now,
                    hora_entrada: null,
                    hora_salida: null,
                    ciudad: null,
                    solicitado_por: null,
                    motivo_visita: null,
                    numero_reporte_fisico: null,
                    dispositivo_origen: 'web',
                    diagnostico: null,
                    trabajo_realizado: null,
                    estado_equipo_post: null,
                    actividades: [],
                    insumos_usados: [],
                    insumos_requeridos: [],
                    accesorios: [],
                    tecnicos_apoyo: [],
                    firma_base64: null,
                    ...datos,
                    estado: 'pendiente_sync',
                    motivo_error: null,
                    created_at: now,
                    updated_at: now,
                })
            }
        },
        [],
    )

    /**
     * Finaliza el reporte.
     * - Online: delega al servidor (el wizard llama sus propias server actions).
     *   Devuelve modoOffline = false para que el wizard continúe con su flujo normal.
     * - Offline: guarda en IndexedDB + encola en sync_queue.
     *   Devuelve modoOffline = true y el id local para que el wizard muestre confirmación.
     */
    const finalizarReporte = useCallback(
        async (datos: DatosReporte): Promise<OfflineReporteResult> => {
            if (isOnline) {
                // El wizard maneja el envío al servidor directamente.
                // Solo generamos un id placeholder; el id real viene del servidor.
                return { id: '', modoOffline: false }
            }

            const id = generarIdLocal()
            const now = new Date().toISOString()

            await guardarReporteBorrador({
                ...datos,
                id,
                estado: 'pendiente_sync',
                motivo_error: null,
                created_at: now,
                updated_at: now,
            })

            await agregarASyncQueue(id)

            return { id, modoOffline: true }
        },
        [isOnline],
    )

    /**
     * Marca un borrador como error tras un fallo de envío.
     * Llamado por sync.ts cuando el servidor rechaza el reporte.
     */
    const marcarError = useCallback(
        async (idLocal: string, motivo: string): Promise<void> => {
            await actualizarEstadoReporte(idLocal, 'error_sync', motivo)
        },
        [],
    )

    return { isOnline, guardarPaso, finalizarReporte, marcarError, generarIdLocal }
}
