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
        className: 'bg-marca-suave text-marca-tinta border border-marca-linea',
    },
    cerrado: {
        label: 'Cerrado',
        className: 'bg-ok-suave text-ok-tinta border border-ok-linea',
    },
    anulado: {
        label: 'Anulado',
        className: 'bg-critico-suave text-critico-tinta border border-critico-linea',
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
        <div className="rounded-xl bg-panel border border-borde shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-panel-suave hover:bg-panel-suave">
                            <TableHead className="text-xs font-semibold text-tinta-media uppercase tracking-wide py-3 pl-4">Código</TableHead>
                            <TableHead className="text-xs font-semibold text-tinta-media uppercase tracking-wide py-3">Equipo</TableHead>
                            <TableHead className="text-xs font-semibold text-tinta-media uppercase tracking-wide py-3 hidden lg:table-cell">Cliente</TableHead>
                            <TableHead className="text-xs font-semibold text-tinta-media uppercase tracking-wide py-3 hidden md:table-cell">Tipo</TableHead>
                            <TableHead className="text-xs font-semibold text-tinta-media uppercase tracking-wide py-3 hidden sm:table-cell">Fecha ejecución</TableHead>
                            <TableHead className="text-xs font-semibold text-tinta-media uppercase tracking-wide py-3 hidden xl:table-cell">Técnico</TableHead>
                            <TableHead className="text-xs font-semibold text-tinta-media uppercase tracking-wide py-3">Estado</TableHead>
                            <TableHead className="text-xs font-semibold text-tinta-media uppercase tracking-wide py-3 text-right pr-4">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reportes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="py-14 text-center text-sm text-tinta-tenue">
                                    No se encontraron reportes con esos criterios.
                                </TableCell>
                            </TableRow>
                        ) : reportes.map((r) => {
                            const cfg = ESTADO_REPORTE_CFG[r.estado_reporte] ?? {
                                label: r.estado_reporte,
                                className: 'bg-panel-suave text-tinta-media border border-borde',
                            }
                            const fechaDisplay = new Date(r.fecha_inicio).toLocaleDateString('es-EC', {
                                day: '2-digit', month: 'short', year: 'numeric'
                            })
                            return (
                                <TableRow key={r.id} className="border-b border-borde hover:bg-panel-suave transition-colors">
                                    {/* Código */}
                                    <TableCell className="py-3.5 pl-4">
                                        <button onClick={() => router.push(`/admin/reportes/${r.id}`)}
                                            className="font-mono text-xs font-bold text-marca-tinta hover:underline tracking-widest">
                                            {r.numero_reporte_fisico ?? `#${abreviarId(r.id)}`}
                                        </button>
                                    </TableCell>
                                    {/* Equipo */}
                                    <TableCell className="py-3.5">
                                        <span className="text-xs font-mono font-semibold text-marca-tinta">{r.equipo_codigo_mh}</span>
                                        <p className="text-xs text-tinta-tenue mt-0.5 truncate max-w-[140px]">{r.equipo_nombre}</p>
                                    </TableCell>
                                    {/* Cliente */}
                                    <TableCell className="py-3.5 hidden lg:table-cell">
                                        <span className="text-sm text-tinta-media whitespace-nowrap">{r.cliente_nombre}</span>
                                    </TableCell>
                                    {/* Tipo */}
                                    <TableCell className="py-3.5 hidden md:table-cell">
                                        <span className="text-sm text-tinta-media">{r.tipo_nombre}</span>
                                    </TableCell>
                                    {/* Fecha */}
                                    <TableCell className="py-3.5 hidden sm:table-cell">
                                        <span className="text-sm text-tinta-media whitespace-nowrap">{fechaDisplay}</span>
                                    </TableCell>
                                    {/* Técnico */}
                                    <TableCell className="py-3.5 hidden xl:table-cell">
                                        <span className="text-sm text-tinta-media">{r.tecnico_nombre}</span>
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
                                            className="h-8 w-8 p-0 text-tinta-tenue hover:text-marca-tinta hover:bg-marca-suave"
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
            <div className="px-4 py-3 border-t border-borde bg-panel-suave">
                <p className="text-xs text-tinta-tenue">
                    Mostrando {reportes.length} reporte{reportes.length !== 1 ? 's' : ''}
                </p>
            </div>
        </div>
    )
}
