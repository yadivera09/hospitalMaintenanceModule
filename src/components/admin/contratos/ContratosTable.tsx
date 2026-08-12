'use client'

/**
 * src/components/admin/contratos/ContratosTable.tsx
 * Tabla de listado de contratos del panel administrador.
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
import type { Contrato, EstadoContrato } from '@/types'
import { computarEstadoContrato } from '@/types'

interface ContratosTableProps {
    contratos: Contrato[]
    onVerDetalle: (id: string) => void
    /** Omitir para ocultar la acción cuando el usuario no tiene permiso de editar */
    onEditar?: (contrato: Contrato) => void
    onDesactivar?: (contrato: Contrato) => Promise<{ error: string | null }>
    onDesactivarExito?: (id: string) => void
}

const ESTADO_CONFIG: Record<EstadoContrato, { label: string; className: string }> = {
    activo: {
        label: 'Activo',
        className: 'bg-ok-suave text-ok-tinta border border-ok-linea',
    },
    vencido: {
        label: 'Vencido',
        className: 'bg-critico-suave text-critico-tinta border border-critico-linea',
    },
    suspendido: {
        label: 'Suspendido',
        className: 'bg-aviso-suave text-aviso-tinta border border-aviso-linea',
    },
    cancelado: {
        label: 'Cancelado',
        className: 'bg-panel-suave text-tinta-tenue border border-borde',
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

export default function ContratosTable({
    contratos,
    onVerDetalle,
    onEditar,
    onDesactivar,
    onDesactivarExito,
}: ContratosTableProps) {
    if (contratos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm font-medium text-tinta-tenue">
                    No se encontraron contratos
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
                            Código
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-tinta-media uppercase tracking-wide py-3">
                            Cliente
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-tinta-media uppercase tracking-wide py-3 hidden md:table-cell">
                            Tipo
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-tinta-media uppercase tracking-wide py-3 hidden lg:table-cell">
                            Vigencia
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
                    {contratos.map((contrato) => {
                        const estado = computarEstadoContrato(contrato)
                        return (
                            <TableRow
                                key={contrato.id}
                                className="border-b border-borde hover:bg-panel-suave transition-colors"
                            >
                                {/* Código */}
                                <TableCell className="py-3.5 pl-4">
                                    <button
                                        onClick={() => onVerDetalle(contrato.id)}
                                        className="text-sm font-semibold font-mono text-marca-tinta hover:underline text-left"
                                    >
                                        {contrato.numero_contrato}
                                    </button>
                                </TableCell>

                                {/* Cliente + fechas en mobile */}
                                <TableCell className="py-3.5">
                                    <span className="text-sm text-tinta-media">
                                        {contrato.cliente?.razon_social ?? '—'}
                                    </span>
                                    <p className="mt-0.5 text-xs text-tinta-tenue lg:hidden">
                                        {formatFecha(contrato.fecha_inicio)}
                                        {' → '}
                                        {formatFecha(contrato.fecha_fin)}
                                    </p>
                                </TableCell>

                                {/* Tipo */}
                                <TableCell className="py-3.5 hidden md:table-cell">
                                    <span className="text-sm capitalize text-tinta-media">
                                        {contrato.tipo_contrato}
                                    </span>
                                </TableCell>

                                {/* Vigencia (fechas juntas) */}
                                <TableCell className="py-3.5 hidden lg:table-cell">
                                    <span className={`text-sm ${estado === 'vencido' ? 'text-critico-tinta' : 'text-tinta-media'}`}>
                                        {formatFecha(contrato.fecha_inicio)}
                                        {' → '}
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
                                        {onEditar && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onEditar(contrato)}
                                                className="h-8 w-8 p-0 text-tinta-tenue hover:text-aviso-tinta hover:bg-aviso-suave"
                                                aria-label={`Editar ${contrato.numero_contrato}`}
                                                title="Editar"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {onDesactivar && contrato.activo && (
                                            <DeleteButton
                                                nombreRegistro={contrato.numero_contrato}
                                                onDesactivar={() => onDesactivar(contrato)}
                                                onExito={() => onDesactivarExito?.(contrato.id)}
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
