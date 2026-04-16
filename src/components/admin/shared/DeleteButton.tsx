'use client'

/**
 * src/components/admin/shared/DeleteButton.tsx
 * Botón reutilizable de desactivación (soft delete) con diálogo de confirmación.
 * NUNCA elimina físicamente — siempre activo = false.
 * Si la operación falla por dependencias activas, muestra el error en el propio diálogo.
 */

import { useState } from 'react'
import { Trash2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    /** Action de desactivación — debe retornar { error: string | null } */
    onDesactivar: () => Promise<{ error: string | null }>
    /** Callback después de desactivar exitosamente */
    onExito?: () => void
    /** Texto del aria-label y title del botón */
    label?: string
    disabled?: boolean
}

export default function DeleteButton({
    nombreRegistro,
    onDesactivar,
    onExito,
    label = 'Desactivar',
    disabled = false,
}: DeleteButtonProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    function abrir() {
        setError(null)
        setOpen(true)
    }

    function cerrar() {
        if (loading) return
        setOpen(false)
        setError(null)
    }

    async function handleConfirm() {
        setLoading(true)
        setError(null)
        const { error: err } = await onDesactivar()
        setLoading(false)

        if (err) {
            setError(err)
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
                className="h-8 w-8 p-0 text-[#94A3B8] hover:text-red-600 hover:bg-red-50"
                aria-label={`${label}: ${nombreRegistro}`}
                title={label}
            >
                <Trash2 className="h-4 w-4" />
            </Button>

            <Dialog open={open} onOpenChange={(o) => !o && cerrar()}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-[#0F172A]">
                            ¿Desactivar este registro?
                        </DialogTitle>
                        <DialogDescription className="text-[#94A3B8]">
                            Vas a desactivar{' '}
                            <strong className="text-[#334155]">{nombreRegistro}</strong>.
                            El registro quedará inactivo y podrás reactivarlo desde el formulario de edición.
                            Si tiene dependencias activas, la operación será bloqueada.
                        </DialogDescription>
                    </DialogHeader>

                    {error && (
                        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>{error}</span>
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
                            disabled={loading}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {loading ? 'Desactivando…' : 'Sí, desactivar'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
