// Service Worker — Mobilhospital Panel Técnico  v2
//
// Estrategias:
//   Cache First          → assets estáticos Next.js + archivos públicos
//   Stale While Revalidate → páginas de navegación
//   Network First        → GET /api/tecnico/*
//   Background Sync      → POST/PATCH /api/tecnico/*
//   Network Only         → resto de /api/, /auth/

// Subir esta versión invalida shell y assets en el próximo activate. Hacerlo
// siempre que cambien las estrategias de caché: si no, los dispositivos siguen
// sirviendo lo que guardó la versión anterior con las reglas anteriores.
const SHELL_VER    = 'v5'
const SHELL_CACHE  = `mh-shell-${SHELL_VER}`
const ASSETS_CACHE = `mh-assets-${SHELL_VER}`

// Claves canónicas de las rutas dinámicas. Una sola copia del HTML sirve para
// CUALQUIER id: el documento que Next entrega es el mismo cascarón para todos,
// y quien resuelve el id es el JavaScript ya en el dispositivo leyendo
// IndexedDB. Sin esto, offline solo se abrirían los ids visitados con red.
const WIZARD_SHELL_KEY   = '/tecnico/nuevo-reporte/_shell'
const REPORTE_SHELL_KEY  = '/tecnico/mis-reportes/_shell'

/** Rutas dinámicas del panel y la clave canónica bajo la que se cachean. */
const SHELLS_DINAMICOS = [
    { patron: /^\/tecnico\/nuevo-reporte\/.+/, clave: WIZARD_SHELL_KEY },
    { patron: /^\/tecnico\/mis-reportes\/.+/,  clave: REPORTE_SHELL_KEY },
]

/** Clave canónica que cubre una ruta, o null si no es dinámica. */
function claveShell(pathname) {
    return SHELLS_DINAMICOS.find((s) => s.patron.test(pathname))?.clave ?? null
}

/**
 * ¿Es una navegación que este service worker debe servir desde caché?
 *
 * Solo el panel del técnico y la pantalla de respaldo. El resto de la app
 * —login, flujo MFA, panel de administración— va siempre a la red.
 *
 * El filtro parece redundante, porque el registro declara scope '/tecnico/' y
 * un service worker no ve nada fuera de su scope. Lo es en un navegador limpio;
 * no en los que ya abrieron la app. Una versión anterior registraba '/sw.js'
 * SIN scope, o sea en la raíz, y ese registro sigue vivo: declarar otro scope
 * crea un registro nuevo, nunca borra el anterior.
 *
 * Con el registro de raíz, stale-while-revalidate alcanzaba a /login. La página
 * quedaba cacheada y, al iniciar sesión, el navegador recibía esa copia en lugar
 * del 303 del middleware: el formulario reaparecía vacío, sin mensaje de error y
 * sin haber navegado a ninguna parte, con la sesión ya abierta en las cookies.
 * Y no se recuperaba solo — la revalidación en segundo plano descarta las
 * respuestas redirigidas (ver esDocumentoUtil), así que la copia del login se
 * quedaba en la caché indefinidamente.
 *
 * Por eso la comprobación vive aquí y no solo en el scope del registro: es la
 * única que también protege a los navegadores ya contaminados.
 */
function esNavegacionCacheable(pathname) {
    return (
        pathname === '/tecnico' ||
        pathname.startsWith('/tecnico/') ||
        pathname === '/offline.html'
    )
}

/**
 * ¿Vale la pena guardar esta respuesta como pantalla del panel?
 *
 * El descarte por redirección es el que importa: si la sesión caduca mientras
 * se revalida en segundo plano, el servidor responde con un redirect a /login y
 * fetch lo sigue solo, devolviendo el HTML del login con status 200 y
 * Content-Type text/html. Sin esta comprobación, esa página se guardaría bajo
 * la clave del dashboard y el técnico se encontraría en campo, sin red, con un
 * formulario de inicio de sesión que no puede completar.
 */
function esDocumentoUtil(response) {
    return (
        response.ok &&
        !response.redirected &&
        !!response.headers.get('Content-Type')?.includes('text/html')
    )
}

const VALID_CACHES = new Set([SHELL_CACHE, ASSETS_CACHE])

// Páginas precacheadas en install. Si no hay red, Promise.allSettled las salta.
const SHELL_PAGES = [
    '/tecnico/dashboard',
    '/tecnico/mis-reportes',
    '/tecnico/nuevo-reporte',
    '/offline.html',
]

// ─── IndexedDB helpers (raw API — no idb library en SW) ───────────────────────
// Lee la cola de reportes pendientes desde la misma DB que usa la app.

