/**
 * src/lib/offline/auto-sync.ts
 *
 * Motor de sincronización automática: decide CUÁNDO se sube la cola.
 * El CÓMO sigue en sync.ts, que es quien habla con /api/sync.
 *
 * EL PROBLEMA QUE RESUELVE
 *   El único disparador automático era el evento 'online' del navegador. Ese
 *   evento solo se emite al CAMBIAR de estado, así que el caso más común en
 *   campo —el técnico llega a la oficina, abre la app y ya hay WiFi— no
 *   disparaba nada: al montar se contaba la cola y ahí se quedaba. Los reportes
 *   esperaban a que alguien pulsara "Sincronizar ahora", y por eso siempre
 *   parecía quedar algo pendiente.
 *
 *   Además, un fallo dejaba el reporte en 'error_sync' sin ningún reintento: un
 *   microcorte bastaba para atascarlo hasta la próxima reconexión manual.
 *
 * POR QUÉ ES UN MÓDULO Y NO ESTÁ EN EL HOOK
 *   useOfflineStatus se usa en seis componentes a la vez. Con la lógica dentro
 *   del hook habría seis temporizadores compitiendo, seis reintentos por ciclo y
 *   seis contadores que se pisan. Aquí hay un solo motor y los hooks se
 *   suscriben a su estado.
 *
 * CUÁNDO SE INTENTA
 *   - al arrancar, si hay red y cola
 *   - al recuperar la conexión
 *   - al volver la pestaña a primer plano (el móvil del técnico pasa el día
 *     bloqueado; 'online' pudo dispararse con la pantalla apagada)
 *   - cuando el service worker avisa de que subió algo por su cuenta
 *   - con espera creciente mientras queden pendientes
 */

import { contarPendientesSyncQueue } from './db'
import { sincronizarReportesPendientes } from './sync'

// ─── Estado observable ────────────────────────────────────────────────────────

export interface EstadoSync {
    pendientes: number
    sincronizando: boolean
    ultimaSync: Date | null
    /** Motivo del último fallo, para poder mostrarlo en vez de callarlo. */
    ultimoError: string | null
}

let estado: EstadoSync = {
    pendientes: 0,
    sincronizando: false,
    ultimaSync: null,
    ultimoError: null,
}

type Oyente = (e: EstadoSync) => void
const oyentes = new Set<Oyente>()

function publicar(cambios: Partial<EstadoSync>) {
    estado = { ...estado, ...cambios }
    oyentes.forEach((o) => o(estado))
}

export function estadoActual(): EstadoSync {
    return estado
}

export function suscribirse(oyente: Oyente): () => void {
    oyentes.add(oyente)
    return () => { oyentes.delete(oyente) }
}

// ─── Espera creciente ─────────────────────────────────────────────────────────

/**
 * 15s, 30s, 1min, 2min, 4min y a partir de ahí cada 5.
 *
 * Empieza corto porque la causa más común es un microcorte que ya pasó, y
 * termina largo porque la segunda causa más común es un reporte que el servidor
 * rechaza por motivos de fondo — reintentarlo cada quince segundos durante toda
 * la jornada no lo arregla y sí gasta batería.
 */
const ESPERAS_MS = [15_000, 30_000, 60_000, 120_000, 240_000, 300_000]

let intento = 0
let temporizador: ReturnType<typeof setTimeout> | null = null

function cancelarReintento() {
    if (temporizador) {
        clearTimeout(temporizador)
        temporizador = null
    }
}

function programarReintento() {
    cancelarReintento()

    const espera = ESPERAS_MS[Math.min(intento, ESPERAS_MS.length - 1)]
    intento++

    temporizador = setTimeout(() => {
        temporizador = null
        intentarSync('reintento')
    }, espera)
}

// ─── Ciclo de sincronización ──────────────────────────────────────────────────

export async function refrescarPendientes(): Promise<number> {
    try {
        const n = await contarPendientesSyncQueue()
        publicar({ pendientes: n })
        return n
    } catch {
        // IndexedDB no disponible todavía (primer render, SSR).
        return estado.pendientes
    }
}

/**
 * Intenta vaciar la cola.
 *
 * No lanza nunca: quien llama es un evento del navegador o un temporizador, y
 * ahí una excepción no la recoge nadie.
 *
 * @param motivo - de dónde vino el intento; solo para depurar.
 */
export async function intentarSync(motivo: string): Promise<void> {
    if (typeof navigator === 'undefined') return
    if (estado.sincronizando) return

    if (!navigator.onLine) {
        // Sin red no se gasta un intento, pero tampoco se pierde la cuenta: en
        // cuanto vuelva la conexión el evento 'online' reactiva el ciclo.
        await refrescarPendientes()
        return
    }

    const pendientes = await refrescarPendientes()
    if (pendientes === 0) {
        cancelarReintento()
        intento = 0
        return
    }

    publicar({ sincronizando: true })

    try {
        const { sincronizados, errores } = await sincronizarReportesPendientes()

        const quedan = await refrescarPendientes()

        if (sincronizados > 0) {
            publicar({ ultimaSync: new Date() })
        }

        if (quedan === 0) {
            // Vaciada: se reinicia la escalera para que el próximo problema
            // vuelva a intentarse enseguida y no herede la espera larga.
            cancelarReintento()
            intento = 0
            publicar({ ultimoError: null })
            return
        }

        publicar({
            ultimoError: errores > 0
                ? `${errores} reporte${errores !== 1 ? 's' : ''} no se pudo enviar`
                : null,
        })

        programarReintento()
    } catch (err) {
        console.error(`[auto-sync] fallo del ciclo (${motivo}):`, err)
        publicar({ ultimoError: err instanceof Error ? err.message : 'error desconocido' })
        programarReintento()
    } finally {
        publicar({ sincronizando: false })
    }
}

/** Fuerza un intento inmediato, ignorando la espera pendiente. Lo usa el botón. */
export async function sincronizarAhora(): Promise<void> {
    cancelarReintento()
    intento = 0
    await intentarSync('manual')
}

// ─── Arranque ─────────────────────────────────────────────────────────────────

let iniciado = false

/**
 * Engancha los disparadores. Idempotente: la llaman los seis componentes que
 * usan el hook y solo el primero hace algo.
 */
export function iniciarAutoSync(): void {
    if (iniciado) return
    if (typeof window === 'undefined') return
    iniciado = true

    window.addEventListener('online', () => {
        intento = 0
        intentarSync('online')
    })

    window.addEventListener('offline', () => {
        cancelarReintento()
        refrescarPendientes()
    })

    // El móvil de un técnico pasa el día bloqueado. 'online' puede haberse
    // disparado con la pantalla apagada y la app suspendida, sin que el intento
    // llegara a completarse; al volver a mirar la pantalla hay que reintentar.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            intento = 0
            intentarSync('pestaña visible')
        }
    })

    // El service worker sube reportes por su cuenta con Background Sync y avisa
    // al terminar. Ese aviso no lo escuchaba nadie: la app seguía mostrando como
    // pendientes reportes que ya estaban en el servidor.
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (evento) => {
            if (evento.data?.type === 'SYNC_COMPLETED') {
                refrescarPendientes()
                publicar({ ultimaSync: new Date() })
            }
        })
    }

    // Y el arranque en frío, que es el caso que faltaba: app abierta con red y
    // cola pendiente, sin ninguna transición de conectividad de por medio.
    intentarSync('arranque')
}
