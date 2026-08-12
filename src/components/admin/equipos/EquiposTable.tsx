'use client'

/**
 * src/components/admin/equipos/EquiposTable.tsx
 * Tabla de listado de equipos del panel administrador.
 * Siguiendo el estándar de ClientesTable.
 */

import { Pencil } from 'lucide-react'
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
import DeleteButton from '@/components/admin/shared/DeleteButton'
import { computarEstadoEquipo } from '@/types'
import type { EquipoConCliente } from '@/app/actions/equipos'
import type { EstadoEquipo } from '@/types'

interface EquiposTableProps {
    equipos: EquipoConCliente[]
    onVerDetalle: (id: string) => void
    /** Omitir para ocultar la acción cuando el usuario no tiene permiso de editar */
    onEditar?: (equipo: EquipoConCliente) => void
    onDesactivar?: (equipo: EquipoConCliente) => Promise<{ error: string | null }>
    onDesactivarExito?: (id: string) => void
}

const ESTADO_CONFIG: Record<EstadoEquipo, { label: string; className: string }> = {
    activo: {
        label: 'Activo',
        className: 'bg-ok-suave text-ok-tinta border border-ok-linea',
    },
    almacenado: {
        label: 'Almacenado',
        className: 'bg-marca-suave text-marca-tinta border border-marca-linea',
    },
    baja: {
        label: 'Baja',
        className: 'bg-panel-suave text-tinta-tenue border border-borde',
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

export default function EquiposTable({
    equipos,
    onVerDetalle,
    onEditar,
    onDesactivar,
    onDesactivarExito,
}: EquiposTableProps) {
    if (equipos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm font-medium text-tinta-tenue">
                    No se encontraron equipos
                </p>
                <p className="mt-1 text-xs text-tinta-tenue">
                    Intenta ajustar los filtros de búsqueda.
                </p>
            </div>
        )
    }

    return (
        <div className="w-full overflow-x-auto rounded-lg border border-borde">
            <Table>
                <TableHeader>
                    <TableRow className="bg-panel-suave hover:bg-panel-suave">
                        <TableHead className="text-xs font-semibold text-tinta-media uppercase tracking-wide py-3 pl-4">
                            Código MH
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-tinta-media uppercase tracking-wide py-3">
                            Equipo
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-tinta-media uppercase tracking-wide py-3 hidden md:table-cell">
                            N° Serie
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-tinta-media uppercase tracking-wide py-3 hidden lg:table-cell">
                            Categoría
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-tinta-media uppercase tracking-wide py-3 hidden xl:table-cell">
                            Cliente
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-tinta-media uppercase tracking-wide py-3">
                            Estado
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-tinta-media uppercase tracking-wide py-3 text-right pr-4">
                            Acciones
                        </TableHead>
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {equipos.map((equipo) => {
                        const estado = computarEstadoEquipo(equipo)
                        return (
                            <TableRow
                                key={equipo.id}
                                className="border-b border-borde hover:bg-panel-suave transition-colors"
                            >
                                {/* Código MH */}
                                <TableCell className="py-3.5 pl-4">
                                    <button
                                        onClick={() => onVerDetalle(equipo.id)}
                                        className="text-sm font-semibold font-mono text-marca-tinta hover:underline text-left"
                                    >
                                        {equipo.codigo_mh}
                                    </button>
                                    {/* Marca/Modelo visible en mobile */}
                                    <p className="mt-0.5 text-xs text-tinta-tenue md:hidden">
                                        {[equipo.marca, equipo.modelo].filter(Boolean).join(' · ') || '—'}
                                    </p>
                                </TableCell>

                                {/* Equipo (nombre + marca/modelo) */}
                                <TableCell className="py-3.5">
                                    <p className="text-sm font-medium text-tinta">{equipo.nombre}</p>
                                    <p className="text-xs text-tinta-tenue mt-0.5 hidden md:block">
                                        {[equipo.marca, equipo.modelo].filter(Boolean).join(' · ') || '—'}
                                    </p>
                                </TableCell>

                                {/* N° Serie */}
                                <TableCell className="py-3.5 hidden md:table-cell">
                                    <span className="text-sm font-mono text-tinta-media">
                                        {equipo.numero_serie ?? '—'}
                                    </span>
                                </TableCell>

                                {/* Categoría */}
                                <TableCell className="py-3.5 hidden lg:table-cell">
                                    <span className="text-sm text-tinta-media">
                                        {equipo.categoria?.nombre ?? '—'}
                                    </span>
                                </TableCell>

                                {/* Cliente */}
                                <TableCell className="py-3.5 hidden xl:table-cell">
                                    <span className="text-sm text-tinta-media">
                                        {equipo.cliente_nombre ?? '—'}
                                    </span>
                                    {equipo.numero_contrato && (
                                        <p className="text-xs text-tinta-tenue font-mono mt-0.5">
                                            {equipo.numero_contrato}
                                        </p>
                                    )}
                                </TableCell>

                                {/* Estado */}
                                <TableCell className="py-3.5">
                                    <BadgeEstado estado={estado} />
                                </TableCell>

                                {/* Acciones */}
                                <TableCell className="py-3.5 pr-4">
                                    <div className="flex items-center justify-end gap-1">
                                        {onEditar && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onEditar(equipo)}
                                                className="h-8 w-8 p-0 text-tinta-tenue hover:text-aviso-tinta hover:bg-aviso-suave"
                                                aria-label={`Editar ${equipo.codigo_mh}`}
                                                title="Editar"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {onDesactivar && equipo.activo && (
                                            <DeleteButton
                                                nombreRegistro={`${equipo.codigo_mh} – ${equipo.nombre}`}
                                                onDesactivar={() => onDesactivar(equipo)}
                                                onExito={() => onDesactivarExito?.(equipo.id)}
                                            />
                                        )}
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