const APP_DB_NAME = 'mobilhospital-offline'

/**
 * Abre la base que gestiona la app, SIN fijar versión.
 *
 * Fijarla aquí es una trampa: indexedDB.open(nombre, N) contra una base que ya
 * está en una versión mayor lanza VersionError, y este service worker se traga
 * el fallo — la cola de sincronización dejaría de subir reportes en silencio,
 * que es la peor forma de romperse en una app de campo. Pasó al migrar el
 * esquema de v2 a v3: el SW seguía pidiendo la v2.
 *
 * Sin argumento de versión se abre la que exista, sea cual sea. El esquema lo
 * crea y migra la app (src/lib/offline/db.ts); aquí solo se lee, así que este
 * archivo no tiene por qué enterarse de cada migración.
 */
function abrirAppDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(APP_DB_NAME)
        req.onsuccess = () => resolve(req.result)
        req.onerror   = () => reject(req.error)
        // Solo se dispara si la base no existía: la app nunca se abrió y no hay
        // nada que sincronizar. Se aborta para no crearla vacía y sin esquema.
        req.onupgradeneeded = () => {
            req.transaction?.abort()
            reject(new Error('DB no existe aún — la app no se ha abierto'))
        }
    })
}

function txGetAll(db, storeName) {
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const req   = store.getAll()
        req.onsuccess = () => resolve(req.result)
        req.onerror   = () => reject(req.error)
    })
}

function txGet(db, storeName, key) {
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const req   = store.get(key)
        req.onsuccess = () => resolve(req.result)
        req.onerror   = () => reject(req.error)
    })
}

function txDelete(db, storeName, key) {
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const req   = store.delete(key)
        req.onsuccess = () => resolve()
        req.onerror   = () => reject(req.error)
    })
}

function txPut(db, storeName, value) {
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const req   = store.put(value)
        req.onsuccess = () => resolve()
        req.onerror   = () => reject(req.error)
    })
}

// ─── MESSAGE ──────────────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting()
        return
    }

    // Precache bajo demanda — lo pide la app al preparar el modo offline.
    //
    // Existe porque el service worker no puede adivinar qué necesita el técnico:
    // solo cachea lo que el navegador va pidiendo, así que las pantallas no
    // visitadas con red quedaban fuera. Aquí la app toma la iniciativa y manda
    // la lista completa antes de que el dispositivo se quede sin conexión.
    if (event.data?.type === 'PRECACHE_RUTAS') {
        event.waitUntil(
            precacheRutas(event.data.urls ?? [])
                .then((resultado) => event.source?.postMessage({
                    type: 'PRECACHE_RUTAS_LISTO',
                    ...resultado,
                }))
        )
    }
})

/**
 * Descarga y guarda una lista de URLs.
 *
 * Los documentos van al shell (y también bajo su clave canónica si la ruta es
 * dinámica); todo lo demás, a assets. Un fallo individual no aborta el lote:
 * cachear nueve de diez pantallas es mejor que ninguna.
 */
