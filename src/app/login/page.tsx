'use client'

/**
 * src/app/login/page.tsx
 * Página de Login — autenticación real con Supabase Auth.
 * BLOQUE 2 — Post-login redirige según rol en user_metadata.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPass, setShowPass] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const supabase = createClient()
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            })

            if (authError || !data.user) {
                setError('Credenciales incorrectas. Verifica tu email y contraseña.')
                return
            }

            const rol = data.user.user_metadata?.rol as string | undefined
            if (rol === 'administrador') {
                router.push('/admin/dashboard')
            } else if (rol === 'tecnico') {
                router.push('/tecnico/dashboard')
            } else {
                // Usuario sin rol asignado — no debería ocurrir en producción
                setError('Tu usuario no tiene un rol asignado. Contacta al administrador.')
                await supabase.auth.signOut()
            }
        } catch {
            setError('Ocurrió un error inesperado. Intenta de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-4">
            <div className="w-full max-w-sm">
                {/* Card */}
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
                    {/* Logo */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E40AF] shadow-lg shadow-blue-900/40">
                            <Activity className="h-7 w-7 text-white" />
                        </div>
                        <h1 className="mt-4 text-xl font-bold text-white tracking-tight">Mobilhospital</h1>
                        <p className="mt-1 text-sm text-slate-400">Módulo de Mantenimiento</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="login-email" className="text-xs font-medium text-slate-300">
                                Correo electrónico
                            </Label>
                            <Input
                                id="login-email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="usuario@mobilhospital.com"
                                className="h-11 bg-white/10 border-white/15 text-white placeholder:text-slate-500 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="login-password" className="text-xs font-medium text-slate-300">
                                Contraseña
                            </Label>
                            <div className="relative">
                                <Input
                                    id="login-password"
                                    type={showPass ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="h-11 bg-white/10 border-white/15 text-white placeholder:text-slate-500 focus:border-[#3B82F6] pr-11"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                                    tabIndex={-1}
                                    aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                >
                                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-red-300">{error}</p>
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading || !email || !password}
                            id="btn-login"
                            className="w-full h-11 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-semibold transition-all disabled:opacity-50 mt-2"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                    Iniciando sesión…
                                </span>
                            ) : (
                                'Iniciar sesión'
                            )}
                        </Button>
                    </form>
                </div>

                <p className="mt-4 text-center text-xs text-slate-600">
                    Mobilhospital © {new Date().getFullYear()} · Acceso restringido
                </p>
            </div>
        </div>
    )
}
