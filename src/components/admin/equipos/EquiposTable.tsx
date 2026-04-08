'use client'

/**
 * src/components/admin/equipos/EquiposTable.tsx
 * Tabla de listado de equipos del panel administrador.
 * La columna "Cliente actual" refleja el contrato vigente del equipo.
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
import { computarEstadoEquipo } from '@/types'
import type { EquipoConCliente } from '@/app/actions/equipos'
import type { EstadoEquipo } from '@/types'

// =============================================================================
// TIPOS
// =============================================================================

interface EquiposTableProps {
    equipos: EquipoConCliente[]
    onVerDetalle: (id: string) => void
    onEditar: (equipo: EquipoConCliente) => void
}

// =============================================================================
// HELPERS — badge de estado
// =============================================================================

const ESTADO_CONFIG: Record<EstadoEquipo, { label: string; className: string }> = {
    activo: {
        label: 'Activo',
        className: 'bg-green-50 text-green-700 border border-green-200',
    },
    almacenado: {
        label: 'Almacenado',
        className: 'bg-blue-50 text-blue-700 border border-blue-200',
    },
    baja: {
        label: 'Baja',
        className: 'bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0]',
    },
}

function BadgeEstado({ estado }: { estado: EstadoEquipo }) {
    const cfg = ESTADO_CONFIG[estado]
    return (
        <Badge className={`text-xs font-medium px-2 py-0.5 rounded-sm ${cfg.className}`}>
            {cfg.label}
        </Badge>
    )
}

// =============================================================================
// COMPONENTE
// =============================================================================

export default function EquiposTable({
    equipos,
    onVerDetalle,
    onEditar,
}: EquiposTableProps) {
    if (equipos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm font-medium text-[#94A3B8]">
                    No se encontraron equipos
                </p>
                <p className="mt-1 text-xs text-[#94A3B8]">
                    Ajusta los filtros o el término de búsqueda.
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
                            Código MH
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3">
                            Equipo
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 hidden md:table-cell">
                            N° Serie
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 hidden md:table-cell">
                            Activo Fijo
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 hidden lg:table-cell">
                            Categoría
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 hidden lg:table-cell">
                            Cliente actual
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
                    {equipos.map((equipo) => {
                        const estado = computarEstadoEquipo(equipo)
                        const clienteNombre = equipo.cliente_nombre
                        const numeroContrato = equipo.numero_contrato

                        return (
                            <TableRow
                                key={equipo.id}
                                className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
                            >
                                {/* Código MH */}
                                <TableCell className="py-3.5 pl-4">
                                    <button
                                        onClick={() => onVerDetalle(equipo.id)}
                                        className="text-sm font-semibold font-mono text-[#1E40AF] hover:underline"
                                    >
                                        {equipo.codigo_mh}
                                    </button>
                                </TableCell>

                                {/* Nombre + Marca/Modelo */}
                                <TableCell className="py-3.5">
                                    <p className="text-sm font-medium text-[#0F172A]">{equipo.nombre}</p>
                                    <p className="text-xs text-[#94A3B8] mt-0.5">
                                        {[equipo.marca, equipo.modelo].filter(Boolean).join(' · ') || '—'}
                                    </p>
                                </TableCell>

                                {/* N° Serie */}
                                <TableCell className="py-3.5 hidden md:table-cell">
                                    <span className="text-sm font-mono text-[#334155]">
                                        {equipo.numero_serie ?? '—'}
                                    </span>
                                </TableCell>

                                {/* Activo Fijo */}
                                <TableCell className="py-3.5 hidden md:table-cell">
                                    <span className="text-sm font-mono text-[#334155]">
                                        {equipo.activo_fijo ?? '—'}
                                    </span>
                                </TableCell>

                                {/* Categoría */}
                                <TableCell className="py-3.5 hidden lg:table-cell">
                                    <span className="text-sm text-[#334155]">
                                        {equipo.categoria?.nombre ?? '—'}
                                    </span>
                                </TableCell>

                                {/* Cliente actual */}
                                <TableCell className="py-3.5 hidden lg:table-cell">
                                    {clienteNombre ? (
                                        <div>
                                            <p className="text-sm text-[#334155] font-medium truncate max-w-[160px]">
                                                {clienteNombre}
                                            </p>
                                            <p className="text-xs text-[#94A3B8] font-mono">
                                                {numeroContrato ?? ''}
                                            </p>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-[#94A3B8] italic">Sin asignación</span>
                                    )}
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
                                            onClick={() => onVerDetalle(equipo.id)}
                                            className="h-8 w-8 p-0 text-[#94A3B8] hover:text-[#1E40AF] hover:bg-blue-50"
                                            aria-label={`Ver detalle de ${equipo.codigo_mh}`}
                                            title="Ver detalle"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onEditar(equipo)}
                                            className="h-8 w-8 p-0 text-[#94A3B8] hover:text-[#D97706] hover:bg-amber-50"
                                            aria-label={`Editar ${equipo.codigo_mh}`}
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
