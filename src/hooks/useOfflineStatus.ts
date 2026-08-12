'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    iniciarAutoSync,
    suscribirse,
    estadoActual,
    sincronizarAhora,
    refrescarPendientes,
} from '@/lib/offline/auto-sync'

export interface OfflineStatus {
    isOnline: boolean
    pendingCount: number
    lastSync: Date | null
    isSyncing: boolean
    /** Motivo del último fallo de envío, o null si todo fue bien. */
    syncError: string | null
    sync: () => Promise<void>
}

/**
 * Estado de la sincronización offline.
 *
 * La lógica vive en lib/offline/auto-sync.ts y este hook solo se suscribe. El
 * motivo es que seis componentes usan este hook a la vez: con los temporizadores
 * dentro, cada uno tendría los suyos y habría seis reintentos por ciclo pisándose
 * entre ellos.
 */
export function useOfflineStatus(): OfflineStatus {
    const [isOnline, setIsOnline] = useState<boolean>(
        typeof navigator !== 'undefined' ? navigator.onLine : true,
    )
    const [estado, setEstado] = useState(estadoActual)

    useEffect(() => {
        // Idempotente: solo el primer componente que monte engancha los eventos.
        iniciarAutoSync()

        const desuscribir = suscribirse(setEstado)

        // El estado pudo cambiar entre el primer render y la suscripción.
        setEstado(estadoActual())
        refrescarPendientes()

        function handleOnline() { setIsOnline(true) }
        function handleOffline() { setIsOnline(false) }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            desuscribir()
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    const sync = useCallback(async () => {
        await sincronizarAhora()
    }, [])

    return {
        isOnline,
        pendingCount: estado.pendientes,
        lastSync: estado.ultimaSync,
        isSyncing: estado.sincronizando,
        syncError: estado.ultimoError,
        sync,
    }
}
