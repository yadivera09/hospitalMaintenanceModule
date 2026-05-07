'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { contarPendientesSyncQueue } from '@/lib/offline/db'
import { sincronizarReportesPendientes } from '@/lib/offline/sync'

export interface OfflineStatus {
    isOnline: boolean
    pendingCount: number
    lastSync: Date | null
    isSyncing: boolean
    sync: () => Promise<void>
}

export function useOfflineStatus(): OfflineStatus {
    const [isOnline, setIsOnline] = useState<boolean>(
        typeof navigator !== 'undefined' ? navigator.onLine : true,
    )
    const [pendingCount, setPendingCount] = useState(0)
    const [lastSync, setLastSync] = useState<Date | null>(null)
    const [isSyncing, setIsSyncing] = useState(false)
    const syncingRef = useRef(false)

    const refreshPendingCount = useCallback(async () => {
        try {
            const count = await contarPendientesSyncQueue()
            setPendingCount(count)
        } catch {
            // IndexedDB no disponible (SSR o primer render)
        }
    }, [])

    const sync = useCallback(async () => {
        if (syncingRef.current || !navigator.onLine) return
        syncingRef.current = true
        setIsSyncing(true)
        try {
            await sincronizarReportesPendientes()
            setLastSync(new Date())
            await refreshPendingCount()
        } catch (err) {
            console.error('[useOfflineStatus] Error en sync:', err)
        } finally {
            syncingRef.current = false
            setIsSyncing(false)
        }
    }, [refreshPendingCount])

    useEffect(() => {
        // Sync after hydration: SSR renders isOnline=true (no navigator), client may be offline
        setIsOnline(navigator.onLine)
        refreshPendingCount()

        function handleOnline() {
            setIsOnline(true)
            // Auto-sincronizar al reconectar
            sync()
        }

        function handleOffline() {
            setIsOnline(false)
            refreshPendingCount()
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [sync, refreshPendingCount])

    return { isOnline, pendingCount, lastSync, isSyncing, sync }
}
