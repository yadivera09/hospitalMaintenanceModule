'use client'

import { useState, useMemo } from 'react'
import { ClipboardList, Search, Download } from 'lucide-react'
import { exportToExcel } from '@/lib/exportToExcel'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import ReportesTable, { ESTADO_REPORTE_CFG } from '@/components/admin/reportes/ReportesTable'
import type { EstadoReporte, ReporteResumen } from '@/types'

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------

type FiltroEstado = EstadoReporte | 'todos'

const ESTADOS_ORDEN: EstadoReporte[] = [
    'en_progreso',
    'pendiente_firma_cliente',
    'cerrado',
    'anulado',
]

// ---------------------------------------------------------------------------
// CHIP DE ESTADO
// ---------------------------------------------------------------------------

interface ChipEstadoProps {
    estado: EstadoReporte
    count: number
    activo: boolean
    onClick: () => void
}

function ChipEstado({ estado, count, activo, onClick }: ChipEstadoProps) {
    const cfg = ESTADO_REPORTE_CFG[estado]
    if (!cfg) return null
    return (
        <button
            onClick={onClick}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all
        ${activo
                    ? `${cfg.className} ring-2 ring-offset-1 ring-current scale-105`
                    : `${cfg.className} opacity-60 hover:opacity-100`
                }`}
        >
            <span>{cfg.label}</span>
            <span className={`flex h-4 w-5 items-center justify-center rounded-sm font-bold
        ${activo ? 'bg-current text-white' : 'bg-current/20'}`}>
                {count}
            </span>
        </button>
    )
}

// ---------------------------------------------------------------------------
// PROPS
// ---------------------------------------------------------------------------

interface ReportesAdminClientProps {
    reportes: ReporteResumen[]
    tipos: { id: string; nombre: string }[]
}

// ---------------------------------------------------------------------------
// COMPONENTE
// ---------------------------------------------------------------------------

export default function ReportesAdminClient({ reportes, tipos }: ReportesAdminClientProps) {
    const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
    const [filtroTipo, setFiltroTipo] = useState<string>('todos')
    const [busqueda, setBusqueda] = useState('')
    const [fechaDesde, setFechaDesde] = useState('')
    const [fechaHasta, setFechaHasta] = useState('')

    const conteoEstados = useMemo<Record<EstadoReporte, number>>(() => {
        const base: Record<EstadoReporte, number> = {
            en_progreso: 0,
            pendiente_firma_cliente: 0,
            cerrado: 0,
            anulado: 0,
        }
        reportes.forEach((r) => {
            if (r.estado_reporte in base) base[r.estado_reporte]++
        })
        return base
    }, [reportes])

    const reportesFiltrados = useMemo<ReporteResumen[]>(() => {
        const q = busqueda.trim().toLowerCase()
        return reportes.filter((r) => {
            const matchEstado = filtroEstado === 'todos' || r.estado_reporte === filtroEstado
            const matchTipo = filtroTipo === 'todos' || r.tipo_mantenimiento_id === filtroTipo
            const matchBusqueda = !q || r.equipo_codigo_mh.toLowerCase().includes(q)
            const fecha = new Date(r.fecha_inicio)
            const matchDesde = !fechaDesde || fecha >= new Date(fechaDesde)
            const matchHasta = !fechaHasta || fecha <= new Date(fechaHasta + 'T23:59:59')
            return matchEstado && matchTipo && matchBusqueda && matchDesde && matchHasta
        })
    }, [reportes, filtroEstado, filtroTipo, busqueda, fechaDesde, fechaHasta])

    function handleChipClick(estado: EstadoReporte) {
        setFiltroEstado((prev) => prev === estado ? 'todos' : estado)
    }

    function handleExportar() {
        exportToExcel(
            reportesFiltrados.map((r) => ({
                'Nº reporte físico':  r.numero_reporte_fisico ?? '',
                Equipo:              r.equipo_nombre,
                'Código MH':         r.equipo_codigo_mh,
                Cliente:             r.cliente_nombre,
                Técnico:             r.tecnico_nombre,
                'Tipo mantenimiento': r.tipo_nombre,
                'Fecha ejecución':   r.fecha_inicio
                    ? new Date(r.fecha_inicio).toLocaleDateString('es-EC')
                    : '',
                Estado:              r.estado_reporte,
            })),
            'reportes'
        )
    }

    return (
        <div className="space-y-6">
            {/* Encabezado */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E40AF]/10">
                        <ClipboardList className="h-5 w-5 text-[#1E40AF]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[#0F172A] leading-none">Reportes</h1>
                        <p className="text-sm text-[#94A3B8] mt-0.5">
                            {reportes.length} en total
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    onClick={handleExportar}
                    className="gap-2 border-[#1E40AF]/20 text-[#1E40AF] hover:bg-blue-50 shrink-0"
                    id="btn-exportar-reportes"
                >
                    <Download className="h-4 w-4" />
                    Exportar Excel
                </Button>
            </div>

            {/* Chips de conteo por estado */}
            <div className="flex flex-wrap gap-2 items-center">
                <button
                    onClick={() => setFiltroEstado('todos')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all
            bg-[#F1F5F9] text-[#334155] border-[#E2E8F0]
            ${filtroEstado === 'todos' ? 'ring-2 ring-[#334155] ring-offset-1' : 'opacity-60 hover:opacity-100'}`}>
                    Todos
                    <span className="flex h-4 w-5 items-center justify-center rounded-sm bg-[#334155]/20 font-bold">
                        {reportes.length}
                    </span>
                </button>
                {ESTADOS_ORDEN.map((estado) => (
                    <ChipEstado
                        key={estado}
                        estado={estado}
                        count={conteoEstados[estado]}
                        activo={filtroEstado === estado}
                        onClick={() => handleChipClick(estado)}
                    />
                ))}
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8] pointer-events-none" />
                    <Input
                        type="search"
                        placeholder="Código MH del equipo…"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="pl-9 bg-white border-[#E2E8F0]"
                    />
                </div>

                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                    <SelectTrigger className="bg-white border-[#E2E8F0]">
                        <SelectValue placeholder="Todos los tipos" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos los tipos</SelectItem>
                        {tipos.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="relative">
                    <label className="absolute -top-2 left-2 bg-white px-1 text-[10px] text-[#94A3B8] font-medium z-10">
                        Desde
                    </label>
                    <Input
                        type="date"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                        className="bg-white border-[#E2E8F0] text-[#334155]"
                    />
                </div>

                <div className="relative">
                    <label className="absolute -top-2 left-2 bg-white px-1 text-[10px] text-[#94A3B8] font-medium z-10">
                        Hasta
                    </label>
                    <Input
                        type="date"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                        className="bg-white border-[#E2E8F0] text-[#334155]"
                    />
                </div>
            </div>

            {/* Tabla */}
            <ReportesTable reportes={reportesFiltrados} />
        </div>
    )
}
