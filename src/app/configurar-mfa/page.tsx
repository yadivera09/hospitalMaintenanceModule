'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Activity, ShieldCheck, Mail, Smartphone, AlertCircle, Copy, Check, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { guardarMfaConfigurado, marcarSesionEmailVerificada } from '@/app/actions/mfa'

type Step = 'loading' | 'choose' | 'setup-totp' | 'setup-email' | 'done'

interface TotpEnrollData {
    factorId: string
    qrCode: string
    secret: string
}

export default function ConfigurarMfaPage() {
    const router = useRouter()
    const supabase = createClient()

    const [step, setStep] = useState<Step>('loading')
    const [userId, setUserId] = useState<string>('')
    const [userEmail, setUserEmail] = useState<string>('')
    const [userRol, setUserRol] = useState<string>('')

    const [totpData, setTotpData] = useState<TotpEnrollData | null>(null)
    const [totpCode, setTotpCode] = useState('')
    const [secretCopied, setSecretCopied] = useState(false)
    const [emailOtp, setEmailOtp] = useState('')
    const [emailSent, setEmailSent] = useState(false)
    const [countdown, setCountdown] = useState(0)

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [esBienvenida, setEsBienvenida] = useState(false)

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        setEsBienvenida(params.get('bienvenida') === '1')

        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) { router.replace('/login'); return }
            setUserId(user.id)
            setUserEmail(user.email ?? '')
            setUserRol(user.user_metadata?.rol ?? '')
            setStep('choose')
        })
    }, [router, supabase.auth])

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
            return () => clearTimeout(timer)
        }
    }, [countdown])

    function dashboardPath(rol: string) {
        return rol === 'administrador' ? '/admin/dashboard' : '/tecnico/dashboard'
    }

    async function limpiarFactoresTotpExistentes() {
        const { data: factors } = await supabase.auth.mfa.listFactors()
        const existingFactors = factors?.totp ?? []

        for (const factor of existingFactors) {
            if (factor.status !== 'verified') {
                console.log('[limpiar] Eliminando factor no verificado:', factor.friendly_name)
                await supabase.auth.mfa.unenroll({ factorId: factor.id })
            }
        }
        return existingFactors.filter(f => f.status === 'verified').length
    }

    async function iniciarTotp() {
        setLoading(true)
        setError(null)
        try {
            await limpiarFactoresTotpExistentes()
            const uniqueName = `${userEmail}_${Date.now()}`

            const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
                issuer: 'Mobilhospital',
                friendlyName: uniqueName,
            })

            if (enrollErr) throw enrollErr
            if (!data) throw new Error('No se pudo generar el código QR')

            setTotpData({
                factorId: data.id,
                qrCode: data.totp.qr_code,
                secret: data.totp.secret,
            })
            setTotpCode('')
            setStep('setup-totp')
        } catch (err: any) {
            console.error('[iniciarTotp]', err)
            if (err.message?.includes('already exists')) {
                setError('Ya tienes una configuración pendiente. Recarga la página.')
            } else {
                setError('No se pudo iniciar la configuración TOTP. Intenta de nuevo.')
            }
        } finally {
            setLoading(false)
        }
    }

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
            if (verifyErr) throw verifyErr

            // ✅ CRÍTICO: Guardar en DB y forzar refresh de sesión
            await guardarMfaConfigurado(userId, 'totp')

            // ✅ Esperar a que Supabase actualice las cookies
            await supabase.auth.getSession()

            setStep('done')

            // ✅ Usar window.location para forzar recarga completa
            // Esto asegura que el middleware lea las cookies frescas
            setTimeout(() => {
                window.location.href = dashboardPath(userRol)
            }, 500)

        } catch (err: any) {
            console.error('[verificarTotp]', err)
            setError(err.message || 'Código incorrecto. Verifica la hora de tu dispositivo.')
        } finally {
            setLoading(false)
        }
    }

    async function iniciarEmail() {
        if (countdown > 0) {
            setError(`Espera ${countdown} segundos antes de solicitar otro código`)
            return
        }

        setLoading(true)
        setError(null)
        setEmailSent(false)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                throw new Error('No hay sesión activa. Recarga la página.')
            }

            console.log('[iniciarEmail] Enviando OTP a:', userEmail)

            const { error: reauthErr } = await supabase.auth.reauthenticate()

            if (reauthErr) {
                console.error('[iniciarEmail] Error reauthenticate:', reauthErr)

                const { error: otpErr } = await supabase.auth.signInWithOtp({
                    email: userEmail,
                    options: {
                        shouldCreateUser: false,
                    }
                })

                if (otpErr) {
                    if (otpErr.message?.includes('rate limit')) {
                        setCountdown(60)
                        throw new Error('Límite de envíos excedido. Espera 1 minuto.')
                    }
                    throw otpErr
                }
            }

            console.log('[iniciarEmail] Código enviado exitosamente')
            setEmailSent(true)
            setCountdown(30)
            setStep('setup-email')

        } catch (err: any) {
            console.error('[iniciarEmail]', err)
            setError(err.message || 'No se pudo enviar el código. Usa la app autenticadora.')
        } finally {
            setLoading(false)
        }
    }

    async function verificarEmail(e: React.FormEvent) {
        e.preventDefault()
        if (emailOtp.trim().length < 6) return

        setLoading(true)
        setError(null)

        try {
            console.log('[verificarEmail] Verificando código para:', userEmail)

            const { error: verifyErr } = await supabase.auth.verifyOtp({
                email: userEmail,
                token: emailOtp.trim(),
                type: 'email',
            })

            if (verifyErr) {
                console.error('[verificarEmail] Error:', verifyErr)
                throw verifyErr
            }

            console.log('[verificarEmail] Código verificado correctamente')

            const { error: saveErr } = await guardarMfaConfigurado(userId, 'email')
            if (saveErr) throw new Error(saveErr)

            await marcarSesionEmailVerificada(userId)

            // ✅ Forzar refresh de sesión
            await supabase.auth.getSession()

            setStep('done')

            // ✅ Usar window.location para navegación forzada
            setTimeout(() => {
                window.location.href = dashboardPath(userRol)
            }, 500)

        } catch (err: any) {
            console.error('[verificarEmail]', err)
            setError(err.message || 'Código incorrecto o expirado.')
        } finally {
            setLoading(false)
        }
    }

    async function copiarSecret() {
        if (!totpData) return
        await navigator.clipboard.writeText(totpData.secret)
        setSecretCopied(true)
        setTimeout(() => setSecretCopied(false), 2000)
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-4">
            <div className="w-full max-w-md">
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
                    <div className="flex flex-col items-center mb-8">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E40AF] shadow-lg shadow-blue-900/40">
                            <Activity className="h-7 w-7 text-white" />
                        </div>
                        <h1 className="mt-4 text-xl font-bold text-white tracking-tight">Mobilhospital</h1>
                        <p className="mt-1 text-sm text-slate-400">Configuración de verificación en dos pasos</p>
                    </div>

                    {step === 'loading' && (
                        <div className="flex justify-center py-8">
                            <span className="h-6 w-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                        </div>
                    )}

                    {step === 'choose' && (
                        <div className="space-y-4">
                            {esBienvenida && (
                                <div className="flex items-start gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 mb-2">
                                    <Sparkles className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-white">Bienvenido a Mobilhospital</p>
                                        <p className="text-xs text-slate-300 mt-0.5">
                                            Tu cuenta está lista. Elige cómo quieres proteger tu acceso.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <p className="text-sm text-slate-300 text-center mb-6">
                                Por seguridad, debes configurar una segunda forma de verificación.
                            </p>

                            <button
                                onClick={iniciarTotp}
                                disabled={loading || !userId}
                                className="w-full flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#3B82F6]/50 p-4 text-left transition-all disabled:opacity-50"
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1E3A5F]">
                                    <Smartphone className="h-5 w-5 text-[#60A5FA]" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">App autenticadora</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Google Authenticator, Microsoft Authenticator u otra app TOTP.
                                    </p>
                                </div>
                            </button>

                            {false && (
                                <button
                                    onClick={iniciarEmail}
                                    disabled={loading || !userId}
                                    className="w-full flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#3B82F6]/50 p-4 text-left transition-all disabled:opacity-50"
                                >
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1E3A5F]">
                                        <Mail className="h-5 w-5 text-[#60A5FA]" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-white">Código por correo electrónico</p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Recibirás un código en {userEmail || 'tu correo'}.
                                        </p>
                                    </div>
                                </button>
                            )}

                            {loading && (
                                <div className="flex justify-center pt-2">
                                    <span className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'setup-totp' && totpData && (
                        <form onSubmit={verificarTotp} className="space-y-5">
                            <div className="text-center space-y-1 mb-2">
                                <p className="text-sm font-semibold text-white">Escanea el código QR</p>
                                <p className="text-xs text-slate-400">Abre tu app autenticadora y escanea:</p>
                            </div>

                            <div className="flex justify-center">
                                <div className="rounded-xl bg-white p-3">
                                    <Image
                                        src={totpData.qrCode}
                                        alt="QR Code"
                                        width={180}
                                        height={180}
                                        unoptimized
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <p className="text-xs text-slate-400 text-center">O ingresa esta clave manualmente:</p>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-mono text-slate-200 break-all">
                                        {totpData.secret}
                                    </code>
                                    <button
                                        type="button"
                                        onClick={copiarSecret}
                                        className="shrink-0 rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white"
                                    >
                                        {secretCopied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-300">Código de 6 dígitos</Label>
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="000000"
                                    value={totpCode}
                                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                                    className="h-11 text-center text-lg font-mono bg-white/10 border-white/15 text-white"
                                    autoFocus
                                />
                            </div>

                            {error && <ErrorBanner message={error} />}

                            <div className="flex gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => { setStep('choose'); setError(null) }}
                                    className="flex-1 border-white/15 text-slate-300 hover:bg-white/10"
                                >
                                    Atrás
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={loading || totpCode.length !== 6}
                                    className="flex-1 bg-[#1E40AF] hover:bg-[#1D4ED8]"
                                >
                                    {loading ? <Spinner /> : "Verificar"}
                                </Button>
                            </div>
                        </form>
                    )}

                    {step === 'setup-email' && (
                        <form onSubmit={verificarEmail} className="space-y-5">
                            <div className="text-center">
                                <p className="text-sm font-semibold text-white">Revisa tu correo</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Enviamos un código a <span className="text-white font-medium">{userEmail}</span>
                                </p>
                                {emailSent && (
                                    <p className="text-xs text-green-400 mt-2">
                                        ✓ Código enviado. Revisa tu bandeja de entrada o spam.
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-300">Código de verificación</Label>
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={8}
                                    placeholder="000000"
                                    value={emailOtp}
                                    onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                                    className="h-11 text-center text-lg font-mono bg-white/10 border-white/15 text-white"
                                    autoFocus
                                />
                            </div>

                            <button
                                type="button"
                                onClick={iniciarEmail}
                                disabled={loading || countdown > 0}
                                className="text-xs text-[#60A5FA] hover:underline text-center w-full disabled:opacity-50"
                            >
                                {loading ? "Enviando..." : countdown > 0 ? `Espera ${countdown}s` : "¿No recibiste el código? Reenviar"}
                            </button>

                            {error && <ErrorBanner message={error} />}

                            <div className="flex gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => { setStep('choose'); setError(null); setEmailSent(false) }}
                                    className="flex-1 border-white/15 text-slate-300 hover:bg-white/10"
                                >
                                    Atrás
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={loading || emailOtp.trim().length < 6}
                                    className="flex-1 bg-[#1E40AF] hover:bg-[#1D4ED8]"
                                >
                                    {loading ? <Spinner /> : "Verificar"}
                                </Button>
                            </div>
                        </form>
                    )}

                    {step === 'done' && (
                        <div className="flex flex-col items-center gap-3 py-6">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20">
                                <ShieldCheck className="h-7 w-7 text-green-400" />
                            </div>
                            <p className="text-sm font-semibold text-white">¡MFA configurado!</p>
                            <p className="text-xs text-slate-400">Redirigiendo a tu panel...</p>
                        </div>
                    )}
                </div>
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