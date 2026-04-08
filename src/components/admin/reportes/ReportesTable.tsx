'use client'

/**
 * src/components/admin/reportes/ReportesTable.tsx
 * Tabla de reportes de mantenimiento.
 * Solo acción: Ver detalle (ojo).
 */

import { Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Table, TableBody, TableCell,
    TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { ReporteResumen } from '@/types'

type EstadoReporte = ReporteResumen['estado_reporte']

function abreviarId(id: string): string {
    return id.replace(/-/g, '').substring(0, 8).toUpperCase()
}

// =============================================================================
// Badge de estado — exportado para reusar en página de lista y detalle
// =============================================================================

export const ESTADO_REPORTE_CFG: Record<EstadoReporte, { label: string; className: string }> = {
    en_progreso: {
        label: 'En progreso',
        className: 'bg-blue-50 text-blue-700 border border-blue-200',
    },
    pendiente_firma_cliente: {
        label: 'Pte. firma cliente',
        className: 'bg-orange-50 text-orange-700 border border-orange-200',
    },
    cerrado: {
        label: 'Cerrado',
        className: 'bg-green-50 text-green-700 border border-green-200',
    },
    anulado: {
        label: 'Anulado',
        className: 'bg-red-100 text-red-600 border border-red-200',
    },
}

// =============================================================================
// TIPOS
// =============================================================================

interface ReportesTableProps {
    reportes: ReporteResumen[]
}

// =============================================================================
// COMPONENTE
// =============================================================================

export default function ReportesTable({ reportes }: ReportesTableProps) {
    const router = useRouter()

    return (
        <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC]">
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 pl-4">Código</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3">Equipo</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 hidden lg:table-cell">Cliente</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 hidden md:table-cell">Tipo</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 hidden sm:table-cell">Fecha ejecución</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 hidden xl:table-cell">Técnico</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3">Estado</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 text-right pr-4">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reportes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="py-14 text-center text-sm text-[#94A3B8]">
                                    No se encontraron reportes con esos criterios.
                                </TableCell>
                            </TableRow>
                        ) : reportes.map((r) => {
                            const cfg = ESTADO_REPORTE_CFG[r.estado_reporte] ?? {
                                label: r.estado_reporte,
                                className: 'bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]',
                            }
                            const fechaDisplay = new Date(r.fecha_inicio).toLocaleDateString('es-EC', {
                                day: '2-digit', month: 'short', year: 'numeric'
                            })
                            return (
                                <TableRow key={r.id} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">
                                    {/* Código */}
                                    <TableCell className="py-3.5 pl-4">
                                        <button onClick={() => router.push(`/admin/reportes/${r.id}`)}
                                            className="font-mono text-xs font-bold text-[#1E40AF] hover:underline tracking-widest">
                                            {r.numero_reporte_fisico ?? `#${abreviarId(r.id)}`}
                                        </button>
                                    </TableCell>
                                    {/* Equipo */}
                                    <TableCell className="py-3.5">
                                        <span className="text-xs font-mono font-semibold text-[#1E40AF]">{r.equipo_codigo_mh}</span>
                                        <p className="text-xs text-[#94A3B8] mt-0.5 truncate max-w-[140px]">{r.equipo_nombre}</p>
                                    </TableCell>
                                    {/* Cliente */}
                                    <TableCell className="py-3.5 hidden lg:table-cell">
                                        <span className="text-sm text-[#334155] whitespace-nowrap">{r.cliente_nombre}</span>
                                    </TableCell>
                                    {/* Tipo */}
                                    <TableCell className="py-3.5 hidden md:table-cell">
                                        <span className="text-sm text-[#334155]">{r.tipo_nombre}</span>
                                    </TableCell>
                                    {/* Fecha */}
                                    <TableCell className="py-3.5 hidden sm:table-cell">
                                        <span className="text-sm text-[#334155] whitespace-nowrap">{fechaDisplay}</span>
                                    </TableCell>
                                    {/* Técnico */}
                                    <TableCell className="py-3.5 hidden xl:table-cell">
                                        <span className="text-sm text-[#334155]">{r.tecnico_nombre}</span>
                                    </TableCell>
                                    {/* Estado */}
                                    <TableCell className="py-3.5">
                                        <Badge className={`text-xs font-medium px-2 py-0.5 rounded-sm whitespace-nowrap ${cfg.className}`}>
                                            {cfg.label}
                                        </Badge>
                                    </TableCell>
                                    {/* Acciones */}
                                    <TableCell className="py-3.5 pr-4 text-right">
                                        <Button variant="ghost" size="sm"
                                            onClick={() => router.push(`/admin/reportes/${r.id}`)}
                                            className="h-8 w-8 p-0 text-[#94A3B8] hover:text-[#1E40AF] hover:bg-blue-50"
                                            title="Ver detalle">
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
            <div className="px-4 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC]">
                <p className="text-xs text-[#94A3B8]">
                    Mostrando {reportes.length} reporte{reportes.length !== 1 ? 's' : ''}
                </p>
            </div>
        </div>
    )
}
