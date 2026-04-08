'use client'

/**
 * src/app/(admin)/admin/equipos/[id]/page.tsx
 * Página de detalle de un equipo.
 * Incluye: ficha, contrato vigente, historial de contratos,
 * últimos mantenimientos (máx. 5) y modal placeholder de asignación.
 * BLOQUE 1 — Usa datos mock. Sin llamadas a Supabase.
 */

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft,
    Stethoscope,
    Pencil,
    Link2,
    CalendarDays,
    Hash,
    Tag,
    FileText,
    Building2,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    History,
    Wrench,
    MapPin,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import EquipoForm from '@/components/admin/equipos/EquipoForm'
import AsignarContratoModal from '@/components/admin/equipos/AsignarContratoModal'
import { computarEstadoEquipo } from '@/types'
import { updateEquipo } from '@/app/actions/equipos'
import type { Equipo, EstadoEquipo } from '@/types'
import type { EquipoFormValues } from '@/components/admin/equipos/EquipoForm'
import type { EquipoConCliente } from '@/app/actions/equipos'

interface Contrato { id: string; numero_contrato: string }
interface Ubicacion { id: string; nombre: string }
interface Categoria { id: string; nombre: string }
interface TipoMant { id: string; nombre: string }

interface Props {
    equipoInicial: EquipoConCliente & { historial_contratos: any[], mantenimientos: any[], historial_ubicaciones: any[] } | undefined
    errorInicial: string | null
    contratos: Contrato[]
    ubicaciones: Ubicacion[]
    categorias: Categoria[]
    tiposMantenimiento: TipoMant[]
}

// =============================================================================
// HELPERS
// =============================================================================

function formatFecha(fecha: string | null): string {
    if (!fecha) return '—'
    return new Date(fecha).toLocaleDateString('es-EC', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    })
}

function formatFechaHora(fecha: string | null): string {
    if (!fecha) return '—'
    return new Date(fecha).toLocaleDateString('es-EC', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    })
}

