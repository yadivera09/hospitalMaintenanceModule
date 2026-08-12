'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft,
    FileText,
    Pencil,
    Building2,
    CalendarDays,
    Tag,
    AlignLeft,
    Stethoscope,
    CheckCircle2,
    Clock,
    AlertCircle,
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
import ContratoForm from '@/components/admin/contratos/ContratoForm'
import { updateContrato } from '@/app/actions/contratos'
import { usePuede } from '@/lib/seguridad/PermisosProvider'
import { MODULO, PERMISO } from '@/lib/seguridad/modulos'
import { computarEstadoContrato } from '@/types'
import type { Contrato, Cliente, EstadoContrato } from '@/types'
import type { ContratoConCliente } from '@/app/actions/contratos'
import type { ContratoFormValues } from '@/components/admin/contratos/ContratoForm'

// =============================================================================
// HELPERS
// =============================================================================

function formatFecha(fecha: string | null): string {
    if (!fecha) return 'Indefinida'
    return new Date(fecha).toLocaleDateString('es-EC', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    })
}

const ESTADO_BADGE: Record<EstadoContrato, { label: string; className: string }> = {
    activo: { label: 'Activo', className: 'bg-ok-suave text-ok-tinta border border-ok-linea' },
    vencido: { label: 'Vencido', className: 'bg-critico-suave text-critico-tinta border border-critico-linea' },
    suspendido: { label: 'Suspendido', className: 'bg-aviso-suave text-aviso-tinta border border-aviso-linea' },
    cancelado: { label: 'Cancelado', className: 'bg-panel-suave text-tinta-tenue border border-borde' },
}

const MANT_CONFIG = {
    al_dia: { label: 'Al día', icon: CheckCircle2, className: 'text-ok-tinta' },
    proximo: { label: 'Próximo', icon: Clock, className: 'text-aviso-tinta' },
    vencido: { label: 'Vencido', icon: AlertCircle, className: 'text-critico-tinta' },
} as const

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
        <div className="flex items-start gap-3 py-3 border-b border-borde last:border-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-panel-suave">
                <Icon className="h-3.5 w-3.5 text-tinta-tenue" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs text-tinta-tenue font-medium">{label}</p>
                <div className="mt-0.5">{children}</div>
            </div>
        </div>
    )
}

function EquipoCard({ equipo, onVerEquipo }: { equipo: any; onVerEquipo: (id: string) => void }) {
    // Calculo muy básico de estado_mantenimiento si no lo tenemos todavía en la vista SQL completa (para pruebas en el bloque 2)
    // Se asume "al_dia" por defecto
    const estado_mantenimiento: keyof typeof MANT_CONFIG = typeof equipo.estado_mantenimiento === 'string' && equipo.estado_mantenimiento in MANT_CONFIG
        ? equipo.estado_mantenimiento as keyof typeof MANT_CONFIG
        : 'al_dia'

    const mant = MANT_CONFIG[estado_mantenimiento]
    const MantIcon = mant.icon

    return (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-borde bg-panel-suave p-3.5 hover:border-marca-linea transition-colors">
            <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => onVerEquipo(equipo.equipo_id || equipo.id)}
                        className="text-sm font-semibold font-mono text-marca-tinta hover:underline"
                    >
                        {equipo.codigo_mh}
                    </button>
                    <span className="text-xs text-tinta-tenue bg-panel-suave px-1.5 py-0.5 rounded-sm">
                        {equipo.categoria_nombre || equipo.categoria}
                    </span>
                </div>
                <p className="text-sm text-tinta-media mt-0.5 line-clamp-1">{equipo.equipo_nombre || equipo.nombre}</p>
                {(equipo.ubicacion_nombre || equipo.ubicacion) && (
                    <p className="text-xs text-tinta-tenue mt-0.5 truncate">{equipo.ubicacion_nombre || equipo.ubicacion}</p>
                )}
            </div>

            <div className="shrink-0 flex items-center gap-1.5">
                <MantIcon className={`h-3.5 w-3.5 ${mant.className}`} />
                <span className={`text-xs font-medium ${mant.className} hidden sm:inline`}>
                    {mant.label}
                </span>
            </div>
        </div>
    )
}

