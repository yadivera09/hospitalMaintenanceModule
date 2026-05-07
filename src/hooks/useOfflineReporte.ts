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
                    firma_cliente_base64: null,
                    nombre_firmante: null,
                    reporte_server_id: null,
                    ...datos,
                    estado: 'borrador_local',
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
     * - Online: el wizard continúa con su flujo normal (modoOffline: false).
     * - Offline: actualiza la entrada existente de crash-recovery (o crea una nueva)
     *   y la encola en sync_queue. Solo esta función añade a sync_queue — guardarPaso
     *   nunca lo hace.
     *
     * @param idLocal ID del borrador creado por guardarPaso(). Si se provee y existe
     *   en IDB, esa entrada se actualiza en lugar de crear una nueva, evitando duplicados.
     */
    const finalizarReporte = useCallback(
        async (datos: DatosReporte, idLocal?: string): Promise<OfflineReporteResult> => {
            const now = new Date().toISOString()
            const db = await import('@/lib/offline/db')
            const id = idLocal ?? generarIdLocal()
            const existing = idLocal ? await db.getReporteBorradorById(idLocal) : undefined

            if (existing) {
                await guardarReporteBorrador({
                    ...existing,
                    ...datos,
                    id,
                    estado: 'pendiente_sync',
                    motivo_error: null,
                    updated_at: now,
                })
            } else {
                await guardarReporteBorrador({
                    ...datos,
                    id,
                    estado: 'pendiente_sync',
                    motivo_error: null,
                    created_at: now,
                    updated_at: now,
                })
            }

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
