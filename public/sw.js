// Service Worker — Mobilhospital Panel Técnico  v2
//
// Estrategias:
//   Cache First          → assets estáticos Next.js + archivos públicos
//   Stale While Revalidate → páginas de navegación
//   Network First        → GET /api/tecnico/*
//   Background Sync      → POST/PATCH /api/tecnico/*
//   Network Only         → resto de /api/, /auth/

const SHELL_VER    = 'v3'
const SHELL_CACHE  = `mh-shell-${SHELL_VER}`
const ASSETS_CACHE = `mh-assets-${SHELL_VER}`

// Clave canónica para el shell del wizard — cualquier /tecnico/nuevo-reporte/[id]
// visitado online se guarda aquí para servir a otros IDs offline.
const WIZARD_SHELL_KEY = '/tecnico/nuevo-reporte/_shell'

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

const APP_DB_NAME    = 'mobilhospital-offline'
const APP_DB_VERSION = 2

function abrirAppDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(APP_DB_NAME, APP_DB_VERSION)
        req.onsuccess  = () => resolve(req.result)
        req.onerror    = () => reject(req.error)
        // Si llega acá sin la DB creada, onupgradeneeded no se dispara
        // porque la app es quien crea el esquema — no abrimos si no existe.
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
    }
})

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
                            .then((res) => { if (res.ok) return cache.put(cleanUrl, res) })
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

    // ── 5. Stale While Revalidate: navegación HTML ─────────────────────────
    if (request.mode === 'navigate') {
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
    const cache  = await caches.open(SHELL_CACHE)
    const url    = new URL(request.url)
    const isWizardRoute = /^\/tecnico\/nuevo-reporte\/.+/.test(url.pathname)

    // Buscar hit exacto; si es ruta dinámica del wizard y no hay hit, usar shell canónico
    let cached = await cache.match(request, { ignoreVary: true })
    if (!cached && isWizardRoute) {
        cached = await cache.match(WIZARD_SHELL_KEY, { ignoreVary: true })
    }

    // Actualiza la caché en background — no se espera el resultado
    const revalidation = fetch(request, { credentials: 'include' })
        .then((response) => {
            if (response.ok && response.headers.get('Content-Type')?.includes('text/html')) {
                cache.put(request, response.clone())
                // Guardar copia canónica para que otros IDs funcionen offline
                if (isWizardRoute) cache.put(WIZARD_SHELL_KEY, response.clone())
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
