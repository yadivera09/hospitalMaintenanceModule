'use client'

/**
 * src/components/admin/equipos/AsignarContratoModal.tsx
 * Modal para asignar o reasignar un equipo a un contrato.
 * BLOQUE 3 — Usa asignarEquipoAContrato (RPC atómica).
 */

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { asignarEquipoAContrato } from '@/app/actions/equipos'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Contrato {
    id: string
    numero_contrato: string
}

interface Ubicacion {
    id: string
    nombre: string
}

interface AsignarContratoModalProps {
    open: boolean
    onClose: () => void
    onSuccess: () => void   // ← el padre hace router.refresh() desde fuera
    equipoId: string
    equipoNombre: string
    contratos: Contrato[]
    ubicaciones: Ubicacion[]
    contratoVigenteId?: string | null
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function AsignarContratoModal({
    open,
    onClose,
    onSuccess,
    equipoId,
    equipoNombre,
    contratos,
    ubicaciones,
    contratoVigenteId,
}: AsignarContratoModalProps) {
    const [isPending, startTransition] = useTransition()

    const [contratoId, setContratoId] = useState<string>(contratoVigenteId ?? '')
    const [ubicacionId, setUbicacionId] = useState<string>('')
    const [fecha, setFecha] = useState<string>(
        new Date().toISOString().split('T')[0]
    )
    const [error, setError] = useState<string | null>(null)
    const [exito, setExito] = useState(false)

    function handleClose() {
        setError(null)
        setExito(false)
        onClose()
    }

    function handleGuardar() {
        setError(null)
        if (!contratoId) {
            setError('Debes seleccionar un contrato.')
            return
        }

        startTransition(async () => {
            const result = await asignarEquipoAContrato({
                equipo_id: equipoId,
                contrato_id: contratoId,
                ubicacion_id: ubicacionId || null,
                fecha_asignacion: fecha,
            })

            if (result.error) {
                setError(result.error)
                return
            }

            setExito(true)
            // Cerrar modal primero, luego el padre hace refresh desde fuera
            setTimeout(() => {
                handleClose()
                onSuccess()   // ← el padre llama router.refresh() estando montado
            }, 600)
        })
    }

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="text-tinta">
                        Asignar a contrato
                    </DialogTitle>
                    <p className="text-sm text-tinta-tenue mt-0.5">
                        Equipo: <span className="font-medium text-tinta-media">{equipoNombre}</span>
                    </p>
                    {contratoVigenteId && (
                        <div className="rounded-md bg-aviso-suave border border-aviso-linea px-3 py-2 text-xs text-aviso-tinta">
                            ⚠️ Este equipo ya tiene un contrato vigente.
                            Al asignar uno nuevo, el contrato anterior quedará cerrado
                            con fecha de retiro = hoy.
                        </div>
                    )}
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Contrato */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-tinta-media">
                            Contrato <span className="text-critico-tinta">*</span>
                        </Label>
                        <Select value={contratoId} onValueChange={setContratoId}>
                            <SelectTrigger className={!contratoId && error ? 'border-critico-linea' : ''}>
                                <SelectValue placeholder="Seleccionar contrato…" />
                            </SelectTrigger>
                            <SelectContent>
                                {contratos.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.numero_contrato}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Ubic ación */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-tinta-media">
                            Ubicación <span className="text-xs text-tinta-tenue">(opcional)</span>
                        </Label>
                        <Select value={ubicacionId} onValueChange={setUbicacionId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Sin ubicación específica" />
                            </SelectTrigger>
                            <SelectContent>
                                {ubicaciones.map((u) => (
                                    <SelectItem key={u.id} value={u.id}>
                                        {u.nombre}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Fecha */}
                    <div className="space-y-1.5">
                        <Label htmlFor="fecha_asig" className="text-sm font-medium text-tinta-media">
                            Fecha de asignación <span className="text-critico-tinta">*</span>
                        </Label>
                        <Input
                            id="fecha_asig"
                            type="date"
                            value={fecha}
                            onChange={(e) => setFecha(e.target.value)}
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <p className="rounded-md bg-critico-suave border border-critico-linea px-3 py-2 text-xs text-critico-tinta">
                            {error}
                        </p>
                    )}

                    {/* Éxito */}
                    {exito && (
                        <p className="rounded-md bg-ok-suave border border-ok-linea px-3 py-2 text-xs text-ok-tinta">
                            ✅ Equipo asignado correctamente. Actualizando…
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={isPending} className="text-tinta-media">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleGuardar}
                        disabled={isPending || exito}
                        className="bg-marca hover:bg-marca-fuerte text-white"
                    >
                        {isPending ? 'Asignando…' : 'Confirmar asignación'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
