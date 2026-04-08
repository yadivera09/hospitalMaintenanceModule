'use client'

import { useState, useRef, useTransition } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { firmarComoCliente } from '@/app/actions/reportes'
import { PenTool, CheckCircle2, RotateCcw } from 'lucide-react'

interface FirmaClienteModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    reporteId: string
    onSigned: () => void
}

export default function FirmaClienteModal({ isOpen, onOpenChange, reporteId, onSigned }: FirmaClienteModalProps) {
    const padRef = useRef<SignatureCanvas>(null)
    const [nombre, setNombre] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function limpiarFirma() {
        padRef.current?.clear()
        setError(null)
    }

    async function handleFirmar() {
        setError(null)
        const nameTrm = nombre.trim()

        if (!nameTrm) {
            setError('Debe ingresar el nombre del firmante.')
            return
        }
        if (padRef.current?.isEmpty()) {
            setError('La firma no puede estar vacía.')
            return
        }

        const firmaBase64 = padRef.current?.getTrimmedCanvas().toDataURL('image/png')
        if (!firmaBase64) return

        startTransition(async () => {
            const { error: srvErr } = await firmarComoCliente({
                reporte_id: reporteId,
                nombre: nameTrm,
                firma_base64: firmaBase64
            })

            if (srvErr) {
                setError(srvErr)
            } else {
                onOpenChange(false)
                onSigned()
            }
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <PenTool className="h-5 w-5 text-[#1E40AF]" />
                        Firma del Cliente
                    </DialogTitle>
                    <DialogDescription>
                        Ingrese el nombre del responsable en sitio de recibir el equipo y trace la firma digital para cerrar el reporte.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Error */}
                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    {/* Nombre */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-[#334155]">Nombre del firmante <span className="text-red-500">*</span></label>
                        <Input
                            placeholder="Ej. Dr. Juan Pérez"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            disabled={isPending}
                        />
                    </div>

                    {/* Canvas */}
                    <div className="space-y-1.5 w-full">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-[#334155]">Firma <span className="text-red-500">*</span></label>
                            <button
                                type="button"
                                onClick={limpiarFirma}
                                disabled={isPending}
                                className="text-xs text-[#1E40AF] hover:underline flex items-center gap-1"
                            >
                                <RotateCcw className="h-3 w-3" /> Limpiar
                            </button>
                        </div>
                        <div className="rounded-lg border-2 border-dashed border-[#CBD5E1] bg-slate-50 overflow-hidden touch-none relative h-40">
                            <SignatureCanvas
                                ref={padRef}
                                canvasProps={{
                                    className: 'absolute top-0 left-0 w-full h-full cursor-crosshair touch-none',
                                    style: { width: '100%', height: '100%' }
                                }}
                                backgroundColor="rgba(255, 255, 255, 1)"
                                penColor="#0F172A"
                                minWidth={1.5}
                                maxWidth={3}
                                velocityFilterWeight={0.7}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                            Cancelar
                        </Button>
                        <Button onClick={handleFirmar} disabled={isPending} className="bg-green-600 hover:bg-green-700 text-white gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            {isPending ? 'Confirmando...' : 'Confirmar Firma'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