const ESTADO_BADGE: Record<EstadoEquipo, { label: string; className: string }> = {
    activo: { label: 'Activo', className: 'bg-green-50 text-green-700 border border-green-200' },
    almacenado: { label: 'Almacenado', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
    baja: { label: 'Baja', className: 'bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0]' },
}

const ESTADO_REPORTE_CONFIG: Record<string, {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    className: string;
}> = {
    en_progreso: { icon: AlertCircle, label: 'En progreso', className: 'text-indigo-600' },
    pendiente_firma_cliente: { icon: AlertCircle, label: 'Pte. firma cliente', className: 'text-amber-600' },
    cerrado: { icon: CheckCircle2, label: 'Cerrado', className: 'text-green-600' },
    anulado: { icon: XCircle, label: 'Anulado', className: 'text-red-500' },
}

// Fila de dato en ficha
function FichaFila({
    icon: Icon,
    label,
    children,
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    children: React.ReactNode
}) {
    return (
        <div className="flex items-start gap-3 py-2.5 border-b border-[#E2E8F0] last:border-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#F1F5F9]">
                <Icon className="h-3 w-3 text-[#94A3B8]" />
            </div>
            <div className="min-w-0">
                <p className="text-xs text-[#94A3B8]">{label}</p>
                <div className="mt-0.5 text-sm text-[#334155]">{children}</div>
            </div>
        </div>
    )
}

// =============================================================================
// PÁGINA
// =============================================================================

export default function EquiposDetalleClient({ equipoInicial, errorInicial, contratos, ubicaciones, categorias, tiposMantenimiento }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    const [equipoActual, setEquipoActual] = useState(equipoInicial)
    const [modalEditarAbierto, setModalEditarAbierto] = useState(false)
    const [modalAsignarAbierto, setModalAsignarAbierto] = useState(false)

    // Sincronizar estado local cuando router.refresh() trae nuevos datos del servidor
    useEffect(() => {
        setEquipoActual(equipoInicial)
    }, [equipoInicial])
    // 404 amigable o error
    if (errorInicial || !equipoActual) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <Stethoscope className="h-12 w-12 text-[#E2E8F0] mb-4" />
                <h2 className="text-lg font-bold text-[#0F172A]">{errorInicial || 'Equipo no encontrado'}</h2>
                <Button variant="outline" className="mt-6" onClick={() => router.push('/admin/equipos')}>
                    Volver a Equipos
                </Button>
            </div>
        )
    }

    const contratoVigente = equipoActual.contrato_id ? {
        contrato_id: equipoActual.contrato_id,
        numero_contrato: equipoActual.numero_contrato,
        cliente_id: equipoActual.cliente_id,
        cliente_nombre: equipoActual.cliente_nombre,
        ubicacion: equipoActual.ubicacion_nombre,
        // En DB la fecha asignación está en la vista v_equipo_contrato_vigente, la traemos
        fecha_asignacion: (equipoActual as any).fecha_asignacion || equipoActual.created_at,
    } : null

    const historialContratos = equipoActual.historial_contratos || []
    const mantenimientos = equipoActual.mantenimientos || []
    const historialUbicaciones = equipoActual.historial_ubicaciones || []

    const estado = computarEstadoEquipo(equipoActual as any)
    const badgeCfg = ESTADO_BADGE[estado]

    async function handleGuardar(valores: EquipoFormValues) {
        const result = await updateEquipo(equipoActual!.id, {
            ...valores,
            numero_serie: valores.numero_serie || undefined,
            activo_fijo: valores.activo_fijo || undefined,
        })
        setModalEditarAbierto(false)
        if (!result.error) {
            startTransition(() => router.refresh())
        }
    }

    return (
        <div className="space-y-6 max-w-6xl">

            {/* ── Breadcrumb ───────────────────────────────────────── */}
            <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/admin/equipos')}
                className="gap-1.5 text-[#94A3B8] hover:text-[#334155] -ml-2 px-2"
            >
                <ArrowLeft className="h-4 w-4" />
                Equipos
            </Button>

            {/* ── Encabezado ────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1E40AF]/10">
                        <Stethoscope className="h-6 w-6 text-[#1E40AF]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl font-bold font-mono text-[#0F172A]">
                                {equipoActual.codigo_mh}
                            </h1>
                            <Badge className={`text-xs font-medium px-2 py-0.5 rounded-sm ${badgeCfg.className}`}>
                                {badgeCfg.label}
                            </Badge>
                        </div>
                        <p className="text-sm text-[#334155] mt-0.5">{equipoActual.nombre}</p>
                        <p className="text-xs text-[#94A3B8]">
                            {[equipoActual.marca, equipoActual.modelo].filter(Boolean).join(' · ')}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setModalAsignarAbierto(true)}
                        className="gap-2 text-[#334155]"
                        id="btn-asignar-contrato"
                    >
                        <Link2 className="h-4 w-4" />
                        Asignar a contrato
                    </Button>
                    <Button
                        onClick={() => setModalEditarAbierto(true)}
                        className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white gap-2"
                        id="btn-editar-equipo"
                    >
                        <Pencil className="h-4 w-4" />
                        Editar
                    </Button>
                </div>
            </div>

            {/* ── Fila superior: Ficha + Contrato vigente ─────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                {/* Ficha del equipo (3/5) */}
                <div className="lg:col-span-3 rounded-xl border border-[#E2E8F0] bg-white shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-[#0F172A] mb-3">Ficha técnica</h2>

                    <div className="grid grid-cols-2 gap-x-6">
                        <div>
                            <FichaFila icon={Hash} label="N° Serie">
                                <span className="font-mono">{equipoActual.numero_serie ?? '—'}</span>
                            </FichaFila>
                            <FichaFila icon={Hash} label="Activo fijo">
                                <span className="font-mono">{equipoActual.activo_fijo ?? '—'}</span>
                            </FichaFila>
                            <FichaFila icon={Tag} label="Categoría">
                                {equipoActual.categoria?.nombre ?? '—'}
                            </FichaFila>
                        </div>
                        <div>
                            <FichaFila icon={CalendarDays} label="Año fabricación">
                                {equipoActual.fecha_fabricacion
                                    ? new Date(equipoActual.fecha_fabricacion).getFullYear().toString()
                                    : '—'}
                            </FichaFila>
                            <FichaFila icon={Clock} label="Último mantenimiento">
                                {formatFechaHora(equipoActual.fecha_ultimo_mantenimiento)}
                            </FichaFila>
                        </div>
                    </div>

                    {equipoActual.observaciones && (
                        <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
                            <p className="text-xs text-[#94A3B8] mb-1">Observaciones</p>
                            <p className="text-sm text-[#334155] whitespace-pre-line">
                                {equipoActual.observaciones}
                            </p>
                        </div>
                    )}
                </div>

                {/* Card: Contrato vigente (2/5) */}
                <div className="lg:col-span-2 rounded-xl border border-[#E2E8F0] bg-white shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-4 w-4 text-[#94A3B8]" />
                        <h2 className="text-sm font-semibold text-[#0F172A]">Contrato vigente</h2>
                    </div>

                    {contratoVigente ? (
                        <div className="space-y-3">
                            <div>
                                <button
                                    onClick={() => router.push(`/admin/contratos/${contratoVigente.contrato_id}`)}
                                    className="text-base font-bold font-mono text-[#1E40AF] hover:underline"
                                >
                                    {contratoVigente.numero_contrato}
                                </button>
                            </div>
                            <div className="flex items-start gap-2">
                                <Building2 className="h-4 w-4 text-[#94A3B8] mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-xs text-[#94A3B8]">Cliente</p>
                                    <button
                                        onClick={() => router.push(`/admin/clientes/${contratoVigente.cliente_id}`)}
                                        className="text-sm font-medium text-[#1E40AF] hover:underline text-left"
                                    >
                                        {contratoVigente.cliente_nombre}
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <CalendarDays className="h-4 w-4 text-[#94A3B8] mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-xs text-[#94A3B8]">Asignado desde</p>
                                    <p className="text-sm text-[#334155]">
                                        {formatFecha(contratoVigente.fecha_asignacion)}
                                    </p>
                                </div>
                            </div>
                            {contratoVigente.ubicacion && (
                                <div className="flex items-start gap-2">
                                    <MapPin className="h-4 w-4 text-[#94A3B8] mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs text-[#94A3B8]">Ubicación</p>
                                        <p className="text-sm text-[#334155]">{contratoVigente.ubicacion}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F1F5F9] mb-3">
                                <FileText className="h-5 w-5 text-[#94A3B8]" />
                            </div>
                            <Badge className="bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0] text-xs mb-2">
                                Sin contrato
                            </Badge>
                            <p className="text-xs text-[#94A3B8]">
                                Este equipo no está asignado a ningún contrato vigente.
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setModalAsignarAbierto(true)}
                                className="mt-3 gap-1.5 text-xs"
                            >
                                <Link2 className="h-3 w-3" />
                                Asignar
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Fila inferior: Historial contratos + Mantenimientos ─ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Historial de contratos */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <History className="h-4 w-4 text-[#94A3B8]" />
                        <h2 className="text-sm font-semibold text-[#0F172A]">
                            Historial de contratos
                        </h2>
                        <span className="ml-auto text-xs text-[#94A3B8] bg-[#F1F5F9] rounded-full px-2 py-0.5">
                            {historialContratos.length}
                        </span>
                    </div>

                    {historialContratos.length === 0 ? (
                        <div className="flex flex-col items-center py-8 text-center">
                            <History className="h-7 w-7 text-[#E2E8F0] mb-2" />
                            <p className="text-sm text-[#94A3B8]">Sin historial de contratos</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-[#F8FAFC]">
                                        <TableHead className="text-xs py-2 pl-3">Contrato</TableHead>
                                        <TableHead className="text-xs py-2 hidden sm:table-cell">Ub icación</TableHead>
                                        <TableHead className="text-xs py-2">Desde</TableHead>
                                        <TableHead className="text-xs py-2 pr-3">Hasta</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {historialContratos.map((h: any) => (
                                        <TableRow key={h.id} className="border-b border-[#E2E8F0]">
                                            <TableCell className="py-2.5 pl-3">
                                                <button
                                                    onClick={() => router.push(`/admin/contratos/${h.contrato?.id}`)}
                                                    className="text-xs font-mono text-[#1E40AF] hover:underline font-semibold"
                                                >
                                                    {h.contrato?.numero_contrato ?? '—'}
                                                </button>
                                            </TableCell>
                                            <TableCell className="py-2.5 text-xs text-[#334155] hidden sm:table-cell">
                                                {h.ubicacion?.nombre ?? '—'}
                                            </TableCell>
                                            <TableCell className="py-2.5 text-xs text-[#94A3B8]">
                                                {formatFecha(h.fecha_asignacion)}
                                            </TableCell>
                                            <TableCell className="py-2.5 pr-3">
                                                {h.fecha_retiro ? (
                                                    <span className="text-xs text-[#94A3B8]">{formatFecha(h.fecha_retiro)}</span>
                                                ) : (
                                                    <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-sm">Vigente</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                {/* Historial de ubicaciones (basado en reportes) */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <MapPin className="h-4 w-4 text-[#94A3B8]" />
                        <h2 className="text-sm font-semibold text-[#0F172A]">
                            Trazabilidad de ubicaciones
                        </h2>
                        <span className="ml-auto text-xs text-[#94A3B8] bg-[#F1F5F9] rounded-full px-2 py-0.5">
                            {historialUbicaciones.length}
                        </span>
                    </div>

                    {historialUbicaciones.length === 0 ? (
                        <div className="flex flex-col items-center py-8 text-center">
                            <MapPin className="h-7 w-7 text-[#E2E8F0] mb-2" />
                            <p className="text-sm text-[#94A3B8]">Sin registros de ubicación en reportes</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-[#F8FAFC]">
                                        <TableHead className="text-xs py-2 pl-3">Ubicación</TableHead>
                                        <TableHead className="text-xs py-2">Fecha</TableHead>
                                        <TableHead className="text-xs py-2">Técnico</TableHead>
                                        <TableHead className="text-xs py-2 pr-3 text-right">Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {historialUbicaciones.map((u: any, idx: number) => (
                                        <TableRow key={idx} className="border-b border-[#E2E8F0]">
                                            <TableCell className="py-2.5 pl-3">
                                                <p className="text-xs font-semibold text-[#334155]">{u.ubicacion_nombre || 'No asignada'}</p>
                                                {u.ubicacion_detalle && (
                                                    <p className="text-[10px] text-[#94A3B8] italic">{u.ubicacion_detalle}</p>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-2.5 text-xs text-[#334155]">
                                                {formatFecha(u.fecha_registro)}
                                            </TableCell>
                                            <TableCell className="py-2.5 text-xs text-[#94A3B8]">
                                                {u.tecnico_nombre}
                                            </TableCell>
                                            <TableCell className="py-2.5 pr-3 text-right">
                                                <Badge variant="outline" className="text-[9px] font-medium py-0 h-4 normal-case border-[#E2E8F0]">
                                                    {u.estado_reporte === 'cerrado' ? 'Oficial' : 'Provisional'}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                {/* Últimos mantenimientos */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Wrench className="h-4 w-4 text-[#94A3B8]" />
                        <h2 className="text-sm font-semibold text-[#0F172A]">
                            Últimos mantenimientos
                        </h2>
                        <span className="ml-auto text-xs text-[#94A3B8] bg-[#F1F5F9] rounded-full px-2 py-0.5">
                            {mantenimientos.length}
                        </span>
                    </div>

                    {mantenimientos.length === 0 ? (
                        <div className="flex flex-col items-center py-8 text-center">
                            <Wrench className="h-7 w-7 text-[#E2E8F0] mb-2" />
                            <p className="text-sm text-[#94A3B8]">Sin mantenimientos registrados</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {mantenimientos.map((m: any) => {
                                const resCfg = ESTADO_REPORTE_CONFIG[m.estado_reporte] || ESTADO_REPORTE_CONFIG.en_progreso
                                const ResIcon = resCfg.icon
                                return (
                                    <div
                                        key={m.id}
                                        className="flex items-start gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-[#334155] bg-[#E2E8F0] px-1.5 py-0.5 rounded-sm">
                                                    {m.tipo?.nombre ?? 'Mantenimiento'}
                                                </span>
                                                <span className="text-xs text-[#94A3B8]">
                                                    {formatFechaHora(m.fecha_inicio)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[#94A3B8] mt-1">
                                                Técnico: <span className="text-[#334155]">{m.tecnico_principal?.nombre} {m.tecnico_principal?.apellido}</span>
                                            </p>
                                            {m.observaciones && (
                                                <p className="text-xs text-[#94A3B8] mt-0.5 line-clamp-2">
                                                    {m.observaciones}
                                                </p>
                                            )}
                                        </div>
                                        <div className="ml-auto shrink-0 flex items-center gap-1">
                                            <ResIcon className={`h-3.5 w-3.5 ${resCfg.className}`} />
                                            <span className={`text-xs font-medium ${resCfg.className}`}>
                                                {resCfg.label}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modal: Editar equipo ───────────────────────────── */}
            <Dialog open={modalEditarAbierto} onOpenChange={(open) => !open && setModalEditarAbierto(false)}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="text-[#0F172A]">Editar Equipo</DialogTitle>
                        <DialogDescription className="text-[#94A3B8]">
                            Editando: {equipoActual.codigo_mh} — {equipoActual.nombre}
                        </DialogDescription>
                    </DialogHeader>
                    <EquipoForm
                        modo="editar"
                        equipoInicial={equipoActual as any}
                        categorias={categorias}
                        tiposMantenimiento={tiposMantenimiento}
                        onGuardar={handleGuardar}
                        onCancelar={() => setModalEditarAbierto(false)}
                    />
                </DialogContent>
            </Dialog>

            <AsignarContratoModal
                open={modalAsignarAbierto}
                onClose={() => setModalAsignarAbierto(false)}
                onSuccess={() => startTransition(() => router.refresh())}
                equipoId={equipoActual.id}
                equipoNombre={`${equipoActual.codigo_mh} — ${equipoActual.nombre}`}
                contratos={contratos}
                ubicaciones={ubicaciones}
                contratoVigenteId={equipoActual.contrato_id}
            />
        </div>
    )
}
