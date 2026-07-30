'use client'

/**
 * src/app/verificar-mfa/page.tsx
 * Verificación del segundo factor en cada sesión nueva. Único método: TOTP.
 *
 * Antes, si no detectaba un factor TOTP verificado, caía a un flujo de código
 * por correo que ya no se ofrecía en /configurar-mfa: enviaba el OTP a un buzón
 * que podía no existir y el usuario quedaba encerrado. Ahora ese caso manda a
 * /configurar-mfa, que limpia los factores sueltos y permite enrolar de nuevo.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, ShieldCheck, AlertCircle, Smartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getDestinoPostLogin } from '@/app/actions/seguridad/sesion'
import SalirDelFlujoMfa from '@/components/seguridad/SalirDelFlujoMfa'

type Step = 'loading' | 'totp' | 'done'

export default function VerificarMfaPage() {
    const router = useRouter()
    const supabase = createClient()

    const [step, setStep] = useState<Step>('loading')
    const [totpFactorId, setTotpFactorId] = useState<string>('')

    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function detectarFactor() {
            const [
                { data: { user } },
                { data: factors }
            ] = await Promise.all([
                supabase.auth.getUser(),
                supabase.auth.mfa.listFactors()
            ])

            if (!user) { router.replace('/login'); return }

            const totp = factors?.totp?.find((f) => f.status === 'verified')

            // Sin factor verificado no hay nada que verificar aquí: el
            // enrolamiento se hace en /configurar-mfa, que además limpia
            // los factores a medio configurar.
            if (!totp) {
                router.replace('/configurar-mfa')
                return
            }

            setTotpFactorId(totp.id)
            setStep('totp')
        }

        detectarFactor()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    /**
     * Destino tras verificar el segundo factor. Se resuelve en el servidor
     * contra usuario_roles. Si falla, el middleware corrige el destino igual.
     */
    async function dashboardPath() {
        const { destino } = await getDestinoPostLogin()
        return destino ?? '/tecnico/dashboard'
    }

    async function verificarTotp(e: React.FormEvent) {
        e.preventDefault()
        if (code.length !== 6 || !totpFactorId) return
        setLoading(true)
        setError(null)
        try {
            const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
                factorId: totpFactorId,
                code: code.trim(),
            })
            if (verifyErr) {
                setError('Código incorrecto. Verifica la hora de tu dispositivo e intenta de nuevo.')
                return
            }

            // ✅ CRÍTICO: esperar a que Supabase actualice las cookies de sesión
            // antes de navegar, para que el middleware lea AAL2 correctamente.
            await supabase.auth.getSession()

            const destino = await dashboardPath()
            setStep('done')

            // ✅ window.location fuerza un request fresco con las cookies nuevas
            window.location.href = destino

        } catch {
            setError('Error inesperado. Intenta de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-4">
            <div className="w-full max-w-sm">
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">

                    <div className="flex flex-col items-center mb-8">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E40AF] shadow-lg shadow-blue-900/40">
                            <Activity className="h-7 w-7 text-white" />
                        </div>
                        <h1 className="mt-4 text-xl font-bold text-white tracking-tight">Mobilhospital</h1>
                        <p className="mt-1 text-sm text-slate-400">Verificación en dos pasos</p>
                    </div>

                    {step === 'loading' && (
                        <div className="flex flex-col items-center gap-3 py-6">
                            <span className="h-6 w-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                            <p className="text-xs text-slate-400">Preparando verificación…</p>
                        </div>
                    )}

                    {step === 'totp' && (
                        <form onSubmit={verificarTotp} className="space-y-5">
                            <div className="flex flex-col items-center gap-2 mb-2">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1E3A5F]">
                                    <Smartphone className="h-5 w-5 text-[#60A5FA]" />
                                </div>
                                <p className="text-sm text-slate-300 text-center">
                                    Abre tu app autenticadora e ingresa el código de 6 dígitos.
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="totp-code" className="text-xs font-medium text-slate-300">
                                    Código de verificación
                                </Label>
                                <Input
                                    id="totp-code"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="\d{6}"
                                    maxLength={6}
                                    autoComplete="one-time-code"
                                    autoFocus
                                    placeholder="000000"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                    className="h-12 text-center tracking-[0.5em] text-xl font-mono bg-white/10 border-white/15 text-white placeholder:text-slate-600 focus:border-[#3B82F6]"
                                />
                            </div>

                            {error && <ErrorBanner message={error} />}

                            <Button
                                type="submit"
                                disabled={loading || code.length !== 6}
                                className="w-full h-11 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-semibold disabled:opacity-50"
                            >
                                {loading
                                    ? <Spinner />
                                    : <><ShieldCheck className="h-4 w-4 mr-1.5" />Verificar acceso</>
                                }
                            </Button>

                            <p className="text-center text-[11px] text-slate-500 leading-relaxed">
                                ¿Perdiste el acceso a tu app autenticadora?
                                <br />
                                Pide a un administrador que resetee tu verificación en dos pasos.
                            </p>
                        </form>
                    )}

                    {step === 'done' && (
                        <div className="flex flex-col items-center gap-3 py-6">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20">
                                <ShieldCheck className="h-7 w-7 text-green-400" />
                            </div>
                            <p className="text-sm font-semibold text-white">Identidad verificada</p>
                            <p className="text-xs text-slate-400">Redirigiendo a tu panel…</p>
                        </div>
                    )}
                </div>

                {step !== 'done' && <SalirDelFlujoMfa />}

                <p className="mt-4 text-center text-xs text-slate-600">
                    Mobilhospital © {new Date().getFullYear()} · Acceso restringido
                </p>
            </div>
        </div>
    )
}

function ErrorBanner({ message }: { message: string }) {
    return (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{message}</p>
        </div>
    )
}

function Spinner() {
    return <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
}
