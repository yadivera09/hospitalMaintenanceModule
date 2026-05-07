'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, AlertTriangle, Loader2, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ESTADO_REPORTE_CFG } from '@/components/admin/reportes/ReportesTable'
import type { EstadoReporte } from '@/types'
import { getReportesBorrador, type ReporteBorrador, type EstadoSync } from '@/lib/offline/db'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'

// Reutilizamos abreviarId del mock para no romper, o creamos logica propia
function abreviarId(uuid: string) {
    if (!uuid) return ''
    const parts = uuid.split('-')
    return parts[parts.length - 1].substring(0, 6).toUpperCase()
}

type FiltroEstado = EstadoReporte | 'todos'

const ESTADOS_TECNICOS: EstadoReporte[] = [
    'en_progreso',
    'pendiente_firma_cliente',
    'cerrado',
    'anulado',
]

interface ReporteData {
    id: string
    estado_reporte: EstadoReporte
    fecha_inicio: string
    numero_reporte_fisico?: string | null
    equipo?: { codigo_mh: string; nombre: string; marca: string }
    tipo?: { nombre: string }
}

const SYNC_BADGE: Record<Exclude<EstadoSync, 'sincronizado'>, { label: string; cls: string; Icon: React.ElementType }> = {
    borrador_local: { label: 'Borrador local',       cls: 'bg-slate-100  text-slate-700  border-slate-200',  Icon: Clock },
    pendiente_sync: { label: 'Pendiente sync',       cls: 'bg-yellow-100 text-yellow-700 border-yellow-200', Icon: Clock },
    sincronizando:  { label: 'Sincronizando…',       cls: 'bg-blue-100   text-blue-700   border-blue-200',   Icon: Loader2 },
    error_sync:     { label: 'Error al sincronizar', cls: 'bg-red-100    text-red-700    border-red-200',    Icon: AlertTriangle },
}

export default function MisReportesClient({ iniciales }: { iniciales: ReporteData[] }) {
    const router = useRouter()
    const [filtro, setFiltro] = useState<FiltroEstado>('todos')
    const [offline, setOffline] = useState<ReporteBorrador[]>([])
    const { sync, isSyncing, isOnline } = useOfflineStatus()

    useEffect(() => {
        getReportesBorrador()
            .then(all => setOffline(all.filter(r => r.estado !== 'sincronizado')))
            .catch(() => {})
    }, [isSyncing])

    const misReportes = iniciales

    const conteos = useMemo(() => {
        const base: Record<string, number> = {
            'en_progreso': 0, 
            'pendiente_firma_cliente': 0, 
            'cerrado': 0, 
            'anulado': 0,
        }
        misReportes.forEach((r) => {
            if (base[r.estado_reporte] !== undefined) {
                base[r.estado_reporte]++
            }
        })
        return base
    }, [misReportes])

    const filtrados = useMemo(() => {
        if (filtro === 'todos') return misReportes
        return misReportes.filter((r) => r.estado_reporte === filtro)
    }, [misReportes, filtro])

    return (
        <div className="space-y-4">
            {/* Chips de filtro */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setFiltro('todos')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
            bg-[#1E40AF] text-white border-transparent
            ${filtro === 'todos' ? 'ring-2 ring-[#1E40AF] ring-offset-1 scale-105' : 'opacity-70 hover:opacity-100'}`}
                >
                    Todos {misReportes.length}
                </button>
                {ESTADOS_TECNICOS.map((e) => {
                    let cfg = { ...ESTADO_REPORTE_CFG[e] }
                    if (!cfg) return null
                    
                    return (
                        <button key={e} onClick={() => setFiltro(filtro === e ? 'todos' : e)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${cfg.className}
                ${filtro === e ? 'ring-2 ring-offset-1 ring-current scale-105' : 'opacity-60 hover:opacity-100'}`}>
                            {cfg.label} {conteos[e]}
                        </button>
                    )
                })}
            </div>

            {/* Reportes offline pendientes de sync */}
            {offline.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8] px-1">
                        Guardados localmente · pendientes de sync
                    </p>
                    {offline.map((r) => {
                        const cfg = SYNC_BADGE[r.estado as Exclude<EstadoSync, 'sincronizado'>]
                        if (!cfg) return null
                        const { label, cls, Icon } = cfg
                        return (
                            <div key={r.id} className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm px-4 py-3.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <span className="text-xs font-mono font-bold text-[#94A3B8] tracking-widest">
                                            #{r.id.slice(-8).toUpperCase()}
                                        </span>
                                        <p className="text-xs text-[#64748B] mt-0.5">
                                            {new Date(r.fecha_inicio).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                        {r.motivo_error && (
                                            <p className="text-[10px] text-red-500 mt-0.5 truncate">{r.motivo_error}</p>
                                        )}
                                    </div>
                                    <Badge className={`text-[10px] font-medium px-2 py-0.5 rounded-sm whitespace-nowrap shrink-0 border flex items-center gap-1 ${cls}`}>
                                        <Icon className={`h-3 w-3 ${r.estado === 'sincronizando' ? 'animate-spin' : ''}`} />
                                        {label}
                                    </Badge>
                                </div>
                                {r.estado === 'error_sync' && (
                                    <button
                                        onClick={sync}
                                        disabled={isSyncing || !isOnline}
                                        className="mt-2 text-[10px] font-semibold text-[#1E40AF] hover:underline disabled:opacity-40 disabled:no-underline"
                                    >
                                        Reintentar
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Lista */}
            <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 pr-2 pb-10">
                {filtrados.length === 0 ? (
                    <div className="flex flex-col items-center py-12 text-center rounded-xl border border-dashed border-[#E2E8F0]">
                        <ClipboardList className="h-8 w-8 text-[#E2E8F0] mb-2" />
                        <p className="text-sm text-[#94A3B8]">Sin reportes en este estado</p>
                    </div>
                ) : filtrados.map((r) => {
                    const cfg = ESTADO_REPORTE_CFG[r.estado_reporte]
                    const fecha = new Date(r.fecha_inicio).toLocaleDateString('es-EC', {
                        day: '2-digit', month: 'short', year: 'numeric',
                    })
                    return (
                        <button key={r.id} onClick={() => router.push(`/tecnico/mis-reportes/${r.id}`)}
                            className="w-full text-left rounded-xl border border-[#E2E8F0] bg-white shadow-sm px-4 py-3.5 hover:border-[#1E40AF]/30 hover:shadow-md transition-all">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <span className="text-xs font-mono font-bold text-[#1E40AF] tracking-widest">
                                        {r.numero_reporte_fisico ?? `#${abreviarId(r.id)}`}
                                    </span>
                                    <p className="text-sm font-semibold text-[#0F172A] leading-tight mt-0.5">{r.equipo?.nombre}</p>
                                    <p className="text-xs text-[#94A3B8] mt-0.5">
                                        {r.equipo?.codigo_mh} · {r.tipo?.nombre} · {fecha}
                                    </p>
                                </div>
                                {cfg && (
                                    <Badge className={`text-[10px] font-medium px-2 py-0.5 rounded-sm whitespace-nowrap shrink-0 ${cfg.className}`}>
                                        {cfg.label}
                                    </Badge>
                                )}
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
