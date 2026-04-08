'use client'

/**
 * /verificar-mfa/page.tsx
 *
 * Verificación de segundo factor en cada inicio de sesión.
 * El middleware redirige aquí cuando:
 *   - TOTP: nextLevel === 'aal2' (factor enrollado pero sesión en AAL1)
 *   - Email: mfa_configurado=true && mfa_metodo='email' && mfa_sesion_verificada=false
 *
 * En mount, detecta automáticamente el método del usuario y adapta la UI.
 * Para email, envía el OTP inmediatamente sin que el usuario tenga que pulsar nada.
 *
 * Al verificar con éxito:
 *   - TOTP → sesión eleva a AAL2, middleware lo detecta en la siguiente request.
 *   - Email → llama marcarSesionEmailVerificada(), middleware lee el flag.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter }                    from 'next/navigation'
import { Activity, ShieldCheck, AlertCircle, Smartphone, Mail } from 'lucide-react'
import { createClient }                 from '@/lib/supabase/client'
import { Button }                       from '@/components/ui/button'
import { Input }                        from '@/components/ui/input'
import { Label }                        from '@/components/ui/label'
import { marcarSesionEmailVerificada }  from '@/app/actions/mfa'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type Step = 'loading' | 'totp' | 'email' | 'done'

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export default function VerificarMfaPage() {
    const router   = useRouter()
    const supabase = createClient()

    const [step, setStep]           = useState<Step>('loading')
    const [userId, setUserId]       = useState<string>('')
    const [userEmail, setUserEmail] = useState<string>('')
    const [userRol, setUserRol]     = useState<string>('')
    const [totpFactorId, setTotpFactorId] = useState<string>('')

    const [code, setCode]     = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError]   = useState<string | null>(null)

    // Evitar doble envío de OTP en StrictMode (doble useEffect en dev)
    const emailOtpSentRef = useRef(false)

    // ── Detección de método en mount ─────────────────────────────────────────

    useEffect(() => {
        async function detectarMetodo() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.replace('/login'); return }

            setUserId(user.id)
            setUserEmail(user.email ?? '')
            setUserRol(user.user_metadata?.rol ?? '')

            // Verificar AAL — si nextLevel es 'aal2', el usuario tiene TOTP
            const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
            const nextLevel = aalData?.nextLevel ?? 'aal1'

            if (nextLevel === 'aal2') {
                // Obtener el factorId del factor TOTP verificado (enrolled)
                const { data: factors } = await supabase.auth.mfa.listFactors()
                const totp = factors?.totp?.find((f) => f.status === 'verified')
                if (!totp) {
                    // Factor inconsistente — enviar a configurar
                    router.replace('/configurar-mfa')
                    return
                }
                setTotpFactorId(totp.id)
                setStep('totp')
            } else {
                // Sin factor TOTP — es usuario email. Enviar OTP automáticamente.
                setStep('email')
                await enviarOtpEmail()
            }
        }

        detectarMetodo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Email: enviar OTP ────────────────────────────────────────────────────

    async function enviarOtpEmail() {
        if (emailOtpSentRef.current) return
        emailOtpSentRef.current = true

        try {
            const { error: reAuthErr } = await supabase.auth.reauthenticate()
            if (reAuthErr) {
                setError('No se pudo enviar el código. Intenta recargar la página.')
                emailOtpSentRef.current = false
            }
        } catch {
            setError('Error al enviar el código. Intenta recargar la página.')
            emailOtpSentRef.current = false
        }
    }

    async function reenviarOtp() {
        setError(null)
        setCode('')
        emailOtpSentRef.current = false
        await enviarOtpEmail()
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    function dashboardPath(rol: string) {
        return rol === 'administrador' ? '/admin/dashboard' : '/tecnico/dashboard'
    }

    // ── Verificar TOTP ───────────────────────────────────────────────────────

    async function verificarTotp(e: React.FormEvent) {
        e.preventDefault()
        if (code.length !== 6 || !totpFactorId) return
        setLoading(true)
        setError(null)
        try {
            const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
                factorId: totpFactorId,
                code:     code.trim(),
            })
            if (verifyErr) {
                setError('Código incorrecto. Verifica la hora de tu dispositivo e intenta de nuevo.')
                return
            }
            // Sesión ahora en AAL2 — el middleware lo detectará automáticamente.
            setStep('done')
            router.replace(dashboardPath(userRol))
        } catch {
            setError('Error inesperado. Intenta de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    // ── Verificar Email OTP ──────────────────────────────────────────────────

    async function verificarEmail(e: React.FormEvent) {
        e.preventDefault()
        if (code.trim().length < 6) return
        setLoading(true)
        setError(null)
        try {
            const { error: verifyErr } = await supabase.auth.verifyOtp({
                email: userEmail,
                token: code.trim(),
                type:  'reauthentication',
            })
            if (verifyErr) {
                setError('Código incorrecto o expirado. Solicita uno nuevo.')
                return
            }

            const { error: flagErr } = await marcarSesionEmailVerificada(userId)
            if (flagErr) throw new Error(flagErr)

            setStep('done')
            router.replace(dashboardPath(userRol))
        } catch {
            setError('Error al verificar. Intenta de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    const isTotp  = step === 'totp'
    const isEmail = step === 'email'

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-4">
            <div className="w-full max-w-sm">
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">

                    {/* Header */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E40AF] shadow-lg shadow-blue-900/40">
                            <Activity className="h-7 w-7 text-white" />
                        </div>
                        <h1 className="mt-4 text-xl font-bold text-white tracking-tight">Mobilhospital</h1>
                        <p className="mt-1 text-sm text-slate-400">Verificación en dos pasos</p>
                    </div>

                    {/* ── Loading ── */}
                    {step === 'loading' && (
                        <div className="flex flex-col items-center gap-3 py-6">
                            <span className="h-6 w-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                            <p className="text-xs text-slate-400">Preparando verificación…</p>
                        </div>
                    )}

                    {/* ── TOTP ── */}
                    {isTotp && (
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
                        </form>
                    )}

                    {/* ── Email OTP ── */}
                    {isEmail && (
                        <form onSubmit={verificarEmail} className="space-y-5">
                            <div className="flex flex-col items-center gap-2 mb-2">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1E3A5F]">
                                    <Mail className="h-5 w-5 text-[#60A5FA]" />
                                </div>
                                <p className="text-sm text-slate-300 text-center">
                                    Enviamos un código a{' '}
                                    <span className="text-white font-medium">{userEmail}</span>.
                                    Ingresa el código para continuar.
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="email-otp" className="text-xs font-medium text-slate-300">
                                    Código de verificación
                                </Label>
                                <Input
                                    id="email-otp"
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={8}
                                    autoComplete="one-time-code"
                                    autoFocus
                                    placeholder="000000"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                    className="h-12 text-center tracking-[0.5em] text-xl font-mono bg-white/10 border-white/15 text-white placeholder:text-slate-600 focus:border-[#3B82F6]"
                                />
                            </div>

                            <p className="text-center text-xs text-slate-500">
                                ¿No recibiste el código?{' '}
                                <button
                                    type="button"
                                    onClick={reenviarOtp}
                                    disabled={loading}
                                    className="text-[#60A5FA] hover:underline disabled:opacity-50"
                                >
                                    Reenviar
                                </button>
                            </p>

                            {error && <ErrorBanner message={error} />}

                            <Button
                                type="submit"
                                disabled={loading || code.trim().length < 6}
                                className="w-full h-11 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-semibold disabled:opacity-50"
                            >
                                {loading
                                    ? <Spinner />
                                    : <><ShieldCheck className="h-4 w-4 mr-1.5" />Verificar acceso</>
                                }
                            </Button>
                        </form>
                    )}

                    {/* ── Done (transitorio) ── */}
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

                <p className="mt-4 text-center text-xs text-slate-600">
                    Mobilhospital © {new Date().getFullYear()} · Acceso restringido
                </p>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

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
