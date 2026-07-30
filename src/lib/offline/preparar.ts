/**
 * src/lib/offline/preparar.ts
 *
 * Deja el dispositivo listo para trabajar sin red, al iniciar sesión con
 * conexión.
 *
 * EL PROBLEMA QUE RESUELVE
 *   El service worker solo guardaba lo que el navegador iba pidiendo. Un
 *   técnico que iniciaba sesión y salía a campo sin haber abierto el wizard se
 *   quedaba sin el JavaScript de esa pantalla —los chunks llevan hash de
 *   contenido, no se pueden adivinar— y sin el documento de ninguna ruta con
 *   id. El resultado era una app que "no carga todo" precisamente en el primer
 *   uso offline, que es el que importa.
 *
 *   preload.ts ya bajaba catálogos y equipos a IndexedDB, pero los datos sin la
 *   pantalla que los dibuja no sirven de nada.
 *
 * QUÉ HACE
 *   1. Baja a IndexedDB los datos: catálogos, equipos y reportes del técnico.
 *   2. Descarga el documento de cada pantalla del panel, incluida UNA instancia
 *      real de cada ruta dinámica, que el service worker guarda además bajo su
 *      clave canónica para servir a cualquier id.
 *   3. Extrae del HTML las referencias a /_next/static/* y las precachea. Es la
 *      parte que faltaba: sin esos chunks la pantalla llega pero no arranca.
 *
 * POR QUÉ SE PARSEA EL HTML Y NO SE USA router.prefetch()
 *   prefetch está desactivado en desarrollo y no garantiza traer el bundle
 *   completo. Leer los <script src> y <link href> del documento que el servidor
 *   acaba de entregar es determinista y funciona igual en dev y en producción,
 *   sin depender de un manifiesto de build ni de un paso extra de compilación.
 */

import {
    guardarCatalogo,
    guardarEquiposEnCache,
    guardarReportesEnCache,
    getAllEquiposFromCache,
    getReportesDeCache,
} from './db'
import type { Equipo } from '@/types'

// ─── Progreso ─────────────────────────────────────────────────────────────────

export type FasePreparacion =
    | 'inactivo'
    | 'catalogos'
    | 'equipos'
    | 'reportes'
    | 'pantallas'
    | 'listo'
    | 'error'

export interface ProgresoPreparacion {
    fase: FasePreparacion
    /** Texto corto para mostrar al técnico. */
    detalle: string
    /** 0–100. */
    porcentaje: number
    /** true cuando el dispositivo puede desconectarse con seguridad. */
    listo: boolean
    error: string | null
}

type OnProgreso = (p: ProgresoPreparacion) => void

// ─── Rutas del panel técnico ──────────────────────────────────────────────────

/** Pantallas sin parámetros. Se cachean siempre. */
const RUTAS_FIJAS = [
    '/tecnico/dashboard',
    '/tecnico/mis-reportes',
    '/tecnico/nuevo-reporte',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJSON<T>(url: string): Promise<T> {
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) throw new Error(`[preparar] ${url} → ${res.status}`)
    return res.json() as Promise<T>
}

/**
 * Referencias a assets estáticos dentro de un documento HTML.
 *
 * Next.js emite los chunks como <script src="/_next/static/…"> y las hojas de
 * estilo como <link href="/_next/static/…">. Se extraen ambos con una sola
 * expresión y se deduplican, porque las pantallas comparten la mayor parte del
 * bundle y volver a pedir lo mismo multiplica el tiempo de preparación.
 */
function assetsDelHtml(html: string): string[] {
    // Array.from en vez de spread: tsconfig.json no declara "target", así que
    // el chequeo de tipos cae a ES5 y rechaza iterar Set y matchAll con '...'.
    const encontrados = Array.from(html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g))
    return Array.from(new Set(encontrados.map((m) => m[1])))
}

/** Margen para que el service worker termine de activarse en la primera visita. */
const MS_ESPERA_SW = 10_000

/**
 * Pide al service worker que descargue y guarde una lista de URLs.
 *
 * La espera lleva tope porque `serviceWorker.ready` NO rechaza: si el registro
 * falló, el navegador lo bloqueó o la app se sirve sin HTTPS, esa promesa queda
 * pendiente para siempre y la preparación se colgaría en el último paso, con la
 * barra de progreso congelada y sin explicación.
 */
async function precachearEnSW(urls: string[]): Promise<void> {
    if (urls.length === 0) return
    if (!('serviceWorker' in navigator)) return

    const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), MS_ESPERA_SW)),
    ])

    if (!registration) {
        throw new Error('El service worker no se activó: el modo offline no quedará disponible.')
    }

    const sw = registration.active ?? navigator.serviceWorker.controller

    if (!sw) {
        throw new Error('El service worker no está activo todavía. Recarga la app.')
    }

    sw.postMessage({ type: 'PRECACHE_RUTAS', urls })
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Prepara el dispositivo para trabajar sin red.
 *
 * No lanza: cualquier fallo se reporta por `onProgreso` con fase 'error'. Dejar
 * la app inutilizable porque el precache falló sería peor que el problema que
 * intenta resolver — con conexión todo funciona igual sin precache.
 *
 * @param tecnicoId - tecnicos.id del técnico en sesión.
 */
