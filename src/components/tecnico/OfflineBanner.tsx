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
            <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none" id="banner-syncing">
                <div className="bg-blue-600/95 backdrop-blur shadow-md text-white px-3 py-1.5 rounded-full flex items-center gap-2 pointer-events-auto">
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    <p className="text-[10px] font-semibold whitespace-nowrap">Sincronizando {pendingCount > 0 ? `(${pendingCount})` : ''}…</p>
                </div>
            </div>
        )
    }

    if (!isOnline) {
        return (
            <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none" id="banner-offline">
                <div className="bg-red-600/95 backdrop-blur shadow-md text-white px-3 py-1.5 rounded-full flex items-center gap-2 pointer-events-auto border border-red-500/50">
                    <WifiOff className="h-3.5 w-3.5 shrink-0" />
                    <p className="text-[10px] font-semibold whitespace-nowrap">Modo Offline</p>
                    {pendingCount > 0 && (
                        <span className="text-[10px] font-bold bg-white text-red-600 px-1.5 rounded-full">
                            {pendingCount}
                        </span>
                    )}
                </div>
            </div>
        )
    }

    if (pendingCount > 0) {
        return (
            <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in slide-in-from-top duration-300" id="banner-pending">
                <div className="bg-amber-500/95 backdrop-blur shadow-md text-white pl-3 pr-1 py-1 rounded-full flex items-center gap-2 pointer-events-auto border border-amber-400/50">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <p className="text-[10px] font-semibold whitespace-nowrap">
                        {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={sync}
                        className="h-6 rounded-full text-[10px] font-semibold bg-white text-amber-700 hover:bg-amber-50 border-transparent shrink-0 px-2"
                    >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Sincronizar
                    </Button>
                </div>
            </div>
        )
    }

    if (showGreen && lastSync) {
        return (
            <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in slide-in-from-top duration-300" id="banner-synced">
                <div className="bg-green-600/95 backdrop-blur shadow-md text-white px-3 py-1.5 rounded-full flex items-center gap-2 pointer-events-auto border border-green-500/50">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <p className="text-[10px] font-semibold whitespace-nowrap">Sincronizado</p>
                </div>
            </div>
        )
    }

    return null
}
