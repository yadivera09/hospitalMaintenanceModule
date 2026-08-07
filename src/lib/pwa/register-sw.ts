/**
 * src/lib/pwa/register-sw.ts
 * Registro del service worker del panel técnico y limpieza de registros viejos.
 */

/** Único scope válido: el service worker solo sirve el panel del técnico. */
const SCOPE_PANEL = '/tecnico/'

/** Marca de recarga, para no repetirla si el registro tardara en desaparecer. */
const CLAVE_RECARGA = 'mh-sw-limpiado'

export function registerServiceWorker() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', async () => {
    try {
      await limpiarServiceWorkersObsoletos()

      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: SCOPE_PANEL,
      })

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            dispatchEvent(new CustomEvent('sw-update-available'))
          }
        })
      })
    } catch (error) {
      console.error('Error registrando Service Worker:', error)
    }
  })
}

/**
 * Da de baja cualquier service worker registrado fuera de SCOPE_PANEL.
 *
 * Existe por una versión anterior que registraba '/sw.js' sin scope: el valor
 * por omisión es la carpeta del script, o sea la raíz, y desde ahí el worker
 * controlaba TODA la aplicación. Añadir `scope` al registro no arregló los
 * navegadores que ya lo tenían — registrar con otro scope crea un registro
 * nuevo y deja el anterior intacto.
 *
 * El daño concreto era el inicio de sesión: el worker de raíz servía /login
 * desde caché y el usuario volvía al formulario vacío, sin error, con la sesión
 * ya abierta en las cookies (ver la nota en public/sw.js).
 *
 * Se llama desde dos sitios a propósito. Desde el panel, antes de registrar el
 * worker correcto; y desde el layout raíz, porque quien se queda atascado en el
 * login nunca llega al panel y sin eso no habría forma de que su navegador se
 * curara solo.
 */
export async function limpiarServiceWorkersObsoletos() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  const registros = await navigator.serviceWorker.getRegistrations().catch(() => [])
  const scopeEsperado = new URL(SCOPE_PANEL, window.location.origin).href

  const obsoletos = registros.filter((r) => r.scope !== scopeEsperado)
  if (obsoletos.length === 0) return

  await Promise.all(obsoletos.map((r) => r.unregister().catch(() => false)))

  // Dar de baja el registro no descontrola la página ya cargada: este documento
  // salió de la caché y sigue siendo el que sirvió el worker. Hace falta una
  // recarga para pedirlo a la red — sin ella, el login seguiría roto en esta
  // misma visita, que es justo cuando el usuario está intentando entrar.
  if (sessionStorage.getItem(CLAVE_RECARGA)) return

  sessionStorage.setItem(CLAVE_RECARGA, '1')
  window.location.reload()
}
