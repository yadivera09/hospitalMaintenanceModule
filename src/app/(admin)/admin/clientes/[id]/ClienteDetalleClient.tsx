'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft,
    Building2,
    Pencil,
    Phone,
    Mail,
    MapPin,
    Hash,
    FileText,
    CalendarDays,
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
import ClienteForm from '@/components/admin/clientes/ClienteForm'
import { updateCliente } from '@/app/actions/clientes'
import { usePuede } from '@/lib/seguridad/PermisosProvider'
import { MODULO, PERMISO } from '@/lib/seguridad/modulos'
import type { Cliente, Contrato } from '@/types'
import type { ClienteFormValues } from '@/components/admin/clientes/ClienteForm'

interface Props {
    clienteInicial?: Cliente & { contratos: Contrato[] }
    errorInicial: string | null
}

function formatFecha(fecha: string | null): string {
    if (!fecha) return '—'
    return new Date(fecha).toLocaleDateString('es-EC', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    })
}

function FichaFila({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: string | null
}) {
    return (
        <div className="flex items-start gap-3 py-3 border-b border-borde last:border-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-panel-suave">
                <Icon className="h-3.5 w-3.5 text-tinta-tenue" />
            </div>
            <div className="min-w-0">
                <p className="text-xs text-tinta-tenue font-medium">{label}</p>
                <p className="text-sm text-tinta mt-0.5 break-words">
                    {value ?? '—'}
                </p>
            </div>
        </div>
    )
}

export default function ClienteDetalleClient({ clienteInicial, errorInicial }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    // Antes del return temprano de más abajo: los hooks deben ejecutarse
    // siempre en el mismo orden, sin condicionales de por medio.
    const puede = usePuede()

    const [modalAbierto, setModalAbierto] = useState(false)
    const [errorForm, setErrorForm] = useState<string | null>(null)

    if (errorInicial || !clienteInicial) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <Building2 className="h-12 w-12 text-borde mb-4" />
                <h2 className="text-lg font-bold text-tinta">
                    Cliente no encontrado
                </h2>
                <p className="text-sm text-tinta-tenue mt-1">
                    {errorInicial || 'El cliente no existe o fue eliminado.'}
                </p>
                <Button
                    variant="outline"
                    className="mt-6"
                    onClick={() => router.push('/admin/clientes')}
                >
                    Volver a Clientes
                </Button>
            </div>
        )
    }

    const { contratos, ...clienteActual } = clienteInicial

    async function handleGuardar(valores: ClienteFormValues) {
        setErrorForm(null)
        const payload = {
            razon_social: valores.razon_social,
            ruc: valores.ruc || null,
            email: valores.email || null,
            telefono: valores.telefono || null,
            direccion: valores.direccion || null,
            activo: valores.activo === 'true',
        }

        const result = await updateCliente(clienteActual.id, payload)

        if (result.error) {
            setErrorForm(result.error)
            return
        }

        setModalAbierto(false)
        startTransition(() => {
            router.refresh()
        })
    }

    return (
        <div className="space-y-6 max-w-4xl">
            {/* ── Encabezado ──────────── */}
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/admin/clientes')}
                    className="gap-1.5 text-tinta-tenue hover:text-tinta-media -ml-2 px-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Clientes
                </Button>
            </div>

            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-marca-suave">
                        <Building2 className="h-6 w-6 text-marca-tinta" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-tinta leading-tight flex items-center gap-2">
                                {clienteActual.razon_social}
                                {isPending && <span className="text-xs font-normal text-muted-foreground ml-2 animate-pulse">Actualizando...</span>}
                            </h1>
                            {clienteActual.activo ? (
                                <Badge className="bg-ok-suave text-ok-tinta border border-ok-linea text-xs rounded-sm">
                                    Activo
                                </Badge>
                            ) : (
                                <Badge className="bg-panel-suave text-tinta-tenue border border-borde text-xs rounded-sm">
                                    Inactivo
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-tinta-tenue mt-0.5">
                            Registrado el {formatFecha(clienteActual.created_at)}
                        </p>
                    </div>
                </div>

                {puede(MODULO.CLIENTES, PERMISO.EDITAR) && (
                    <Button
                        onClick={() => setModalAbierto(true)}
                        className="bg-marca hover:bg-marca-fuerte text-white gap-2"
                        id="btn-editar-cliente"
                    >
                        <Pencil className="h-4 w-4" />
                        Editar
                    </Button>
                )}
            </div>

            {/* ── Cuerpo ──────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 rounded-xl border border-borde bg-panel shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-tinta mb-2">Datos del cliente</h2>
                    <FichaFila icon={Hash} label="RUC" value={clienteActual.ruc} />
                    <FichaFila icon={Phone} label="Teléfono" value={clienteActual.telefono} />
                    <FichaFila icon={Mail} label="Email" value={clienteActual.email} />
                    <FichaFila icon={MapPin} label="Dirección" value={clienteActual.direccion} />
                    <FichaFila icon={CalendarDays} label="Última actualización" value={formatFecha(clienteActual.updated_at)} />
                </div>

                <div className="lg:col-span-2 rounded-xl border border-borde bg-panel shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-tinta">Contratos asociados</h2>
                        <span className="text-xs text-tinta-tenue bg-panel-suave rounded-full px-2 py-0.5">{contratos.length}</span>
                    </div>

                    {contratos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <FileText className="h-8 w-8 text-borde mb-2" />
                            <p className="text-sm text-tinta-tenue">Sin contratos registrados</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {contratos.map((contrato) => (
                                <div key={contrato.id} className="flex items-start justify-between gap-4 rounded-lg border border-borde bg-panel-suave p-4 hover:border-marca-linea transition-colors">
                                    <div className="min-w-0">
                                        <button onClick={() => router.push(`/admin/contratos/${contrato.id}`)} className="text-sm font-semibold text-marca-tinta hover:underline font-mono">
                                            {contrato.numero_contrato}
                                        </button>
                                        <p className="text-xs text-tinta-tenue mt-0.5">
                                            {formatFecha(contrato.fecha_inicio)} → {contrato.fecha_fin ? formatFecha(contrato.fecha_fin) : 'Indefinido'}
                                        </p>
                                        {contrato.observaciones && <p className="text-xs text-tinta-media mt-1 line-clamp-2">{contrato.observaciones}</p>}
                                    </div>
                                    <div className="shrink-0">
                                        {contrato.activo ? (
                                            <Badge className="bg-ok-suave text-ok-tinta border border-ok-linea text-xs rounded-sm">Vigente</Badge>
                                        ) : (
                                            <Badge className="bg-panel-suave text-tinta-tenue border border-borde text-xs rounded-sm">Inactivo</Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modal edición ──────────── */}
            <Dialog open={modalAbierto} onOpenChange={(open) => !open && setModalAbierto(false)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-tinta">Editar Cliente</DialogTitle>
                        <DialogDescription className="text-tinta-tenue">Editando: {clienteActual.razon_social}</DialogDescription>
                    </DialogHeader>

                    {errorForm && (
                        <div className="flex items-center gap-2 rounded-lg border border-critico-linea bg-critico-suave px-3 py-2 text-xs text-critico-tinta">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            {errorForm}
                        </div>
                    )}

                    <ClienteForm
                        modo="editar"
                        clienteInicial={clienteActual}
                        onGuardar={handleGuardar}
                        onCancelar={() => setModalAbierto(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}
