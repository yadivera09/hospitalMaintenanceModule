'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    ClipboardList, AlertCircle, Clock,
    CheckCircle2, ChevronRight, Wifi, WifiOff, Plus,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ESTADO_REPORTE_CFG } from '@/components/admin/reportes/ReportesTable'

const TEC_NOMBRE = 'Técnico' // Puedes pasarlo desde el server para ser dinámico

function abreviarId(uuid: string) {
    if (!uuid) return ''
    const parts = uuid.split('-')
    return parts[parts.length - 1].substring(0, 6).toUpperCase()
}

function esHoy(iso: string) {
    const hoy = new Date()
    const d = new Date(iso)
    return d.getFullYear() === hoy.getFullYear()
        && d.getMonth() === hoy.getMonth()
        && d.getDate() === hoy.getDate()
}

function useConnectivity() {
    const [online, setOnline] = useState(true)
    useEffect(() => {
        setOnline(navigator.onLine)
        const on = () => setOnline(true)
        const off = () => setOnline(false)
        window.addEventListener('online', on)
        window.addEventListener('offline', off)
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
    }, [])
    return online
}

function DashCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`rounded-xl border border-[#E2E8F0] bg-white shadow-sm p-4 ${className}`}>
            {children}
        </div>
    )
}

export default function DashboardClient({ reportes, nombreTecnico }: { reportes: any[], nombreTecnico?: string }) {
    const router = useRouter()
    const online = useConnectivity()

    const reportesEnProgreso = reportes.filter((r) => r.estado_reporte === 'en_progreso')
    const pendientesCliente = reportes.filter((r) => r.estado_reporte === 'pendiente_firma_cliente')
    const reportesHoy = reportes.filter((r) => esHoy(r.fecha_inicio))

    const hora = new Date().getHours()
    const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches'
    const fname = nombreTecnico || TEC_NOMBRE

    return (
        <div className="space-y-4">
            {/* Saludo */}
            <div>
                <h1 className="text-xl font-bold text-[#0F172A]">{saludo}, {fname} 👋</h1>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                    {new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
            </div>

            {/* Indicador de conectividad */}
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium
        ${online ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {online
                    ? <><Wifi className="h-3.5 w-3.5" /> <span>En línea</span></>
                    : <><WifiOff className="h-3.5 w-3.5" /> <span>Sin conexión — modo offline activo</span></>
                }
            </div>

            {/* Card: Reportes en progreso */}
            <DashCard>
                <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-4 w-4 text-[#1E40AF]" />
                    <h2 className="text-sm font-semibold text-[#0F172A]">Reportes en progreso</h2>
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-50 text-[#1E40AF] text-xs font-bold px-1.5">
                        {reportesEnProgreso.length}
                    </span>
                </div>
                {reportesEnProgreso.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-[#94A3B8] py-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Sin reportes en progreso ✓
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 pr-1">
                        {reportesEnProgreso.map((r) => (
                            <button key={r.id} onClick={() => router.push(`/tecnico/mis-reportes/${r.id}`)}
                                className="w-full flex items-center justify-between gap-3 rounded-lg bg-blue-50/50 border border-blue-100 px-3 py-2.5 hover:bg-blue-100/50 transition-colors">
                                <div className="text-left min-w-0">
                                    <p className="text-xs font-mono font-bold text-[#1E40AF]">{r.numero_reporte_fisico ?? `#${abreviarId(r.id)}`}</p>
                                    <p className="text-xs text-[#334155] truncate">{r.equipo?.codigo_mh} · {r.equipo?.nombre}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <Badge className="text-[10px] bg-white text-[#1E40AF] border border-[#1E40AF]/20 px-1.5 py-0.5">
                                        Continuar
                                    </Badge>
                                    <ChevronRight className="h-3.5 w-3.5 text-[#94A3B8]" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </DashCard>

            {/* Card: Pendientes de firma del cliente */}
            <DashCard>
                <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <h2 className="text-sm font-semibold text-[#0F172A]">Esperando firma del cliente</h2>
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-100 text-orange-700 text-xs font-bold px-1.5">
                        {pendientesCliente.length}
                    </span>
                </div>
                {pendientesCliente.length === 0 ? (
                    <p className="text-xs text-[#94A3B8]">Sin reportes en esta etapa</p>
                ) : (
                    <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 pr-1">
                        {pendientesCliente.map((r) => (
                            <button key={r.id} onClick={() => router.push(`/tecnico/mis-reportes/${r.id}`)}
                                className="w-full flex items-center justify-between rounded-lg bg-orange-50 border border-orange-100 px-3 py-2.5 hover:bg-orange-100 transition-colors">
                                <div className="text-left min-w-0">
                                    <p className="text-xs font-mono font-bold text-[#1E40AF]">{r.numero_reporte_fisico ?? `#${abreviarId(r.id)}`}</p>
                                    <p className="text-xs text-[#334155] truncate">{r.equipo?.codigo_mh} · {r.cliente_nombre}</p>
                                </div>
                                <ChevronRight className="h-3.5 w-3.5 text-[#94A3B8] shrink-0" />
                            </button>
                        ))}
                    </div>
                )}
            </DashCard>

            <Button onClick={() => router.push('/tecnico/nuevo-reporte')}
                className="w-full bg-[#1E40AF] hover:bg-[#1E3A8A] text-white gap-2 h-12 text-sm font-semibold rounded-xl shadow-sm">
                <Plus className="h-5 w-5" /> Crear nuevo reporte
            </Button>
        </div>
    )
}
