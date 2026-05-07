import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { Equipo, EstadoEquipoPost, MotivoVisita } from '@/types'
import type { TipoMantenimiento, Insumo, Categoria, ActividadChecklist } from '@/app/actions/catalogos'

const DB_NAME = 'mobilhospital-offline'
const DB_VERSION = 2

// ─── Estado de sincronización de un reporte local ─────────────────────────────

export type EstadoSync = 'borrador_local' | 'pendiente_sync' | 'sincronizando' | 'sincronizado' | 'error_sync'

// ─── Interfaces de cada store ─────────────────────────────────────────────────

export interface ReporteBorrador {
    id: string                              // 'local_<uuid>' — nunca llega al servidor
    equipo_id: string
    tecnico_principal_id: string
    tipo_mantenimiento_id: string
    fecha_inicio: string
    hora_entrada: string | null
    hora_salida: string | null
    ciudad: string | null
    solicitado_por: string | null
    // string | null para compatibilidad con el wizard; al sincronizar se valida como MotivoVisita
    motivo_visita: string | null
    numero_reporte_fisico: string | null
    dispositivo_origen: string | null
    diagnostico: string | null
    trabajo_realizado: string | null
    estado_equipo_post: EstadoEquipoPost | string | null
    actividades: Array<{ actividad_id: string; completada: boolean; observacion?: string | null }>
    insumos_usados: Array<{ insumo_id: string; cantidad: number; observacion?: string | null }>
    insumos_requeridos: Array<{ insumo_id: string; cantidad: number; urgente?: boolean; observacion?: string | null }>
    accesorios: Array<{ descripcion: string; cantidad: number }>
    tecnicos_apoyo: string[]                // IDs de técnicos de apoyo
    firma_base64: string | null             // canvas base64 — igual que online
    firma_cliente_base64: string | null     // canvas base64
    nombre_firmante: string | null          // nombre del cliente
    reporte_server_id: string | null        // ID real en el servidor (si se inició online)
    estado: EstadoSync
    motivo_error: string | null
    created_at: string                      // ISO 8601
    updated_at: string                      // ISO 8601
}

export interface EquipoCache {
    id: string                              // equipo_id — keyPath del store
    datos: Equipo
    cached_at: string                       // ISO 8601 — TTL 12h
}

export interface CatalogoCacheEntry {
    key: string                             // 'tipos_mantenimiento' | 'insumos' | 'categorias' | 'checklists'
    datos: TipoMantenimiento[] | Insumo[] | Categoria[] | ActividadChecklist[] | any[]
    cached_at: string                       // ISO 8601 — TTL 24h
}

export interface SyncQueueItem {
    id?: number                             // autoincrement
    tipo: 'crear_reporte'
    reporte_local_id: string                // FK al id en reportes_borrador
    created_at: string
}

// ─── Schema tipado de IndexedDB ───────────────────────────────────────────────

interface MobilhospitalDB extends DBSchema {
    reportes_borrador: {
        key: string
        value: ReporteBorrador
        indexes: {
            equipo_id: string
            created_at: string
            estado: EstadoSync
        }
    }
    equipos_cache: {
        key: string
        value: EquipoCache
        indexes: { cached_at: string }
    }
    catalogos_cache: {
        key: string
        value: CatalogoCacheEntry
    }
    sync_queue: {
        key: number
        value: SyncQueueItem
        indexes: { created_at: string }
    }
}

// ─── TTL de caché ─────────────────────────────────────────────────────────────

const TTL_CATALOGOS_MS = 24 * 60 * 60 * 1000
const TTL_EQUIPOS_MS   = 12 * 60 * 60 * 1000

function estaVencido(cached_at: string, ttlMs: number): boolean {
    return Date.now() - new Date(cached_at).getTime() > ttlMs
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let dbInstance: IDBPDatabase<MobilhospitalDB> | null = null

export async function getOfflineDB(): Promise<IDBPDatabase<MobilhospitalDB>> {
    if (dbInstance) return dbInstance

    dbInstance = await openDB<MobilhospitalDB>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
            // v1 → v2: renombrar reportes_pendientes → reportes_borrador,
            //           añadir índice de estado, recrear sync_queue tipada,
            //           añadir equipos_cache y catalogos_cache.
            // Nota: los datos en v1 (reportes_pendientes) se descartan —
            //       si había pendientes, el sync online los envió antes.
            if (oldVersion < 2) {
                if (db.objectStoreNames.contains('reportes_pendientes' as never)) {
                    db.deleteObjectStore('reportes_pendientes' as never)
                }
                if (db.objectStoreNames.contains('sync_queue' as never)) {
                    db.deleteObjectStore('sync_queue' as never)
                }

                const borrador = db.createObjectStore('reportes_borrador', { keyPath: 'id' })
                borrador.createIndex('equipo_id', 'equipo_id')
                borrador.createIndex('created_at', 'created_at')
                borrador.createIndex('estado', 'estado')

                const sq = db.createObjectStore('sync_queue', {
                    keyPath: 'id',
                    autoIncrement: true,
                })
                sq.createIndex('created_at', 'created_at')

                const ec = db.createObjectStore('equipos_cache', { keyPath: 'id' })
                ec.createIndex('cached_at', 'cached_at')

                db.createObjectStore('catalogos_cache', { keyPath: 'key' })
            }
        },
        blocked() {
            console.warn('[OfflineDB] Otra pestaña bloquea la actualización de la DB.')
        },
        blocking() {
            dbInstance?.close()
            dbInstance = null
        },
    })

    return dbInstance
}

