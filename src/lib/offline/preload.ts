import {
    guardarCatalogo,
    guardarEquiposEnCache,
    getCatalogo,
    countEquiposEnCache,
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
    // Verificar si algún catálogo ya tiene caché válida para evitar la petición
    const yaEnCache = await getCatalogo('tipos_mantenimiento')
    if (yaEnCache) return

    try {
        const datos = await fetchJSON<{
            tipos_mantenimiento: any[]
            insumos: any[]
            categorias: any[]
            checklists: any[]
        }>('/api/offline/catalogs')

        await Promise.all([
            guardarCatalogo('tipos_mantenimiento', datos.tipos_mantenimiento),
            guardarCatalogo('insumos', datos.insumos),
            guardarCatalogo('categorias', datos.categorias),
            guardarCatalogo('checklists', datos.checklists),
        ])
    } catch (err) {
        console.warn('[preload] No se pudieron cachear catálogos:', err)
    }
}

async function precargarEquipos(tecnicoId: string): Promise<void> {
    // Verificar TTL: si hay equipos cacheados vigentes, saltar
    const count = await countEquiposEnCache()
    if (count > 0) return

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

    await Promise.allSettled([
        // getCatalogo devuelve null si TTL venció → precargarCatalogos lo recargará
        getCatalogo('tipos_mantenimiento').then(v => {
            if (!v) return precargarCatalogos()
        }),
        countEquiposEnCache().then(count => {
            if (count === 0) return precargarEquipos(tecnicoId)
        }),
    ])
}
