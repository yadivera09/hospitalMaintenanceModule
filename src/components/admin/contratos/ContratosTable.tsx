'use client'

/**
 * src/components/admin/contratos/ContratosTable.tsx
 * Tabla de listado de contratos del panel administrador.
 * Props tipadas con tipos de src/types/index.ts.
 * Solo renderizado — sin lógica de negocio.
 */

import { Eye, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import type { Contrato, EstadoContrato } from '@/types'
import { computarEstadoContrato } from '@/types'

// =============================================================================
// TIPOS
// =============================================================================

interface ContratosTableProps {
    contratos: Contrato[]
    onVerDetalle: (id: string) => void
    onEditar: (contrato: Contrato) => void
}

// =============================================================================
// HELPERS — badge de estado
// =============================================================================

const ESTADO_CONFIG: Record<
    EstadoContrato,
    { label: string; className: string }
> = {
    activo: {
        label: 'Activo',
        className: 'bg-green-50 text-green-700 border border-green-200',
    },
    vencido: {
        label: 'Vencido',
        className: 'bg-red-50 text-red-700 border border-red-200',
    },
    suspendido: {
        label: 'Suspendido',
        className: 'bg-amber-50 text-amber-700 border border-amber-200',
    },
    cancelado: {
        label: 'Cancelado',
        className: 'bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0]',
    },
}

function BadgeEstado({ estado }: { estado: EstadoContrato }) {
    const cfg = ESTADO_CONFIG[estado]
    return (
        <Badge className={`text-xs font-medium px-2 py-0.5 rounded-sm ${cfg.className}`}>
            {cfg.label}
        </Badge>
    )
}

function formatFecha(fecha: string | null): string {
    if (!fecha) return 'Indefinida'
    return new Date(fecha).toLocaleDateString('es-EC', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    })
}

// =============================================================================
// COMPONENTE
// =============================================================================

export default function ContratosTable({
    contratos,
    onVerDetalle,
    onEditar,
}: ContratosTableProps) {
    if (contratos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm font-medium text-[#94A3B8]">
                    No se encontraron contratos
                </p>
                <p className="mt-1 text-xs text-[#94A3B8]">
                    Ajusta los filtros de búsqueda o crea un nuevo contrato.
                </p>
            </div>
        )
    }

    return (
        <div className="w-full overflow-x-auto rounded-lg border border-[#E2E8F0]">
            <Table>
                <TableHeader>
                    <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC]">
                        <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 pl-4">
                            Código
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3">
                            Cliente
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 hidden md:table-cell">
                            Tipo
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 hidden lg:table-cell">
                            Fecha inicio
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 hidden lg:table-cell">
                            Fecha fin
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3">
                            Estado
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 text-right pr-4">
                            Acciones
                        </TableHead>
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {contratos.map((contrato) => {
                        const estado = computarEstadoContrato(contrato)
                        return (
                            <TableRow
                                key={contrato.id}
                                className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
                            >
                                {/* Código */}
                                <TableCell className="py-3.5 pl-4">
                                    <button
                                        onClick={() => onVerDetalle(contrato.id)}
                                        className="text-sm font-semibold font-mono text-[#1E40AF] hover:underline text-left"
                                    >
                                        {contrato.numero_contrato}
                                    </button>
                                </TableCell>

                                {/* Cliente */}
                                <TableCell className="py-3.5">
                                    <span className="text-sm text-[#334155]">
                                        {contrato.cliente?.razon_social ?? '—'}
                                    </span>
                                    {/* Fechas en móvil */}
                                    <p className="mt-0.5 text-xs text-[#94A3B8] lg:hidden">
                                        {formatFecha(contrato.fecha_inicio)}
                                        {' → '}
                                        {formatFecha(contrato.fecha_fin)}
                                    </p>
                                </TableCell>

                                {/* Tipo */}
                                <TableCell className="py-3.5 hidden md:table-cell">
                                    <span className="text-sm capitalize text-[#334155]">
                                        {contrato.tipo_contrato}
                                    </span>
                                </TableCell>

                                {/* Fecha inicio */}
                                <TableCell className="py-3.5 hidden lg:table-cell">
                                    <span className="text-sm text-[#334155]">
                                        {formatFecha(contrato.fecha_inicio)}
                                    </span>
                                </TableCell>

                                {/* Fecha fin */}
                                <TableCell className="py-3.5 hidden lg:table-cell">
                                    <span
                                        className={`text-sm ${estado === 'vencido'
                                                ? 'text-red-600 font-medium'
                                                : 'text-[#334155]'
                                            }`}
                                    >
                                        {formatFecha(contrato.fecha_fin)}
                                    </span>
                                </TableCell>

                                {/* Estado */}
                                <TableCell className="py-3.5">
                                    <BadgeEstado estado={estado} />
                                </TableCell>

                                {/* Acciones */}
                                <TableCell className="py-3.5 pr-4">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onVerDetalle(contrato.id)}
                                            className="h-8 w-8 p-0 text-[#94A3B8] hover:text-[#1E40AF] hover:bg-blue-50"
                                            aria-label={`Ver detalle de ${contrato.numero_contrato}`}
                                            title="Ver detalle"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onEditar(contrato)}
                                            className="h-8 w-8 p-0 text-[#94A3B8] hover:text-[#D97706] hover:bg-amber-50"
                                            aria-label={`Editar ${contrato.numero_contrato}`}
                                            title="Editar"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}
