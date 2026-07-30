'use client'

/**
 * src/components/seguridad/ResetPasswordButton.tsx
 *
 * Genera una contraseña temporal nueva para un usuario y la muestra una sola vez.
 * Se usa desde la ficha del técnico y desde el detalle de usuario en Seguridad.
 *
 * No toca el segundo factor: si la persona conserva su app autenticadora,
 * seguirá necesitándola. Para pérdida del dispositivo está el reset de MFA,
 * que es una acción aparte a propósito.
 */

import { useState } from 'react'
import { KeyRound, Copy, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { resetPasswordUsuario } from '@/app/actions/seguridad/usuarios'

interface Props {
    /** auth.users.id de la persona */
    userId: string
    /** Nombre completo, para el texto de confirmación */
    nombre: string
    className?: string
}

export default function ResetPasswordButton({ userId, nombre, className }: Props) {
    const [abierto, setAbierto] = useState(false)
    const [procesando, setProcesando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [password, setPassword] = useState<string | null>(null)
    const [copiado, setCopiado] = useState(false)

    function cerrar() {
        setAbierto(false)
        setPassword(null)
        setError(null)
        setCopiado(false)
    }

    async function handleReset() {
        setProcesando(true)
        setError(null)

        const { data, error: err } = await resetPasswordUsuario(userId)

        setProcesando(false)

        if (err || !data) {
            setError(err ?? 'No se pudo generar la contraseña.')
            return
        }

        setPassword(data.passwordTemporal)
    }

    async function copiar() {
        if (!password) return
        await navigator.clipboard.writeText(password)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2000)
    }

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setAbierto(true)}
                disabled={!userId}
                className={className ?? 'border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC]'}
            >
                <KeyRound className="h-4 w-4 mr-1.5" />
                Resetear contraseña
            </Button>

            <Dialog open={abierto} onOpenChange={(v) => (v ? setAbierto(true) : cerrar())}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle className="text-[#0F172A]">
                            {password ? 'Contraseña generada' : 'Resetear contraseña'}
                        </DialogTitle>
                    </DialogHeader>

                    {password ? (
                        <div className="space-y-4 py-2">
                            <p className="text-sm text-[#475569]">
                                Entrega esta contraseña a{' '}
                                <span className="font-medium text-[#0F172A]">{nombre}</span>.
                                La anterior dejó de funcionar.
                            </p>

                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 rounded border border-amber-200 bg-white px-3 py-2 text-sm font-mono text-[#0F172A] break-all">
                                        {password}
                                    </code>
                                    <button
                                        type="button"
                                        onClick={copiar}
                                        className="shrink-0 rounded border border-amber-200 bg-white p-2 text-amber-700 hover:bg-amber-100"
                                        title="Copiar"
                                    >
                                        {copiado
                                            ? <Check className="h-4 w-4 text-green-600" />
                                            : <Copy className="h-4 w-4" />}
                                    </button>
                                </div>
                                <p className="text-[11px] text-amber-800 mt-2 leading-relaxed">
                                    Cópiala ahora: no vuelve a mostrarse.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 py-2">
                            <p className="text-sm text-[#475569]">
                                Se generará una contraseña temporal nueva para{' '}
                                <span className="font-medium text-[#0F172A]">{nombre}</span> y la
                                actual dejará de funcionar.
                            </p>
                            <p className="text-xs text-[#94A3B8] leading-relaxed">
                                Su verificación en dos pasos no se modifica: seguirá necesitando su
                                app autenticadora para entrar.
                            </p>

                            {error && (
                                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-700">{error}</p>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        {password ? (
                            <Button onClick={cerrar} className="bg-[#1E40AF] hover:bg-[#1D4ED8]">
                                Entendido
                            </Button>
                        ) : (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={cerrar}
                                    className="border-[#E2E8F0] text-[#475569]"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleReset}
                                    disabled={procesando}
                                    className="bg-[#1E40AF] hover:bg-[#1D4ED8]"
                                >
                                    {procesando ? 'Generando...' : 'Generar contraseña'}
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
