// Service Worker — Mobilhospital Panel Técnico
// Estrategia: Cache First para assets estáticos, Network First para navegación.
// Versionar SHELL_VER al desplegar cambios que requieran invalidar el cache.

const SHELL_VER    = 'v1'
const SHELL_CACHE  = `mh-shell-${SHELL_VER}`
const ASSETS_CACHE = `mh-assets-${SHELL_VER}`

const VALID_CACHES = new Set([SHELL_CACHE, ASSETS_CACHE])

// Páginas del técnico que se intentan pre-cachear durante el install.
// Si el SW se instala sin red (reinstall desde caché del navegador), los
// fetch fallan silenciosamente gracias a Promise.allSettled.
const SHELL_PAGES = [
    '/tecnico/dashboard',
    '/tecnico/mis-reportes',
    '/tecnico/nuevo-reporte',
]

// ─── MESSAGE ─────────────────────────────────────────────────────────────────
// Manejar mensajes del cliente (p.ej. Chrome DevTools "Update" o Workbox).
// Devolver false implícitamente (sin async) evita el warning
// "A listener indicated an asynchronous response by returning true,
//  but the message channel closed".

self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting()
    }
    // Para cualquier otro mensaje no se envía respuesta asíncrona —
    // no retornamos true para no abrir el canal de respuesta.
})

// ─── INSTALL ─────────────────────────────────────────────────────────────────
// Pre-carga el shell con las cookies de sesión activa.
// skipWaiting() para que el nuevo SW tome control sin esperar que se
// cierren todas las pestañas del SW anterior.

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then((cache) =>
                Promise.allSettled(
                    SHELL_PAGES.map((url) =>
                        fetch(url, { credentials: 'include' })
                            .then((res) => { if (res.ok) return cache.put(url, res) })
                            .catch(() => { /* offline en install — se cachea en el primer fetch */ })
                    )
                )
            )
            .then(() => self.skipWaiting())
    )
})

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
// Elimina caches de versiones anteriores y toma control de todos los clientes
// sin necesidad de recargar la página.

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((k) => !VALID_CACHES.has(k))
                        .map((k) => caches.delete(k))
                )
            )
            .then(() => self.clients.claim())
    )
})

// ─── FETCH ───────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
    const { request } = event
    const url = new URL(request.url)

    // Solo GET del mismo origen
    if (request.method !== 'GET' || url.origin !== self.location.origin) return

    // Next.js usa RSC: 1 / Next-Router-State-Tree para navegación client-side.
    // Estos payloads son parciales (no HTML completo) — no cachear, no interceptar.
    if (
        request.headers.get('RSC') === '1' ||
        request.headers.get('Next-Router-State-Tree')
    ) return

    // ── 1. Assets estáticos de Next.js (content-hashed → immutables) ──────
    if (url.pathname.startsWith('/_next/static/')) {
        event.respondWith(cacheFirst(request, ASSETS_CACHE))
        return
    }

    // ── 2. API — Network Only (datos sensibles, nunca servir stale) ────────
    if (url.pathname.startsWith('/api/')) return

    // ── 3. Auth routes — Network Only ──────────────────────────────────────
    if (url.pathname.startsWith('/auth/')) return

    // ── 4. Archivos estáticos públicos (iconos, fuentes, manifest) ─────────
    if (/\.(woff2?|ttf|otf|ico|png|jpg|jpeg|svg|webmanifest)$/.test(url.pathname)) {
        event.respondWith(cacheFirst(request, ASSETS_CACHE))
        return
    }

    // ── 5. Navegación HTML — Network First, fallback a caché del shell ──────
    if (request.mode === 'navigate') {
        event.respondWith(networkFirstNav(request))
        return
    }
})

// ─── Estrategias ─────────────────────────────────────────────────────────────

/**
 * Cache First: sirve desde caché; si no está, descarga y guarda.
 * Adecuado para assets inmutables (hash en el nombre).
 */
async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName)
    const cached = await cache.match(request)
    if (cached) return cached

    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
}

/**
 * Network First para navegación:
 * 1. Intenta la red con cookies de sesión.
 * 2. Si la red falla (offline), busca la URL exacta en SHELL_CACHE.
 * 3. Si no está, intenta el dashboard cacheado como fallback.
 * 4. Último recurso: HTML mínimo que indica que se necesita conexión.
 */
async function networkFirstNav(request) {
    const cache = await caches.open(SHELL_CACHE)
    try {
        const response = await fetch(request, { credentials: 'include' })
        // Cachear solo respuestas HTML exitosas (evita guardar redirects o errores)
        if (response.ok && response.headers.get('Content-Type')?.includes('text/html')) {
            cache.put(request, response.clone())
        }
        return response
    } catch {
        // Offline: buscar en caché
        const cached =
            (await cache.match(request, { ignoreVary: true })) ||
            (await cache.match('/tecnico/dashboard', { ignoreVary: true }))

        if (cached) return cached

        // Sin caché disponible — el técnico nunca abrió la app con conexión
        return new Response(
            `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sin conexión — Mobilhospital</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0;
           background: #F1F5F9; color: #0F172A; text-align: center; padding: 1rem; }
    h1 { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
    p  { font-size: 0.875rem; color: #64748B; max-width: 280px; }
  </style>
</head>
<body>
  <div>
    <h1>Sin conexión</h1>
    <p>Abre la app primero con conexión a internet para activar el modo offline.</p>
  </div>
</body>
</html>`,
            {
                status: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
        )
    }
}
