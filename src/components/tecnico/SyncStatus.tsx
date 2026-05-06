'use client'

import { Clock, CheckCircle2, Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'

function relative(d: Date) {
    const s = Math.floor((Date.now() - d.getTime()) / 1000)
    if (s < 10) return 'ahora mismo'
    if (s < 60) return `hace ${s}s`
    const m = Math.floor(s / 60)
    if (m < 60) return `hace ${m} min`
    return `hace ${Math.floor(m / 60)}h`
}

export default function SyncStatus() {
    const { pendingCount, lastSync, isSyncing, isOnline, sync } = useOfflineStatus()

    // Only render when there's something to show
    if (pendingCount === 0 && !lastSync) return null

    const Icon = isSyncing
        ? Loader2
        : pendingCount > 0
            ? AlertCircle
            : CheckCircle2

    const iconCls = isSyncing
        ? 'text-blue-600 animate-spin'
        : pendingCount > 0
            ? 'text-amber-500'
            : 'text-green-600'

    return (
        <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 shrink-0 ${iconCls}`} />
                <h2 className="text-sm font-semibold text-[#0F172A]">Sincronización offline</h2>
                {pendingCount > 0 && (
                    <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold px-1.5">
                        {pendingCount}
                    </span>
                )}
            </div>

            <p className="text-xs text-[#64748B]">
                {isSyncing
                    ? 'Enviando reportes al servidor…'
                    : pendingCount > 0
                        ? `${pendingCount} reporte${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''} de enviar al servidor.`
                        : 'Sin reportes pendientes.'}
            </p>

            {lastSync && (
                <p className="text-[10px] text-[#94A3B8] flex items-center gap-1 mt-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    Última sync exitosa: {relative(lastSync)}
                </p>
            )}

            {pendingCount > 0 && (
                <Button
                    size="sm"
                    onClick={sync}
                    disabled={isSyncing || !isOnline}
                    className="mt-3 w-full h-8 text-xs font-semibold bg-[#1E40AF] hover:bg-[#1E3A8A] text-white gap-1.5 disabled:opacity-50"
                >
                    {isSyncing ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sincronizando…</>
                    ) : (
                        <><RefreshCw className="h-3.5 w-3.5" /> Sincronizar ahora</>
                    )}
                </Button>
            )}
        </div>
    )
}
