import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { Equipo, EstadoEquipoPost, MotivoVisita } from '@/types'
import type { TipoMantenimiento, Insumo, Categoria, ActividadChecklist } from '@/app/actions/catalogos'

const DB_NAME = 'mobilhospital-offline'
const DB_VERSION = 3

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
    // No todas las entradas son listas: 'tecnico_actual' guarda un único objeto
    // con el técnico en sesión. El tipo anterior solo admitía arrays, así que
    // esa escritura —que existe desde el principio en el layout técnico— no
    // compilaba.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    datos: TipoMantenimiento[] | Insumo[] | Categoria[] | ActividadChecklist[] | any[] | Record<string, any>
    cached_at: string                       // ISO 8601 — TTL 24h
}

export interface SyncQueueItem {
    id?: number                             // autoincrement
    tipo: 'crear_reporte'
    reporte_local_id: string                // FK al id en reportes_borrador
    created_at: string
}

/**
 * Reporte ya sincronizado, guardado para consultarlo sin red.
 *
 * Existe porque hasta ahora /tecnico/mis-reportes solo podía mostrar offline el
 * HTML que quedó en la caché del service worker: un recorte de la última visita
 * con conexión, imposible de filtrar o abrir por id. Con el reporte en
 * IndexedDB, el listado y el detalle se renderizan desde datos reales.
 *
 * `datos` guarda el reporte completo con sus colecciones (checklist, insumos,
 * accesorios, técnicos de apoyo) para que duplicarlo sin red no necesite
 * ninguna consulta al servidor.
 */
export interface ReporteCache {
    id: string                              // reportes_mantenimiento.id
    tecnico_principal_id: string
    equipo_id: string
    estado_reporte: string
    fecha_inicio: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    datos: any                              // reporte completo tal como lo sirve la API
    cached_at: string                       // ISO 8601 — TTL 24h
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
    reportes_cache: {
        key: string
        value: ReporteCache
        indexes: {
            fecha_inicio: string
            equipo_id: string
        }
    }
}

// ─── Frescura de la caché ─────────────────────────────────────────────────────
//
// OJO CON LO QUE SIGNIFICA "VENCIDO" AQUÍ.
//
// Estos plazos dicen "conviene refrescar esto", NO "descarta esto". Es la
// diferencia entre una caché de rendimiento y una caché offline, y confundirlas
// costaba caro: hasta ahora buscarEquipoEnCache y getAllEquiposFromCache
// descartaban por TTL, así que a las 12 horas sin conexión el wizard respondía
// "Equipo no disponible offline" con el equipo íntegro en IndexedDB. Los
// catálogos morían a las 24 y el formulario se quedaba a medias.
//
// El razonamiento del TTL —no trabajar con datos viejos— solo se sostiene si
// existe la opción de traer datos nuevos. Sin red no existe, y entonces un dato
// de ayer no compite con uno de hoy: compite con ninguno.
//
// Así que las lecturas devuelven SIEMPRE lo que haya, y ya no hay TTL que
// aplicar: quien mantiene los datos frescos es prepararModoOffline(), que se
// ejecuta al montar el panel del técnico y vuelve a descargarlo todo cuando hay
// red. Sin conexión no hay decisión que tomar — se usa lo que hay.
//
// El campo cached_at se conserva en los registros: dice cuándo se guardó cada
// cosa, y es lo que haría falta el día que se quiera avisar en pantalla de que
// los datos son de hace tres días.

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

            // v2 → v3: reportes ya sincronizados, para consultarlos y
            //          duplicarlos sin red.
            if (oldVersion < 3) {
                const rc = db.createObjectStore('reportes_cache', { keyPath: 'id' })
                rc.createIndex('fecha_inicio', 'fecha_inicio')
                rc.createIndex('equipo_id', 'equipo_id')
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

/**
 * Anota en el borrador el id que le dio el servidor.
 *
 * Se llama cuando /api/sync responde con error PERO habiendo creado ya el
 * reporte. A partir de ese momento el reintento entra por la rama de actualizar
 * en vez de crear, que es lo que evita que cada intento deje un reporte nuevo
 * —y un número de serie quemado— detrás.
 */
export async function guardarIdDeServidor(idLocal: string, idServidor: string): Promise<void> {
    const db = await getOfflineDB()
    const existing = await db.get('reportes_borrador', idLocal)
    if (!existing) return

    await db.put('reportes_borrador', {
        ...existing,
        reporte_server_id: idServidor,
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
    return entry?.datos ?? null
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
    return entries.map(e => e.datos)
}

// ─── reportes_cache ───────────────────────────────────────────────────────────

/** Reemplaza el conjunto de reportes cacheados por el que llega del servidor. */
export async function guardarReportesEnCache(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reportes: any[],
): Promise<void> {
    const db = await getOfflineDB()
    const now = new Date().toISOString()
    const tx = db.transaction('reportes_cache', 'readwrite')

    await Promise.all([
        ...reportes.map((r) =>
            tx.store.put({
                id: r.id,
                tecnico_principal_id: r.tecnico_principal_id ?? '',
                equipo_id: r.equipo_id ?? '',
                estado_reporte: r.estado_reporte ?? '',
                fecha_inicio: r.fecha_inicio ?? now,
                datos: r,
                cached_at: now,
            }),
        ),
        tx.done,
    ])
}

/** Reportes cacheados, del más reciente al más antiguo. */
export async function getReportesDeCache(): Promise<ReporteCache[]> {
    const db = await getOfflineDB()
    const todos = await db.getAllFromIndex('reportes_cache', 'fecha_inicio')
    return todos.reverse()
}

export async function getReporteDeCache(id: string): Promise<ReporteCache | undefined> {
    const db = await getOfflineDB()
    return db.get('reportes_cache', id)
}

export async function countReportesEnCache(): Promise<number> {
    const db = await getOfflineDB()
    return db.count('reportes_cache')
}

// ─── catalogos_cache ──────────────────────────────────────────────────────────

export async function guardarCatalogo(
    key: string,
    datos: CatalogoCacheEntry['datos'],
): Promise<void> {
    const db = await getOfflineDB()
    await db.put('catalogos_cache', { key, datos, cached_at: new Date().toISOString() })
}

/**
 * Devuelve el catálogo guardado, esté fresco o no.
 *
 * El segundo parámetro se mantiene por compatibilidad con las llamadas que ya
 * pasaban `true`, pero hoy no cambia nada: la lectura nunca descarta. Antes sí,
 * y era la causa de que a las 24 horas sin red el wizard perdiera tipos de
 * mantenimiento e insumos pero conservara ubicaciones y técnicos — los únicos
 * que llamaban con `true`. Medio formulario vacío, sin más criterio que ese.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getCatalogo<T = any>(key: string, _ignoreExpiry = false): Promise<T | null> {
    const db = await getOfflineDB()
    const entry = await db.get('catalogos_cache', key)
    return (entry?.datos as T) ?? null
}
