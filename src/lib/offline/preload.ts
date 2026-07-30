import {
    guardarCatalogo,
    guardarEquiposEnCache,
    getCatalogo,
} from './db'
import type { Equipo } from '@/types'

// ─── Helpers internos ─────────────────────────────────────────────────────────

async function fetchJSON<T>(url: string): Promise<T> {
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) throw new Error(`[preload] ${url} → ${res.status}`)
    return res.json() as Promise<T>
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Precarga catálogos y equipos en IndexedDB al iniciar sesión con conexión.
 * Ejecutar en background — no bloquear el render principal.
 *
 * TTL:
 *   - Catálogos (tipos, insumos, categorías, checklists): 24 h
 *   - Equipos del técnico: 12 h
 *
 * Si el caché aún es válido, omite la petición de red para ese store.
 */
export async function precargarDatosOffline(tecnicoId: string): Promise<void> {
    if (typeof window === 'undefined' || !navigator.onLine) return

    await Promise.allSettled([
        precargarCatalogos(),
        precargarEquipos(tecnicoId),
    ])
}

async function precargarCatalogos(): Promise<void> {
    // Comprobar todos los catálogos requeridos — si alguno falta, refetch completo.
    // (Antes solo se chequeaba tipos_mantenimiento, lo que dejaba ubicaciones y
    //  tecnicos sin cachear si ya existía ese key pero los otros no.)
    const [tipos, ubicaciones, tecnicos] = await Promise.all([
        getCatalogo('tipos_mantenimiento'),
        getCatalogo('ubicaciones'),
        getCatalogo('tecnicos'),
    ])
    if (tipos && ubicaciones && tecnicos) return

    try {
        const datos = await fetchJSON<{
            tipos_mantenimiento: any[]
            insumos: any[]
            categorias: any[]
            checklists: any[]
            ubicaciones: any[]
            tecnicos: any[]
        }>('/api/offline/catalogs')

        await Promise.all([
            guardarCatalogo('tipos_mantenimiento', datos.tipos_mantenimiento),
            guardarCatalogo('insumos',             datos.insumos),
            guardarCatalogo('categorias',          datos.categorias),
            guardarCatalogo('checklists',          datos.checklists),
            guardarCatalogo('ubicaciones',         datos.ubicaciones),
            guardarCatalogo('tecnicos',            datos.tecnicos),
        ])
    } catch (err) {
        console.warn('[preload] No se pudieron cachear catálogos:', err)
    }
}

async function precargarEquipos(tecnicoId: string): Promise<void> {
    const { getAllEquiposFromCache } = await import('./db')
    const equiposVigentes = await getAllEquiposFromCache()
    if (equiposVigentes.length > 0) return

    try {
        const datos = await fetchJSON<{ equipos: Equipo[] }>(
            `/api/offline/equipos?tecnico_id=${encodeURIComponent(tecnicoId)}`,
        )
        if (datos.equipos?.length) {
            await guardarEquiposEnCache(datos.equipos)
        }
    } catch (err) {
        console.warn('[preload] No se pudieron cachear equipos:', err)
    }
}

/**
 * Refresca los stores cuyo TTL haya vencido.
 * Llamar al reconectar antes de usar datos de caché.
 */
export async function refrescarCacheVencida(tecnicoId: string): Promise<void> {
    if (!navigator.onLine) return

    const { getAllEquiposFromCache } = await import('./db')

    await Promise.allSettled([
        // Catálogos: refetch si alguno de los requeridos está vencido o ausente
        Promise.all([
            getCatalogo('tipos_mantenimiento'),
            getCatalogo('ubicaciones'),
            getCatalogo('tecnicos'),
        ]).then(([tipos, ubicaciones, tecnicos]) => {
            if (!tipos || !ubicaciones || !tecnicos) return precargarCatalogos()
        }),
        // Equipos: refetch si el store está vacío (TTL 12h gestionado por getAllEquiposFromCache)
        getAllEquiposFromCache().then(equipos => {
            if (equipos.length === 0) return precargarEquipos(tecnicoId)
        }),
    ])
}