// ─── Generador de IDs locales ─────────────────────────────────────────────────

export function generarIdLocal(): string {
    return `local_${crypto.randomUUID()}`
}

// ─── reportes_borrador ────────────────────────────────────────────────────────

export async function guardarReporteBorrador(reporte: ReporteBorrador): Promise<void> {
    const db = await getOfflineDB()
    await db.put('reportes_borrador', reporte)
}

export async function actualizarEstadoReporte(
    id: string,
    estado: EstadoSync,
    motivo_error: string | null = null,
): Promise<void> {
    const db = await getOfflineDB()
    const existing = await db.get('reportes_borrador', id)
    if (!existing) return
    await db.put('reportes_borrador', {
        ...existing,
        estado,
        motivo_error,
        updated_at: new Date().toISOString(),
    })
}

export async function getReportesBorrador(): Promise<ReporteBorrador[]> {
    const db = await getOfflineDB()
    return db.getAllFromIndex('reportes_borrador', 'created_at')
}

export async function getReportesPendientes(): Promise<ReporteBorrador[]> {
    const db = await getOfflineDB()
    return db.getAllFromIndex(
        'reportes_borrador',
        'estado',
        IDBKeyRange.only('pendiente_sync'),
    )
}

export async function getReporteBorradorById(id: string): Promise<ReporteBorrador | undefined> {
    const db = await getOfflineDB()
    return db.get('reportes_borrador', id)
}

export async function eliminarReporteBorrador(id: string): Promise<void> {
    const db = await getOfflineDB()
    await db.delete('reportes_borrador', id)
}

// Alias para compatibilidad con código existente en sync.ts y el wizard
export async function guardarReporteOffline(
    reporte: Omit<ReporteBorrador, 'estado' | 'motivo_error' | 'updated_at' | 'created_at' | 'firma_base64' | 'dispositivo_origen'> & {
        id?: string
        created_at?: string
        firma_base64?: string | null
        dispositivo_origen?: string | null
    },
): Promise<string> {
    const now = new Date().toISOString()
    const id = reporte.id ?? generarIdLocal()
    await guardarReporteBorrador({
        ...reporte,
        id,
        dispositivo_origen: reporte.dispositivo_origen ?? 'web',
        firma_base64: reporte.firma_base64 ?? null,
        estado: 'pendiente_sync',
        motivo_error: null,
        created_at: reporte.created_at ?? now,
        updated_at: now,
    } as ReporteBorrador)
    return id
}

// Alias para compatibilidad con sync.ts
export async function marcarReporteSincronizado(id: string): Promise<void> {
    return eliminarReporteBorrador(id)
}

// ─── sync_queue ───────────────────────────────────────────────────────────────

export async function agregarASyncQueue(reporte_local_id: string): Promise<void> {
    const db = await getOfflineDB()
    await db.add('sync_queue', {
        tipo: 'crear_reporte',
        reporte_local_id,
        created_at: new Date().toISOString(),
    })
}

export async function getPendientesSyncQueue(): Promise<SyncQueueItem[]> {
    const db = await getOfflineDB()
    return db.getAllFromIndex('sync_queue', 'created_at')
}

export async function contarPendientesSyncQueue(): Promise<number> {
    const db = await getOfflineDB()
    return db.count('sync_queue')
}

export async function eliminarDeSyncQueue(id: number): Promise<void> {
    const db = await getOfflineDB()
    await db.delete('sync_queue', id)
}

// ─── equipos_cache ────────────────────────────────────────────────────────────

export async function guardarEquipoEnCache(equipo: Equipo): Promise<void> {
    const db = await getOfflineDB()
    await db.put('equipos_cache', {
        id: equipo.id,
        datos: equipo,
        cached_at: new Date().toISOString(),
    })
}

export async function buscarEquipoEnCache(equipoId: string): Promise<Equipo | null> {
    const db = await getOfflineDB()
    const entry = await db.get('equipos_cache', equipoId)
    if (!entry || estaVencido(entry.cached_at, TTL_EQUIPOS_MS)) return null
    return entry.datos
}

export async function guardarEquiposEnCache(equipos: Equipo[]): Promise<void> {
    const db = await getOfflineDB()
    const tx = db.transaction('equipos_cache', 'readwrite')
    await Promise.all([
        ...equipos.map(e =>
            tx.store.put({ id: e.id, datos: e, cached_at: new Date().toISOString() })
        ),
        tx.done,
    ])
}

export async function countEquiposEnCache(): Promise<number> {
    const db = await getOfflineDB()
    return db.count('equipos_cache')
}

export async function getAllEquiposFromCache(): Promise<Equipo[]> {
    const db = await getOfflineDB()
    const entries = await db.getAll('equipos_cache')
    // Filter out expired cache if needed, or return all
    return entries.filter(e => !estaVencido(e.cached_at, TTL_EQUIPOS_MS)).map(e => e.datos)
}

// ─── catalogos_cache ──────────────────────────────────────────────────────────

export async function guardarCatalogo(
    key: string,
    datos: CatalogoCacheEntry['datos'],
): Promise<void> {
    const db = await getOfflineDB()
    await db.put('catalogos_cache', { key, datos, cached_at: new Date().toISOString() })
}

export async function getCatalogo<T = any>(key: string): Promise<T | null> {
    const db = await getOfflineDB()
    const entry = await db.get('catalogos_cache', key)
    if (!entry || estaVencido(entry.cached_at, TTL_CATALOGOS_MS)) return null
    return entry.datos as T
}
