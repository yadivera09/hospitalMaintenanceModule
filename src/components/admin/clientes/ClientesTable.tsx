'use client'

/**
 * src/components/admin/clientes/ClientesTable.tsx
 * Tabla de listado de clientes del panel administrador.
 * Props tipadas con el tipo Cliente de src/types/index.ts.
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
import type { Cliente } from '@/types'

// =============================================================================
// TIPOS
// =============================================================================

interface ClientesTableProps {
    clientes: Cliente[]
    onVerDetalle: (id: string) => void
    onEditar: (cliente: Cliente) => void
}

// =============================================================================
// HELPERS
// =============================================================================

/** Trunca texto largo para la columna de dirección */
function truncar(texto: string | null, max = 40): string {
    if (!texto) return '—'
    return texto.length > max ? `${texto.slice(0, max)}…` : texto
}

// =============================================================================
// COMPONENTE
// =============================================================================

export default function ClientesTable({
    clientes,
    onVerDetalle,
    onEditar,
}: ClientesTableProps) {
    if (clientes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm font-medium text-[#94A3B8]">
                    No se encontraron clientes
                </p>
                <p className="mt-1 text-xs text-[#94A3B8]">
                    Intenta ajustar el filtro de búsqueda.
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
                            Cliente
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3">
                            RUC
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 hidden md:table-cell">
                            Teléfono
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 hidden lg:table-cell">
                            Email
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
                    {clientes.map((cliente) => (
                        <TableRow
                            key={cliente.id}
                            className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
                        >
                            {/* Nombre */}
                            <TableCell className="py-3.5 pl-4">
                                <button
                                    onClick={() => onVerDetalle(cliente.id)}
                                    className="text-sm font-semibold text-[#0F172A] hover:text-[#1E40AF] transition-colors text-left"
                                >
                                    {cliente.razon_social}
                                </button>
                                {/* Dirección visible en xs */}
                                <p className="mt-0.5 text-xs text-[#94A3B8] lg:hidden">
                                    {truncar(cliente.direccion, 35)}
                                </p>
                            </TableCell>

                            {/* RUC */}
                            <TableCell className="py-3.5">
                                <span className="text-sm font-mono text-[#334155]">
                                    {cliente.ruc ?? '—'}
                                </span>
                            </TableCell>

                            {/* Teléfono */}
                            <TableCell className="py-3.5 hidden md:table-cell">
                                <span className="text-sm text-[#334155]">
                                    {cliente.telefono ?? '—'}
                                </span>
                            </TableCell>

                            {/* Email */}
                            <TableCell className="py-3.5 hidden lg:table-cell">
                                <span className="text-sm text-[#334155]">
                                    {cliente.email ?? '—'}
                                </span>
                            </TableCell>

                            {/* Estado */}
                            <TableCell className="py-3.5">
                                {cliente.activo ? (
                                    <Badge className="bg-green-50 text-green-700 border border-green-200 text-xs font-medium px-2 py-0.5 rounded-sm">
                                        Activo
                                    </Badge>
                                ) : (
                                    <Badge className="bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0] text-xs font-medium px-2 py-0.5 rounded-sm">
                                        Inactivo
                                    </Badge>
                                )}
                            </TableCell>

                            {/* Acciones */}
                            <TableCell className="py-3.5 pr-4">
                                <div className="flex items-center justify-end gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onVerDetalle(cliente.id)}
                                        className="h-8 w-8 p-0 text-[#94A3B8] hover:text-[#1E40AF] hover:bg-blue-50"
                                        aria-label={`Ver detalle de ${cliente.razon_social}`}
                                        title="Ver detalle"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onEditar(cliente)}
                                        className="h-8 w-8 p-0 text-[#94A3B8] hover:text-[#D97706] hover:bg-amber-50"
                                        aria-label={`Editar ${cliente.razon_social}`}
                                        title="Editar"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
