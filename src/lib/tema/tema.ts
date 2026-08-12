/**
 * src/lib/tema/tema.ts
 * Tema claro/oscuro del panel de administración.
 *
 * La preferencia viaja en una cookie, no en localStorage, y es a propósito: el
 * layout es un Server Component y puede leerla ANTES de renderizar, así que la
 * primera pintura ya sale con el tema correcto. Con localStorage habría que
 * esperar al JavaScript del cliente, y en cada carga se vería el destello del
 * tema equivocado — más molesto todavía viniendo de oscuro.
 *
 * La clase 'dark' va en el contenedor del panel — ahí es donde la pone el
 * servidor, y por eso la primera pintura ya sale bien. El resto de la
 * aplicación (login, panel del técnico) está pintada con colores fijos y no
 * participa del tema: si la clase se quedara puesta en esas pantallas, sus
 * variables de shadcn cambiarían y saldrían, por ejemplo, botones claros sobre
 * fondos claros.
 *
 * Con una excepción: mientras el panel está montado, AdminLayoutClient marca
 * también <html>. Es la única forma de alcanzar lo que Radix portalea a
 * document.body — modales, selects, desplegables — que de otro modo se quedan
 * en tema claro. La marca se retira al desmontar, así que fuera del panel
 * sigue sin haber rastro.
 */

export type Tema = 'claro' | 'oscuro'

export const COOKIE_TEMA = 'mh-tema'

export const TEMA_POR_DEFECTO: Tema = 'claro'

/** Un año: la preferencia de tema no tiene por qué caducar en una sesión. */
const MAX_EDAD_COOKIE = 60 * 60 * 24 * 365

export function esTema(valor: string | undefined | null): valor is Tema {
    return valor === 'claro' || valor === 'oscuro'
}

/** Guarda la preferencia para que el servidor la lea en la siguiente carga. */
export function guardarTema(tema: Tema) {
    if (typeof document === 'undefined') return

    document.cookie = `${COOKIE_TEMA}=${tema}; path=/; max-age=${MAX_EDAD_COOKIE}; samesite=lax`
}