export async function prepararModoOffline(
    tecnicoId: string,
    onProgreso: OnProgreso = () => {},
): Promise<void> {
    if (typeof window === 'undefined') return

    function avisar(fase: FasePreparacion, detalle: string, porcentaje: number) {
        onProgreso({ fase, detalle, porcentaje, listo: fase === 'listo', error: null })
    }

    if (!navigator.onLine) {
        onProgreso({
            fase: 'error',
            detalle: 'Sin conexión: no se puede preparar el modo offline.',
            porcentaje: 0,
            listo: false,
            error: 'sin-conexion',
        })
        return
    }

    try {
        // ── 1. Catálogos ─────────────────────────────────────────────────────
        avisar('catalogos', 'Descargando catálogos…', 5)
        await precargarCatalogos()

        // ── 2. Equipos ───────────────────────────────────────────────────────
        avisar('equipos', 'Descargando equipos…', 25)
        const equipos = await precargarEquipos()

        // ── 3. Reportes del técnico ──────────────────────────────────────────
        avisar('reportes', 'Descargando tus reportes…', 45)
        const reportes = await precargarReportes(tecnicoId)

        // ── 4. Pantallas y su JavaScript ─────────────────────────────────────
        //
        // Las rutas dinámicas necesitan un id real para que el servidor
        // devuelva el documento. Cuál sea da igual: el service worker lo guarda
        // bajo una clave canónica que cubre a todos los demás.
        avisar('pantallas', 'Preparando pantallas…', 60)

        const rutas = [...RUTAS_FIJAS]

        if (equipos[0]) rutas.push(`/tecnico/nuevo-reporte/${equipos[0].id}`)
        if (reportes[0]) rutas.push(`/tecnico/mis-reportes/${reportes[0]}`)

        await precachearPantallas(rutas, (hechas, total) =>
            avisar('pantallas', `Preparando pantallas… (${hechas}/${total})`, 60 + Math.round((hechas / total) * 35)),
        )

        avisar('listo', 'Listo para trabajar sin conexión', 100)
    } catch (err) {
        console.error('[preparar] falló la preparación offline:', err)
        onProgreso({
            fase: 'error',
            detalle: 'No se pudo preparar todo el modo offline.',
            porcentaje: 0,
            listo: false,
            error: err instanceof Error ? err.message : 'desconocido',
        })
    }
}

// ─── Pasos ────────────────────────────────────────────────────────────────────

async function precargarCatalogos(): Promise<void> {
    const datos = await fetchJSON<{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [k: string]: any[]
    }>('/api/offline/catalogs')

    await Promise.all([
        guardarCatalogo('tipos_mantenimiento', datos.tipos_mantenimiento),
        guardarCatalogo('insumos',             datos.insumos),
        guardarCatalogo('categorias',          datos.categorias),
        guardarCatalogo('checklists',          datos.checklists),
        guardarCatalogo('ubicaciones',         datos.ubicaciones),
        guardarCatalogo('tecnicos',            datos.tecnicos),
    ])
}

/**
 * Descarga los equipos y devuelve los que quedaron en caché.
 *
 * A diferencia de la versión anterior, refresca SIEMPRE en vez de salir si ya
 * había algo guardado: un caché a medias —por ejemplo el de una preparación
 * interrumpida— se daba por bueno y nunca se completaba.
 */
async function precargarEquipos(): Promise<Equipo[]> {
    try {
        const datos = await fetchJSON<{ equipos: Equipo[] }>('/api/offline/equipos')
        if (datos.equipos?.length) await guardarEquiposEnCache(datos.equipos)
    } catch (err) {
        console.warn('[preparar] equipos:', err)
    }

    return getAllEquiposFromCache()
}

/** Descarga los reportes del técnico y devuelve sus ids ya cacheados. */
async function precargarReportes(tecnicoId: string): Promise<string[]> {
    try {
        const datos = await fetchJSON<{ reportes: { id: string }[] }>(
            `/api/offline/reportes?tecnico_id=${encodeURIComponent(tecnicoId)}`,
        )
        if (datos.reportes?.length) await guardarReportesEnCache(datos.reportes)
    } catch (err) {
        console.warn('[preparar] reportes:', err)
    }

    return (await getReportesDeCache()).map((r) => r.id)
}

/**
 * Descarga cada pantalla y todo el JavaScript que necesita para arrancar.
 *
 * Los documentos se piden en serie a propósito: son pocos y así el parseo de
 * uno no compite con la descarga del siguiente en una conexión de campo. Los
 * assets, en cambio, se acumulan y se mandan al service worker en un solo lote
 * ya deduplicado — las pantallas comparten casi todo el bundle.
 */
async function precachearPantallas(
    rutas: string[],
    onPaso: (hechas: number, total: number) => void,
): Promise<void> {
    const assets = new Set<string>()
    const documentos: string[] = []

    for (let i = 0; i < rutas.length; i++) {
        const ruta = rutas[i]
        onPaso(i, rutas.length)

        try {
            const res = await fetch(ruta, { credentials: 'include' })
            if (!res.ok) continue

            documentos.push(ruta)
            assetsDelHtml(await res.text()).forEach((a) => assets.add(a))
        } catch (err) {
            console.warn(`[preparar] pantalla ${ruta}:`, err)
        }
    }

    onPaso(rutas.length, rutas.length)

    // El service worker vuelve a pedir los documentos para guardarlos con la
    // cabecera y la clave que le corresponden; el fetch de arriba solo sirvió
    // para leer de dónde cuelga el bundle.
    await precachearEnSW(documentos.concat(Array.from(assets)))
}
