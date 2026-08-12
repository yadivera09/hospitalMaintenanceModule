'use client'

/**
 * src/components/admin/shared/DeleteButton.tsx
 * Botón reutilizable de desactivación (soft delete) con diálogo de confirmación.
 * NUNCA elimina físicamente — siempre activo = false.
 * Si la operación falla por dependencias activas, muestra el error en el propio diálogo.
 */

import { useState } from 'react'
import { Trash2, AlertCircle, ExternalLink, ListFilter, UserPlus, Info } from 'lucide-react'
import Link from 'next/link'
import { reasignarReporte } from '@/app/actions/reportes'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'

interface DeleteButtonProps {
    /** Nombre del registro para el mensaje de confirmación */
    nombreRegistro: string
    /** Action de desactivación — debe retornar { error: string | null, meta?: any } */
    onDesactivar: () => Promise<{ error: string | null; meta?: any }>
    /** Callback después de desactivar exitosamente */
    onExito?: () => void
    /** Lista de técnicos para reasignación */
    tecnicos?: { id: string; nombre: string; apellido: string; activo: boolean }[]
    /** Texto del aria-label y title del botón */
    label?: string
    disabled?: boolean
}

export default function DeleteButton({
    nombreRegistro,
    onDesactivar,
    onExito,
    tecnicos = [],
    label = 'Desactivar',
    disabled = false,
}: DeleteButtonProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [meta, setMeta] = useState<any>(null)

    function abrir() {
        setError(null)
        setOpen(true)
    }

    function cerrar() {
        if (loading) return
        setOpen(false)
        setError(null)
        setMeta(null)
    }

    async function handleConfirm() {
        setLoading(true)
        setError(null)
        const res = await onDesactivar()
        setLoading(false)

        if (res.error) {
            setError(res.error)
            // Normalizar estado de reportes para UI reactiva local
            if (res.meta?.reportes) {
                setMeta({
                    ...res.meta,
                    reportes: res.meta.reportes.map((r: any) => ({ ...r, reasignado: false }))
                })
            } else {
                setMeta(res.meta)
            }
            return
        }

        setOpen(false)
        onExito?.()
    }

    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={abrir}
                className="h-8 w-8 p-0 text-tinta-tenue hover:text-critico-tinta hover:bg-critico-suave"
                aria-label={`${label}: ${nombreRegistro}`}
                title={label}
            >
                <Trash2 className="h-4 w-4" />
            </Button>

            <Dialog open={open} onOpenChange={(o) => !o && cerrar()}>
                <DialogContent className={meta?.reportes ? "max-w-md" : "max-w-sm"}>
                    <DialogHeader>
                        <DialogTitle className="text-tinta">
                            ¿Desactivar este registro?
                        </DialogTitle>
                        <DialogDescription className="text-tinta-tenue">
                            Vas a desactivar{' '}
                            <strong className="text-tinta-media">{nombreRegistro}</strong>.
                            El registro quedará inactivo y podrás reactivarlo desde el formulario de edición.
                            Si tiene dependencias activas, la operación será bloqueada.
                        </DialogDescription>
                    </DialogHeader>

                    {(error && (!meta?.reportes || meta.reportes.some((r: any) => !r.reasignado))) && (
                        <div className="space-y-3">
                            <div className="flex items-start gap-2 rounded-lg border border-critico-linea bg-critico-suave px-3 py-2.5 text-xs text-critico-tinta">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>

                            {meta?.reportes && meta.reportes.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1.5 px-1">
                                        <ListFilter className="h-3.5 w-3.5 text-tinta-media" />
                                        <span className="text-[11px] font-semibold text-tinta-media uppercase tracking-wider">Reportes bloqueantes</span>
                                    </div>
                                    <div className="rounded-lg border border-borde overflow-hidden divide-y divide-borde">
                                        {meta.reportes.filter((r: any) => !r.reasignado).map((r: any) => (
                                            <div key={r.id} className="p-2.5 hover:bg-panel-suave transition-colors group">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                                        <Link 
                                                            href={`/admin/reportes/${r.id}`}
                                                            target="_blank"
                                                            className="text-[13px] font-bold text-marca-tinta hover:underline flex items-center gap-1"
                                                        >
                                                            {r.serial}
                                                            <ExternalLink className="h-3 w-3" />
                                                        </Link>
                                                        <span className="text-[11px] text-tinta-media truncate">{r.equipo}</span>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {/* Un reporte cerrado ya no se reasigna: lleva la
                                                            firma del técnico que lo hizo. Antes esto miraba
                                                            'pendiente_firma_cliente', el estado que la
                                                            migración 023 eliminó. */}
                                                        {r.estado === 'cerrado' ? (
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div className="flex items-center gap-1.5 bg-marca-suave text-marca-tinta px-2.5 py-1 rounded-full text-[10px] font-bold cursor-help uppercase border border-marca-linea">
                                                                            Esperando firma del cliente
                                                                            <Info className="h-3 w-3" />
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent className="max-w-[200px]">
                                                                        <p className="text-xs">No se puede reasignar, el reporte ya está en espera de firma.</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-aviso-suave text-aviso-tinta border border-aviso-linea">
                                                                    En progreso
                                                                </span>
                                                                
                                                                <Select onValueChange={async (val) => {
                                                                    if (!val) return
                                                                    const ok = confirm(`¿Reasignar este reporte a ${tecnicos.find(t => t.id === val)?.nombre}?`)
                                                                    if (!ok) return
                                                                    
                                                                    const res = await reasignarReporte(r.id, val)
                                                                    if (res.error) alert(res.error)
                                                                    else {
                                                                        setMeta((prev: any) => ({
                                                                            ...prev,
                                                                            reportes: prev.reportes.map((x: any) => 
                                                                                x.id === r.id ? { ...x, reasignado: true } : x
                                                                            )
                                                                        }))
                                                                    }
                                                                }}>
                                                                    <SelectTrigger className="h-7 px-2 flex items-center gap-1.5 bg-panel border-borde text-tinta hover:bg-panel-suave text-[11px] font-semibold transition-all">
                                                                        <UserPlus className="h-3.5 w-3.5" />
                                                                        Reasignar
                                                                    </SelectTrigger>
                                                                    <SelectContent align="end">
                                                                        <div className="px-2 py-1.5 text-[10px] font-bold text-tinta-media uppercase">Reasignar a:</div>
                                                                        {tecnicos.filter(t => t.id !== meta.tecnicoId && t.activo).map(t => (
                                                                            <SelectItem key={t.id} value={t.id}>
                                                                                {t.nombre} {t.apellido}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {meta.total > 5 && (
                                        <p className="text-[11px] text-center text-tinta-tenue italic">
                                            Mostrando 5 de {meta.total} reportes
                                        </p>
                                    )}
                                    <div className="pt-1 flex justify-center">
                                        <Link 
                                            href={`/admin/reportes?tecnico_id=${meta.tecnicoId}`}
                                            className="text-xs text-marca-tinta hover:underline font-medium inline-flex items-center gap-1.5 py-1"
                                        >
                                            Ver todos los reportes de {nombreRegistro}
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                        <Button
                            variant="outline"
                            onClick={cerrar}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={loading || (meta?.reportes && meta.reportes.some((r: any) => !r.reasignado))}
                            className={`text-white transition-all ${meta?.reportes && meta.reportes.some((r: any) => !r.reasignado)
                                ? 'bg-borde cursor-not-allowed hover:bg-borde' 
                                : 'bg-red-600 hover:bg-red-700'}`}
                        >
                            {loading ? 'Desactivando…' : 'Sí, desactivar'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
