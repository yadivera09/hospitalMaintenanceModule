/**
 * src/lib/seguridad/navegacion.ts
 *
 * Construye el menú de navegación a partir de los permisos del usuario.
 *
 * Antes el sidebar era una constante en el código (NAV_MODULES): todos veían
 * lo mismo y la matriz de permisos no influía en nada. Ahora la estructura
 * sale de menus → modulos y se filtra por el permiso 'ver'.
 *
 * Ocultar no es proteger: el middleware es quien impide el acceso. Esto evita
 * mostrar puertas cerradas, que es un problema de claridad, no de seguridad.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { permisosUsuario } from '@/lib/seguridad/permisos'

/**
 * Cabecera con la que el middleware comunica la ruta pedida a los Server
 * Components.
 *
 * Un layout no recibe el pathname por props ni puede leerlo del router, y sin
 * él solo puede comprobar «tiene algo en esta sección», nunca «tiene permiso
 * sobre ESTA pantalla». El middleware la sobrescribe siempre (set, no append),
 * así que un valor enviado por el cliente nunca sobrevive.
 */
export const PATHNAME_HEADER = 'x-pathname'

/** Una entrada de navegación: una pantalla del sistema. */
export interface ModuloNav {
    nombre: string
    url: string
    /** Nombre del icono; el cliente lo resuelve a un componente. */
    icono: string
}

/** Un grupo del sidebar con las pantallas que el usuario puede ver. */
export interface MenuNav {
    nombre: string
    icono: string
    modulos: ModuloNav[]
}

/**
 * Devuelve los menús con los módulos que el usuario tiene permiso de ver.
 * Los grupos que quedan sin módulos visibles no se incluyen.
 *
 * @param userId       - auth.users.id
 * @param prefijoRuta  - Acota a una sección, ej '/admin'. El panel de
 *                       administración no debe listar las pantallas del
 *                       técnico aunque la persona tenga ambos roles.
 */
export async function getNavegacionUsuario(
    userId: string,
    prefijoRuta?: string,
    /** Permisos ya resueltos, para no repetir la consulta si quien llama los tiene. */
    permisosPrecalculados?: Record<string, string[]>
): Promise<MenuNav[]> {
    const admin = createAdminClient()

    const [permisos, { data, error }] = await Promise.all([
        permisosPrecalculados ?? permisosUsuario(userId),
        admin
            .from('menus')
            .select(`
                nombre, icono, orden, activo,
                modulos ( nombre, url, icono, orden, activo )
            `)
            .eq('activo', true)
            .order('orden', { ascending: true }),
    ])

    if (error) {
        console.error('[getNavegacionUsuario]', error.message)
        return []
    }

    const menus: MenuNav[] = []

    for (const menu of data ?? []) {
        const modulos = ((menu.modulos ?? []) as unknown as (ModuloNav & { activo: boolean; orden: number })[])
            .filter((m) => m.activo)
            .filter((m) => !prefijoRuta || m.url.startsWith(prefijoRuta))
            .filter((m) => permisos[m.url]?.includes('ver'))
            // La url desempata por el mismo motivo que en getUrlsModulos: 'orden'
            // no es único dentro de un menú y sin desempate el sidebar podría
            // listar las pantallas en distinto orden en cada carga.
            .sort((a, b) => a.orden - b.orden || a.url.localeCompare(b.url))
            .map((m) => ({ nombre: m.nombre, url: m.url, icono: m.icono }))

        if (modulos.length > 0) {
            menus.push({ nombre: menu.nombre, icono: menu.icono, modulos })
        }
    }

    return menus
}

/**
 * Devuelve las URLs de TODOS los módulos activos del catálogo.
 *
 * Es el conjunto contra el que hay que resolver una ruta para decidir si está
 * gobernada por la matriz. Resolverla contra los módulos que el usuario ya
 * tiene concedidos haría la comprobación inútil: una ruta sin permiso no
 * coincidiría con nada y se dejaría pasar por considerarla no modelada.
 */
export async function getUrlsModulos(): Promise<string[]> {
    const admin = createAdminClient()

    const { data, error } = await admin
        .from('modulos')
        .select('url, orden, menus ( orden )')
        .eq('activo', true)

    if (error) {
        console.error('[getUrlsModulos]', error.message)
        return []
    }

    // Orden estable: primero por menú, luego por posición dentro del menú y,
    // ante un empate, por url.
    //
    // Importa porque quien llama toma el primer módulo visible como destino
    // tras el login. (menu.orden, modulo.orden) NO es único: dos módulos del
    // mismo menú pueden compartir posición, y la consulta no lleva ORDER BY,
    // así que el ganador del empate sería el orden arbitrario en que Postgres
    // devuelva las filas — el destino cambiaría entre peticiones. La url sí es
    // única (restricción de la tabla), de modo que desempatar con ella hace el
    // orden total y el destino reproducible.
    type Fila = { url: string; orden: number; menus: { orden: number } | null }

    return ((data ?? []) as unknown as Fila[])
        .sort((a, b) =>
            (a.menus?.orden ?? 0) - (b.menus?.orden ?? 0) ||
            a.orden - b.orden ||
            a.url.localeCompare(b.url)
        )
        .map((m) => m.url)
}

/**
 * Resuelve qué módulo gobierna una ruta, por prefijo más largo.
 *
 * '/admin/reportes/abc-123' pertenece a '/admin/reportes', y
 * '/admin/reportes/analisis' a sí misma y no a '/admin/reportes' — de ahí que
 * gane el prefijo más largo y no el primero que coincida.
 *
 * @returns La url del módulo, o null si ninguna ruta modelada la cubre.
 */
export function resolverModulo(pathname: string, urlsModulos: string[]): string | null {
    let mejor: string | null = null

    for (const url of urlsModulos) {
        if (pathname === url || pathname.startsWith(`${url}/`)) {
            if (!mejor || url.length > mejor.length) mejor = url
        }
    }

    return mejor
}

/**
 * Módulos del catálogo que cuelgan de una ruta, sin contarla a ella misma.
 *
 * Existe por las pantallas «contenedor» que no están en el catálogo pero cuyos
 * hijos sí: '/admin/seguridad' es un resumen del módulo de seguridad y no tiene
 * fila propia, mientras que '/admin/seguridad/roles', '/usuarios', '/grupos' y
 * '/auditoria' sí la tienen.
 *
 * Sin esto, resolverModulo() devuelve null para esa ruta, se toma por no
 * modelada y se deja pasar — que es justo lo contrario de lo que debe ocurrir
 * con la portada de una sección restringida. Quien llama la usa para exigir
 * permiso sobre al menos uno de los hijos.
 */
export function modulosDescendientes(pathname: string, urlsModulos: string[]): string[] {
    return urlsModulos.filter((url) => url.startsWith(`${pathname}/`))
}

/**
 * Primer módulo que el usuario puede ver, respetando el orden del catálogo.
 *
 * Es el destino al que se manda a quien se le niega una ruta: enviarlo a un
 * panel fijo podría rebotarlo otra vez si tampoco tiene permiso sobre él.
 *
 * @returns La url, o null si no puede ver ninguna pantalla del sistema.
 */
export function primerModuloVisible(
    permisos: Record<string, string[]>,
    urlsCatalogo: string[]
): string | null {
    return urlsCatalogo.find((url) => permisos[url]?.includes('ver')) ?? null
}
