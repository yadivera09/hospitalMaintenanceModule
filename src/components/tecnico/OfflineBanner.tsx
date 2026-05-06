'use client'

import { useEffect, useRef, useState } from 'react'
import { WifiOff, Loader2, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'
import { Button } from '@/components/ui/button'

export default function OfflineBanner() {
    const { isOnline, pendingCount, lastSync, isSyncing, sync } = useOfflineStatus()
    const [showGreen, setShowGreen] = useState(false)
    const lastSyncTsRef = useRef<number | null>(null)
    const greenTimer = useRef<ReturnType<typeof setTimeout>>()

    // Show green banner for 5 s whenever lastSync changes to a new timestamp
    useEffect(() => {
        if (!lastSync) return
        const ts = lastSync.getTime()
        if (ts === lastSyncTsRef.current) return
        lastSyncTsRef.current = ts
        setShowGreen(true)
        clearTimeout(greenTimer.current)
        greenTimer.current = setTimeout(() => setShowGreen(false), 5000)
        return () => clearTimeout(greenTimer.current)
    }, [lastSync])

    function relative(d: Date) {
        const s = Math.floor((Date.now() - d.getTime()) / 1000)
        if (s < 10) return 'ahora mismo'
        if (s < 60) return `hace ${s}s`
        const m = Math.floor(s / 60)
        if (m < 60) return `hace ${m} min`
        return `hace ${Math.floor(m / 60)}h`
    }

    // Priority: syncing > offline > online-with-pending > green > hidden
    if (isSyncing) {
        return (
            <div className="fixed top-14 left-0 right-0 z-30 bg-blue-600 text-white px-4 py-2.5 shadow-md animate-in slide-in-from-top duration-300" id="banner-syncing">
                <div className="flex items-center gap-2.5 max-w-lg mx-auto">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold leading-none">Sincronizando…</p>
                        <p className="text-[10px] text-blue-200 mt-0.5">Enviando reportes pendientes al servidor</p>
                    </div>
                </div>
            </div>
        )
    }

    if (!isOnline) {
        return (
            <div className="fixed top-14 left-0 right-0 z-30 bg-red-600 text-white px-4 py-2.5 shadow-md" id="banner-offline">
                <div className="flex items-center gap-2.5 max-w-lg mx-auto">
                    <WifiOff className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold leading-none">Sin conexión — Modo offline activo</p>
                        {pendingCount > 0 && (
                            <p className="text-[10px] text-red-200 mt-0.5">
                                {pendingCount} reporte{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de sincronización
                            </p>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    if (pendingCount > 0) {
        return (
            <div className="fixed top-14 left-0 right-0 z-30 bg-amber-500 text-white px-4 py-2 shadow-md animate-in slide-in-from-top duration-300" id="banner-pending">
                <div className="flex items-center gap-2.5 max-w-lg mx-auto">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p className="flex-1 min-w-0 text-xs font-semibold leading-none truncate">
                        {pendingCount} reporte{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de sincronización
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={sync}
                        className="h-7 text-[10px] font-semibold bg-white text-amber-700 hover:bg-amber-50 border-white shrink-0 gap-1 px-2.5"
                    >
                        <RefreshCw className="h-3 w-3" />
                        Sincronizar ahora
                    </Button>
                </div>
            </div>
        )
    }

    if (showGreen && lastSync) {
        return (
            <div className="fixed top-14 left-0 right-0 z-30 bg-green-600 text-white px-4 py-2.5 shadow-md animate-in slide-in-from-top duration-300" id="banner-synced">
                <div className="flex items-center gap-2.5 max-w-lg mx-auto">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold leading-none">Conectado — Todo sincronizado</p>
                        <p className="text-[10px] text-green-200 mt-0.5">Último sync: {relative(lastSync)}</p>
                    </div>
                </div>
            </div>
        )
    }

    return null
}
