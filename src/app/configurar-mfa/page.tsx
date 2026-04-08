'use client'

/**
 * /configurar-mfa/page.tsx
 *
 * Flujo de configuración inicial de MFA obligatorio.
 * El middleware redirige aquí cuando mfa_configurado = false.
 *
 * Pasos:
 *   1. "Elige tu método" — TOTP o Email OTP
 *   2a. TOTP  → enroll → QR + secret → verify code → guardar
 *   2b. Email → reauthenticate (envía OTP) → input OTP → verify → guardar
 *
 * Al completar con éxito, el usuario es redirigido a su dashboard.
 * El middleware no volverá a interceptar porque mfa_configurado=true y
 * (para TOTP) AAL2 activo o (para email) mfa_sesion_verificada=true.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Activity, ShieldCheck, Mail, Smartphone, AlertCircle, Copy, Check, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { guardarMfaConfigurado, marcarSesionEmailVerificada } from '@/app/actions/mfa'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos
// ─────────────────────────────────────────────────────────────────────────────

type Step =
    | 'loading'       // cargando sesión
    | 'choose'        // elegir método
    | 'setup-totp'    // mostrar QR + input
    | 'setup-email'   // input OTP enviado por email
    | 'done'          // completado — redirigiendo

interface TotpEnrollData {
    factorId: string
    qrCode: string   // data URL (SVG)
    secret: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export default function ConfigurarMfaPage() {
    const router = useRouter()
    const supabase = createClient()

    const [step, setStep] = useState<Step>('loading')
    const [userId, setUserId] = useState<string>('')
    const [userEmail, setUserEmail] = useState<string>('')
    const [userRol, setUserRol] = useState<string>('')

    // TOTP
    const [totpData, setTotpData] = useState<TotpEnrollData | null>(null)
    const [totpCode, setTotpCode] = useState('')
    const [secretCopied, setSecretCopied] = useState(false)

    // Email
    const [emailOtp, setEmailOtp] = useState('')

    // Estado compartido
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [esBienvenida, setEsBienvenida] = useState(false)

    // ── Cargar sesión ────────────────────────────────────────────────────────

    useEffect(() => {
        // Leer ?bienvenida=1 directamente del location para evitar Suspense wrapper
        const params = new URLSearchParams(window.location.search)
        setEsBienvenida(params.get('bienvenida') === '1')

        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) { router.replace('/login'); return }
            setUserId(user.id)
            setUserEmail(user.email ?? '')
            setUserRol(user.user_metadata?.rol ?? '')
            setStep('choose')
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Helpers ──────────────────────────────────────────────────────────────

    function dashboardPath(rol: string) {
        return rol === 'administrador' ? '/admin/dashboard' : '/tecnico/dashboard'
    }

    async function limpiarFactoresTotp() {
        // Elimina factores TOTP sin verificar que puedan quedar de intentos previos.
        const { data } = await supabase.auth.mfa.listFactors()
        const unverified = (data?.totp ?? []).filter((f) => f.status !== 'verified')
        await Promise.all(
            unverified.map((f) => supabase.auth.mfa.unenroll({ factorId: f.id }))
        )
    }

    // ── TOTP: iniciar enrollment ─────────────────────────────────────────────

    async function iniciarTotp() {
        setLoading(true)
        setError(null)
        try {
            await limpiarFactoresTotp()

            const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
                issuer: 'Mobilhospital',
                friendlyName: userEmail,
            })
            if (enrollErr || !data) throw enrollErr ?? new Error('enroll vacío')

            setTotpData({
                factorId: data.id,
                qrCode: data.totp.qr_code,
                secret: data.totp.secret,
            })
            setTotpCode('')
            setStep('setup-totp')
        } catch (err) {
            console.error('[iniciarTotp]', err)
            setError('No se pudo iniciar la configuración TOTP. Intenta de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    // ── TOTP: verificar código ───────────────────────────────────────────────

    async function verificarTotp(e: React.FormEvent) {
        e.preventDefault()
        if (!totpData || totpCode.length !== 6) return
        setLoading(true)
        setError(null)
        try {
            const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
                factorId: totpData.factorId,
                code: totpCode.trim(),
            })
            if (verifyErr) {
                setError('Código incorrecto. Verifica la hora de tu dispositivo e intenta de nuevo.')
                return
            }

            const { error: saveErr } = await guardarMfaConfigurado(userId, 'totp')
            if (saveErr) throw new Error(saveErr)

            setStep('done')
            router.replace(dashboardPath(userRol))
        } catch (err) {
            console.error('[verificarTotp]', err)
            setError('Error al guardar la configuración. Intenta de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    // ── Email: enviar OTP ────────────────────────────────────────────────────

    async function iniciarEmail() {
        setLoading(true)
        setError(null)
        try {
            // reauthenticate() envía un OTP al email del usuario autenticado.
            const { error: reAuthErr } = await supabase.auth.reauthenticate()
            if (reAuthErr) throw reAuthErr

            setEmailOtp('')
            setStep('setup-email')
        } catch (err) {
            console.error('[iniciarEmail]', err)
            setError('No se pudo enviar el código por correo. Intenta de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    // ── Email: verificar OTP ─────────────────────────────────────────────────

    async function verificarEmail(e: React.FormEvent) {
        e.preventDefault()
        if (emailOtp.trim().length < 6) return
        setLoading(true)
        setError(null)
        try {
            const { error: verifyErr } = await supabase.auth.verifyOtp({
                email: userEmail,
                token: emailOtp.trim(),
                type: 'email',
            })
            if (verifyErr) {
                setError('Código incorrecto o expirado. Solicita uno nuevo.')
                return
            }

            const { error: saveErr } = await guardarMfaConfigurado(userId, 'email')
            if (saveErr) throw new Error(saveErr)

            // marcarSesionEmailVerificada ya la llama guardarMfaConfigurado internamente,
            // pero la llamamos explícitamente para ser explícitos sobre el flag de sesión.
            await marcarSesionEmailVerificada(userId)

            setStep('done')
            router.replace(dashboardPath(userRol))
        } catch (err) {
            console.error('[verificarEmail]', err)
            setError('Error al verificar. Intenta de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    // ── Copiar secret al portapapeles ────────────────────────────────────────

    async function copiarSecret() {
        if (!totpData) return
        await navigator.clipboard.writeText(totpData.secret)
        setSecretCopied(true)
        setTimeout(() => setSecretCopied(false), 2000)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-4">
            <div className="w-full max-w-md">
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">

                    {/* Header siempre visible */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E40AF] shadow-lg shadow-blue-900/40">
                            <Activity className="h-7 w-7 text-white" />
                        </div>
                        <h1 className="mt-4 text-xl font-bold text-white tracking-tight">Mobilhospital</h1>
                        <p className="mt-1 text-sm text-slate-400">Configuración de verificación en dos pasos</p>
                    </div>

                    {/* ── Loading ── */}
                    {step === 'loading' && (
                        <div className="flex justify-center py-8">
                            <span className="h-6 w-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                        </div>
                    )}

                    {/* ── Elegir método ── */}
                    {step === 'choose' && (
                        <div className="space-y-4">
                            {/* Banner de bienvenida — solo para técnicos que vienen de invitación */}
                            {esBienvenida && (
                                <div className="flex items-start gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 mb-2">
                                    <Sparkles className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-white">Bienvenido a Mobilhospital</p>
                                        <p className="text-xs text-slate-300 mt-0.5">
                                            Tu cuenta está lista. Elige cómo quieres proteger tu acceso
                                            y podrás empezar a trabajar de inmediato.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <p className="text-sm text-slate-300 text-center mb-6">
                                Por seguridad, debes configurar una segunda forma de verificación
                                para acceder al sistema.
                            </p>

                            {/* Opción TOTP */}
                            <button
                                onClick={iniciarTotp}
                                disabled={loading}
                                className="w-full flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#3B82F6]/50 p-4 text-left transition-all disabled:opacity-50"
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1E3A5F]">
                                    <Smartphone className="h-5 w-5 text-[#60A5FA]" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">App autenticadora (recomendado)</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Google Authenticator, Authy, Microsoft Authenticator u otra app TOTP.
                                        Genera códigos sin conexión a internet.
                                    </p>
                                </div>
                            </button>

                            {/* Opción Email */}
                            <button
                                onClick={iniciarEmail}
                                disabled={loading}
                                className="w-full flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#3B82F6]/50 p-4 text-left transition-all disabled:opacity-50"
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1E3A5F]">
                                    <Mail className="h-5 w-5 text-[#60A5FA]" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">Código por correo electrónico</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Recibirás un código de un solo uso en {userEmail || 'tu correo'}.
                                        Requiere acceso a tu bandeja de entrada.
                                    </p>
                                </div>
                            </button>

                            {loading && (
                                <div className="flex justify-center pt-2">
                                    <span className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Setup TOTP ── */}
                    {step === 'setup-totp' && totpData && (
                        <form onSubmit={verificarTotp} className="space-y-5">
                            <div className="text-center space-y-1 mb-2">
                                <p className="text-sm font-semibold text-white">
                                    Escanea el código QR con tu app
                                </p>
                                <p className="text-xs text-slate-400">
                                    Abre tu app autenticadora, toca &quot;Añadir cuenta&quot; y escanea:
                                </p>
                            </div>

                            {/* QR */}
                            <div className="flex justify-center">
                                <div className="rounded-xl bg-white p-3">
                                    <Image
                                        src={totpData.qrCode}
                                        alt="Código QR TOTP"
                                        width={180}
                                        height={180}
                                        unoptimized
                                    />
                                </div>
                            </div>

                            {/* Secret manual */}
                            <div className="space-y-1.5">
                                <p className="text-xs text-slate-400 text-center">
                                    ¿No puedes escanear? Ingresa esta clave manualmente:
                                </p>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-mono text-slate-200 tracking-widest overflow-x-auto">
                                        {totpData.secret}
                                    </code>
                                    <button
                                        type="button"
                                        onClick={copiarSecret}
                                        className="shrink-0 rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white transition-colors"
                                        aria-label="Copiar clave"
                                    >
                                        {secretCopied
                                            ? <Check className="h-4 w-4 text-green-400" />
                                            : <Copy className="h-4 w-4" />
                                        }
                                    </button>
                                </div>
                            </div>

                            {/* Input código */}
                            <div className="space-y-1.5">
                                <Label htmlFor="totp-code" className="text-xs font-medium text-slate-300">
                                    Ingresa el código de 6 dígitos
                                </Label>
                                <Input
                                    id="totp-code"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="\d{6}"
                                    maxLength={6}
                                    autoComplete="one-time-code"
                                    placeholder="000000"
                                    value={totpCode}
                                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                                    className="h-11 text-center tracking-[0.4em] text-lg font-mono bg-white/10 border-white/15 text-white placeholder:text-slate-500 focus:border-[#3B82F6]"
                                />
                            </div>

                            {error && <ErrorBanner message={error} />}

                            <div className="flex gap-3 pt-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => { setStep('choose'); setError(null) }}
                                    disabled={loading}
                                    className="flex-1 h-11 border-white/15 text-slate-300 hover:bg-white/10 bg-transparent"
                                >
                                    Atrás
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={loading || totpCode.length !== 6}
                                    className="flex-1 h-11 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-semibold disabled:opacity-50"
                                >
                                    {loading
                                        ? <Spinner />
                                        : <><ShieldCheck className="h-4 w-4 mr-1.5" />Verificar</>
                                    }
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* ── Setup Email ── */}
                    {step === 'setup-email' && (
                        <form onSubmit={verificarEmail} className="space-y-5">
                            <div className="text-center space-y-1 mb-2">
                                <p className="text-sm font-semibold text-white">Revisa tu correo</p>
                                <p className="text-xs text-slate-400">
                                    Enviamos un código de verificación a{' '}
                                    <span className="text-slate-200 font-medium">{userEmail}</span>.
                                    Ingresa el código a continuación.
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
                                    placeholder="000000"
                                    value={emailOtp}
                                    onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                                    className="h-11 text-center tracking-[0.4em] text-lg font-mono bg-white/10 border-white/15 text-white placeholder:text-slate-500 focus:border-[#3B82F6]"
                                />
                            </div>

                            <p className="text-center text-xs text-slate-500">
                                ¿No recibiste el código?{' '}
                                <button
                                    type="button"
                                    onClick={iniciarEmail}
                                    disabled={loading}
                                    className="text-[#60A5FA] hover:underline disabled:opacity-50"
                                >
                                    Reenviar
                                </button>
                            </p>

                            {error && <ErrorBanner message={error} />}

                            <div className="flex gap-3 pt-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => { setStep('choose'); setError(null) }}
                                    disabled={loading}
                                    className="flex-1 h-11 border-white/15 text-slate-300 hover:bg-white/10 bg-transparent"
                                >
                                    Atrás
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={loading || emailOtp.trim().length < 6}
                                    className="flex-1 h-11 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-semibold disabled:opacity-50"
                                >
                                    {loading ? <Spinner /> : <><ShieldCheck className="h-4 w-4 mr-1.5" />Verificar</>}
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* ── Done (transitorio) ── */}
                    {step === 'done' && (
                        <div className="flex flex-col items-center gap-3 py-6">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20">
                                <ShieldCheck className="h-7 w-7 text-green-400" />
                            </div>
                            <p className="text-sm font-semibold text-white">¡MFA configurado!</p>
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
// Sub-componentes pequeños
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
