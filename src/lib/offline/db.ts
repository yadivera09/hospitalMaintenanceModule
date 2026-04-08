import { openDB, DBSchema, IDBPDatabase } from 'idb'

const DB_NAME = 'mobilhospital-offline'
const DB_VERSION = 1

export interface ReporteOffline {
    id: string
    equipo_id: string
    tecnico_principal_id: string
    tipo_mantenimiento_id: string
    fecha_inicio: string
    hora_entrada?: string | null
    hora_salida?: string | null
    ciudad?: string | null
    solicitado_por?: string | null
    motivo_visita?: string | null
    numero_reporte_fisico?: string | null
    dispositivo_origen?: string | null
    diagnostico?: string | null
    trabajo_realizado?: string | null
    estado_equipo_post: string
    actividades: any[]
    insumos_usados: any[]
    insumos_requeridos: any[]
    accesorios: any[]
    tecnicos_apoyo: string[]
    sincronizado?: boolean
    created_at?: string
}

interface MobilhospitalDB extends DBSchema {
    reportes_pendientes: {
        key: string
        value: ReporteOffline
        indexes: {
            equipo_id: string
            created_at: string
        }
    }
    sync_queue: {
        key: number
        value: any
    }
}

export async function getOfflineDB(): Promise<IDBPDatabase<MobilhospitalDB>> {
    return openDB<MobilhospitalDB>(DB_NAME, DB_VERSION, {
        upgrade(db: IDBPDatabase<MobilhospitalDB>) {
            // Cola de reportes pendientes de sincronizar
            if (!db.objectStoreNames.contains('reportes_pendientes')) {
                const store = db.createObjectStore('reportes_pendientes', {
                    keyPath: 'id'
                })
                store.createIndex('equipo_id', 'equipo_id')
                store.createIndex('created_at', 'created_at')
            }
            // Cola de operaciones fallidas para retry
            if (!db.objectStoreNames.contains('sync_queue')) {
                db.createObjectStore('sync_queue', {
                    keyPath: 'id',
                    autoIncrement: true
                })
            }
        }
    })
}

export async function guardarReporteOffline(reporte: ReporteOffline) {
    const db = await getOfflineDB()
    await db.put('reportes_pendientes', {
        ...reporte,
        sincronizado: false,
        created_at: new Date().toISOString()
    })
}

export async function getReportesPendientes(): Promise<ReporteOffline[]> {
    const db = await getOfflineDB()
    return db.getAllFromIndex('reportes_pendientes', 'created_at')
}

export async function marcarReporteSincronizado(id: string) {
    const db = await getOfflineDB()
    await db.delete('reportes_pendientes', id)
}