async function precacheRutas(urls) {
    const [shell, assets] = await Promise.all([
        caches.open(SHELL_CACHE),
        caches.open(ASSETS_CACHE),
    ])

    let guardadas = 0
    let fallidas  = 0

    await Promise.all(urls.map(async (url) => {
        try {
            const respuesta = await fetch(url, { credentials: 'include' })
            if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`)

            const pathname = new URL(url, self.location.origin).pathname
            const esAsset  = pathname.startsWith('/_next/static/')
            const clave    = url.split('?')[0]

            if (esAsset) {
                await assets.put(clave, respuesta.clone())
                guardadas++
                return
            }

            // Una pantalla que llegó por redirección es la de login, no la que
            // se pidió: guardarla dejaría al técnico sin esa pantalla offline.
            if (!esDocumentoUtil(respuesta)) throw new Error('respuesta no utilizable')

            await shell.put(clave, respuesta.clone())

            const canonica = claveShell(pathname)
            if (canonica) await shell.put(canonica, respuesta.clone())

            guardadas++
        } catch {
            fallidas++
        }
    }))

    return { guardadas, fallidas, total: urls.length }
}

// ─── INSTALL ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then((cache) =>
                Promise.allSettled(
                    SHELL_PAGES.map((url) => {
                        // Guardar siempre con URL sin query params como clave canónica.
                        // Así cacheFirst con ignoreSearch:true puede matchear
                        // aunque la request llegue con ?v=timestamp.
                        const cleanUrl = url.split('?')[0]
                        return fetch(cleanUrl, { credentials: 'include' })
                            .then((res) => {
                                // /offline.html es un archivo suelto, no una
                                // pantalla del panel: se acepta con res.ok. El
                                // resto pasa el filtro que descarta redirecciones
                                // al login (ver esDocumentoUtil).
                                const aceptable = cleanUrl === '/offline.html'
                                    ? res.ok
                                    : esDocumentoUtil(res)
                                if (aceptable) return cache.put(cleanUrl, res)
                            })
                            .catch(() => {})
                    })
                )
            )
            .then(() => self.skipWaiting())
    )
})

// ─── ACTIVATE ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) =>
                Promise.all(
                    keys.filter((k) => !VALID_CACHES.has(k)).map((k) => caches.delete(k))
                )
            )
            .then(() => self.clients.claim())
    )
})

// ─── FETCH ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
    const { request } = event
    const url = new URL(request.url)

    if (url.origin !== self.location.origin) return

    // RSC payloads — no interceptar
    if (
        request.headers.get('RSC') === '1' ||
        request.headers.get('Next-Router-State-Tree')
    ) return

    // ── Background Sync: escrituras al módulo técnico ──────────────────────
    if (
        (request.method === 'POST' || request.method === 'PATCH') &&
        url.pathname.startsWith('/api/tecnico/')
    ) {
        event.respondWith(handleWrite(request))
        return
    }

    // Solo GET a partir de aquí
    if (request.method !== 'GET') return

    // ── 1. Cache First: assets estáticos de Next.js (content-hashed) ──────
    if (url.pathname.startsWith('/_next/static/')) {
        event.respondWith(cacheFirst(request, ASSETS_CACHE))
        return
    }

    // ── 2. Network First: GET /api/tecnico/* ───────────────────────────────
    if (url.pathname.startsWith('/api/tecnico/')) {
        event.respondWith(networkFirstAPI(request))
        return
    }

    // ── 3. Network Only: resto de /api/, /auth/ ────────────────────────────
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

    // ── 4. Cache First: archivos estáticos públicos ────────────────────────
    if (/\.(woff2?|ttf|otf|ico|png|jpg|jpeg|svg|webmanifest|json)$/.test(url.pathname)) {
        event.respondWith(cacheFirst(request, ASSETS_CACHE))
        return
    }

    // ── 5. Stale While Revalidate: navegación HTML del panel ───────────────
    if (request.mode === 'navigate' && esNavegacionCacheable(url.pathname)) {
        event.respondWith(staleWhileRevalidate(request))
        return
    }
})

// ─── SYNC ─────────────────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-reportes') {
        event.waitUntil(procesarColaReportes())
    }
})

// ─── Estrategia: Cache First ──────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
    const cache  = await caches.open(cacheName)

    // ignoreSearch:true maneja ?v=timestamp que Next.js añade en desarrollo.
    const cached = await cache.match(request, { ignoreSearch: true })
    if (cached) return cached

    try {
        const response = await fetch(request)
        if (response.ok) {
            // Guardar con URL limpia como clave canónica para que el próximo
            // request con distinto timestamp encuentre el match.
            const cleanKey = request.url.split('?')[0]
            cache.put(cleanKey, response.clone())
        }
        return response
    } catch {
        // Offline y no está en caché — nunca rechazar la promesa.
        if (request.mode === 'navigate') {
            const offlinePage =
                (await caches.match('/offline.html')) ||
                new Response(offlineFallbackHTML(), {
                    status: 200,
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                })
            return offlinePage
        }
        // Assets estáticos (JS, CSS, fuentes, imágenes): respuesta vacía.
        return new Response(null, { status: 204 })
    }
}

// ─── Estrategia: Network First (APIs de lectura) ──────────────────────────────

async function networkFirstAPI(request) {
    const cache = await caches.open(SHELL_CACHE)
    try {
        const response = await fetch(request, { credentials: 'include' })
        if (response.ok) cache.put(request, response.clone())
        return response
    } catch {
        const cached = await cache.match(request)
        if (cached) return cached

        return new Response(JSON.stringify({ offline: true, error: 'Sin conexión' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}

// ─── Estrategia: Stale While Revalidate (páginas) ────────────────────────────

async function staleWhileRevalidate(request) {
    const cache    = await caches.open(SHELL_CACHE)
    const url      = new URL(request.url)
    const canonica = claveShell(url.pathname)

    // Buscar hit exacto; si es ruta dinámica y no hay hit, usar el shell canónico
    let cached = await cache.match(request, { ignoreVary: true })
    if (!cached && canonica) {
        cached = await cache.match(canonica, { ignoreVary: true })
    }

    // Actualiza la caché en background — no se espera el resultado
    const revalidation = fetch(request, { credentials: 'include' })
        .then((response) => {
            if (esDocumentoUtil(response)) {
                cache.put(request, response.clone())
                // Guardar copia canónica para que otros IDs funcionen offline
                if (canonica) cache.put(canonica, response.clone())
            }
            return response
        })
        .catch(() => null)

    if (cached) {
        // Devuelve el stale inmediatamente; la red actualiza en background
        return cached
    }

    // Sin caché — esperar la red
    const response = await revalidation
    if (response) return response

    // Sin red y sin caché — página offline
    const offlinePage =
        (await cache.match('/offline.html', { ignoreVary: true })) ||
        (await caches.match('/offline.html'))

    if (offlinePage) return offlinePage

    return new Response(offlineFallbackHTML(), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
}

// ─── Estrategia: Background Sync (escrituras POST/PATCH) ─────────────────────

async function handleWrite(request) {
    try {
        return await fetch(request.clone(), { credentials: 'include' })
    } catch {
        // Red no disponible — la app maneja el almacenamiento offline en IndexedDB.
        // Registrar sync para procesar cuando vuelva la conexión.
        if ('sync' in self.registration) {
            try {
                await self.registration.sync.register('sync-reportes')
            } catch { /* El navegador puede denegar el sync — se reintentará en la próxima apertura */ }
        }

        return new Response(JSON.stringify({
            offline: true,
            queued: true,
            message: 'Sin conexión. El reporte se enviará cuando se recupere la conexión.',
        }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}

// ─── Background Sync: procesar cola de reportes pendientes ───────────────────
// Lee directamente desde la DB `mobilhospital-offline` que gestiona la app.
// Llama a /api/sync con cada reporte pendiente, igual que lo haría la app.

async function procesarColaReportes() {
    let db
    try {
        db = await abrirAppDB()
    } catch {
        // La app nunca se abrió o la DB no existe todavía — nada que sincronizar
        return
    }

    let cola = []
    try {
        cola = await txGetAll(db, 'sync_queue')
    } catch {
        return
    }

    if (cola.length === 0) return

    for (const item of cola) {
        const reporte = await txGet(db, 'reportes_borrador', item.reporte_local_id).catch(() => null)

        if (!reporte) {
            await txDelete(db, 'sync_queue', item.id).catch(() => {})
            continue
        }

        if (reporte.estado === 'sincronizando') continue

        try {
            // Marcar como sincronizando
            await txPut(db, 'reportes_borrador', {
                ...reporte,
                estado: 'sincronizando',
                updated_at: new Date().toISOString(),
            })

            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(reporte),
            })

            const json = await res.json().catch(() => ({}))

            if (!res.ok || json.error) {
                throw new Error(json.error ?? `HTTP ${res.status}`)
            }

            // Éxito: limpiar de ambas stores
            await txDelete(db, 'reportes_borrador', reporte.id).catch(() => {})
            await txDelete(db, 'sync_queue', item.id).catch(() => {})

            // Notificar a los clientes abiertos
            const clients = await self.clients.matchAll({ type: 'window' })
            clients.forEach((client) =>
                client.postMessage({ type: 'SYNC_COMPLETED', reporteId: reporte.id })
            )
        } catch (error) {
            // Dejar en la cola para el próximo intento
            await txPut(db, 'reportes_borrador', {
                ...reporte,
                estado: 'error_sync',
                motivo_error: error?.message ?? 'Error desconocido',
                updated_at: new Date().toISOString(),
            }).catch(() => {})
        }
    }
}

// ─── HTML inline de último recurso (si /offline.html no está en caché) ───────

function offlineFallbackHTML() {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sin conexión — Mobilhospital</title>
  <style>
    body{font-family:system-ui,sans-serif;display:flex;align-items:center;
         justify-content:center;min-height:100vh;margin:0;
         background:#F1F5F9;color:#0F172A;text-align:center;padding:1rem}
    h1{font-size:1.25rem;font-weight:700;margin-bottom:.5rem}
    p{font-size:.875rem;color:#64748B;max-width:280px}
    a{display:inline-block;margin-top:1rem;padding:.5rem 1.25rem;
      background:#1E40AF;color:#fff;border-radius:.5rem;text-decoration:none;font-size:.875rem}
  </style>
</head>
<body>
  <div>
    <h1>Sin conexión</h1>
    <p>Abre la app con conexión a internet para activar el modo offline.</p>
    <a href="/tecnico/mis-reportes">Ver reportes guardados</a>
  </div>
</body>
</html>`
}
