/**
 * src/lib/seguridad/autorizarRuta.ts
 *
 * Autorización de una pantalla concreta dentro de un panel.
 *
 * Es la segunda línea de defensa que aplican los layouts: repite contra la
 * matriz de permisos lo que ya decidió el middleware, para que una ruta que se
 * le escape al matcher no deje el panel abierto.
 *
 * Vive aquí y no dentro de un layout porque los dos paneles —administración y
 * técnico— necesitan exactamente la misma regla. Duplicarla garantizaba que
 * tarde o temprano divergieran y uno de los dos quedara más flojo que el otro.
 */

import { resolverModulo, modulosDescendientes, primerModuloVisible } from '@/lib/seguridad/navegacion'

/**
 * Decide si el usuario puede ver la pantalla pedida.
 *
 * Tres casos, en orden:
 *
 *   1. La ruta pertenece a un módulo del catálogo → exige 'ver' sobre él.
 *      Cubre lo normal, incluidos los detalles: /admin/equipos/<id> hereda de
 *      /admin/equipos por el prefijo más largo.
 *
 *   2. La ruta no es un módulo pero tiene módulos colgando → exige 'ver' sobre
 *      al menos uno. Es el caso de /admin/seguridad, que es la portada de la
 *      sección y no tiene fila propia en el catálogo. Sin esta rama caería en
 *      el caso 3 y quedaría abierta a cualquiera con acceso al panel.
 *
 *   3. Ni módulo ni descendientes → se deja pasar. Bloquear por defecto
 *      volvería inaccesibles pantallas legítimas ante un catálogo incompleto,
 *      que es el mismo criterio que aplica el middleware. Quien llama sigue
 *      exigiendo, como mínimo, acceso al panel.
 */
export function puedeVerRuta(
    pathname: string,
    permisos: Record<string, string[]>,
    urlsCatalogo: string[],
): boolean {
    const modulo = resolverModulo(pathname, urlsCatalogo)

    if (modulo) return permisos[modulo]?.includes('ver') ?? false

    const hijos = modulosDescendientes(pathname, urlsCatalogo)

    if (hijos.length > 0) return hijos.some((url) => permisos[url]?.includes('ver'))

    return true
}

/**
 * A dónde mandar a quien se le niega una pantalla.
 *
 * A su primera pantalla visible, no a /login: con la sesión viva el middleware
 * lo devolvería a esa misma pantalla, así que redirigir a /login solo añade un
 * rebote. Solo cuando no puede ver nada se le manda a /login, con el motivo que
 * la página sabe explicar.
 */
export function destinoAlternativo(
    permisos: Record<string, string[]>,
    urlsCatalogo: string[],
): string {
    return primerModuloVisible(permisos, urlsCatalogo) ?? '/login?motivo=sin-acceso'
}
