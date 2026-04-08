'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ESTADO_REPORTE_CFG } from '@/components/admin/reportes/ReportesTable'
import type { EstadoReporte } from '@/types'

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

export default function MisReportesClient({ iniciales }: { iniciales: ReporteData[] }) {
    const router = useRouter()
    const [filtro, setFiltro] = useState<FiltroEstado>('todos')

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