// =============================================================================
// COMPONENTE CLIENTE
// =============================================================================

interface Props {
    contratoInicial: (ContratoConCliente & { equipos: any[] }) | null
    clientesList: Cliente[]
}

export default function ContratoDetalleClient({ contratoInicial, clientesList }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    // Antes del return temprano de más abajo: los hooks deben ejecutarse
    // siempre en el mismo orden, sin condicionales de por medio.
    const puede = usePuede()

    const [modalAbierto, setModalAbierto] = useState(false)
    const [errorForm, setErrorForm] = useState<string | null>(null)

    if (!contratoInicial) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <FileText className="h-12 w-12 text-borde mb-4" />
                <h2 className="text-lg font-bold text-tinta">Contrato no encontrado</h2>
                <p className="text-sm text-tinta-tenue mt-1">
                    El contrato solicitado no existe en el sistema.
                </p>
                <Button
                    variant="outline"
                    className="mt-6"
                    onClick={() => router.push('/admin/contratos')}
                >
                    Volver a Contratos
                </Button>
            </div>
        )
    }

    const estado = computarEstadoContrato(contratoInicial)
    const badgeCfg = ESTADO_BADGE[estado]
    const clienteData = contratoInicial.cliente

    async function handleGuardar(valores: ContratoFormValues) {
        if (!contratoInicial) return
        setErrorForm(null)

        const payload = {
            cliente_id: valores.cliente_id,
            numero_contrato: valores.numero_contrato,
            fecha_inicio: valores.fecha_inicio,
            fecha_fin: valores.fecha_fin || null,
            tipo_contrato: valores.tipo_contrato,
            observaciones: valores.observaciones || null,
            activo: valores.estado_display !== 'cancelado',
        }

        const result = await updateContrato(contratoInicial.id, payload)

        if (result.error) {
            setErrorForm(result.error)
            return
        }

        setModalAbierto(false)
        startTransition(() => { router.refresh() })
    }

    return (
        <div className="space-y-6 max-w-5xl">

            {/* ── Breadcrumb ────────────────────────────────────── */}
            <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/admin/contratos')}
                className="gap-1.5 text-tinta-tenue hover:text-tinta-media -ml-2 px-2"
            >
                <ArrowLeft className="h-4 w-4" />
                Contratos
            </Button>

            {/* ── Encabezado ────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-marca-suave">
                        <FileText className="h-6 w-6 text-marca-tinta" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl font-bold font-mono text-tinta leading-tight">
                                {contratoInicial.numero_contrato}
                            </h1>
                            <Badge className={`text-xs font-medium px-2 py-0.5 rounded-sm ${badgeCfg.className}`}>
                                {badgeCfg.label}
                            </Badge>
                        </div>
                        <p className="text-sm text-tinta-tenue mt-0.5 capitalize">
                            Tipo: {contratoInicial.tipo_contrato}
                        </p>
                    </div>
                </div>

                {puede(MODULO.CONTRATOS, PERMISO.EDITAR) && (
                    <Button
                        onClick={() => { setErrorForm(null); setModalAbierto(true) }}
                        className="bg-marca hover:bg-marca-fuerte text-white gap-2"
                        id="btn-editar-contrato"
                        disabled={isPending}
                    >
                        <Pencil className="h-4 w-4" />
                        Editar
                    </Button>
                )}
            </div>

            {/* ── Cuerpo en dos columnas ────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                {/* ── Ficha del contrato (2/5) ─────────── */}
                <div className="lg:col-span-2 rounded-xl border border-borde bg-panel shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-tinta mb-2 flex items-center gap-2">
                        {isPending && <Clock className="h-3 w-3 animate-spin text-tinta-tenue" />}
                        Datos del contrato
                    </h2>

                    {/* Cliente — clickeable a detalle */}
                    <FichaFila icon={Building2} label="Cliente">
                        {clienteData ? (
                            <button
                                onClick={() => router.push(`/admin/clientes/${contratoInicial.cliente_id}`)}
                                className="text-sm font-medium text-marca-tinta hover:underline text-left break-words"
                            >
                                {clienteData.razon_social}
                            </button>
                        ) : (
                            <span className="text-sm text-tinta-media">—</span>
                        )}
                    </FichaFila>

                    <FichaFila icon={CalendarDays} label="Fecha inicio">
                        <span className="text-sm text-tinta-media">
                            {formatFecha(contratoInicial.fecha_inicio)}
                        </span>
                    </FichaFila>

                    <FichaFila icon={CalendarDays} label="Fecha fin">
                        <span className={`text-sm ${estado === 'vencido' ? 'text-critico-tinta font-medium' : 'text-tinta-media'}`}>
                            {formatFecha(contratoInicial.fecha_fin)}
                        </span>
                    </FichaFila>

                    <FichaFila icon={Tag} label="Tipo">
                        <span className="text-sm capitalize text-tinta-media">
                            {contratoInicial.tipo_contrato}
                        </span>
                    </FichaFila>

                    {contratoInicial.observaciones && (
                        <FichaFila icon={AlignLeft} label="Observaciones">
                            <p className="text-sm text-tinta-media whitespace-pre-wrap break-words">
                                {contratoInicial.observaciones}
                            </p>
                        </FichaFila>
                    )}
                </div>

                {/* ── Equipos asignados (3/5) ─────────── */}
                <div className="lg:col-span-3 rounded-xl border border-borde bg-panel shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <Stethoscope className="h-4 w-4 text-tinta-tenue" />
                            <h2 className="text-sm font-semibold text-tinta">
                                Equipos en contrato
                            </h2>
                        </div>
                        <span className="text-xs text-tinta-tenue bg-panel-suave rounded-full px-2 py-0.5">
                            {contratoInicial.equipos.length}
                        </span>
                    </div>

                    {contratoInicial.equipos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                            <Stethoscope className="h-8 w-8 text-borde mb-2" />
                            <p className="text-sm font-medium text-tinta-media">Sin equipos asociados</p>
                            <p className="text-xs text-tinta-tenue mt-1 max-w-[200px]">
                                Este contrato no tiene equipos vinculados. Los contratos se asocian a equipos en el módulo "Equipos".
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {contratoInicial.equipos.map((eq, i) => (
                                <EquipoCard
                                    key={eq.id || i}
                                    equipo={eq}
                                    onVerEquipo={(eid) => router.push(`/admin/equipos/${eid}`)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modal edición ─────────────────────────────────── */}
            <Dialog open={modalAbierto} onOpenChange={(open) => !open && !isPending && setModalAbierto(false)}>
                <DialogContent className="max-w-lg w-[95vw] p-4 sm:p-6 mx-auto rounded-xl">
                    <DialogHeader>
                        <DialogTitle className="text-tinta">Editar Contrato</DialogTitle>
                        <DialogDescription className="text-tinta-tenue">
                            Editando: {contratoInicial.numero_contrato}
                        </DialogDescription>
                    </DialogHeader>

                    {errorForm && (
                        <div className="flex items-center gap-2 rounded-lg border border-critico-linea bg-critico-suave px-3 py-2 text-xs text-critico-tinta">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />{errorForm}
                        </div>
                    )}

                    <ContratoForm
                        modo="editar"
                        contratoInicial={contratoInicial}
                        clientesList={clientesList}
                        onGuardar={handleGuardar}
                        onCancelar={() => setModalAbierto(false)}
                        isLoading={isPending}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}
