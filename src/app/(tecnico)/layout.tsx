'use client'

/**
 * src/app/(tecnico)/layout.tsx
 * Layout del panel técnico — mobile-first, max-width 480px.
 * Barra superior fija + navegación inferior con tabs.
 */

import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Plus, ClipboardList, HardHat, LogOut } from 'lucide-react'
import OfflineBanner from '@/components/tecnico/OfflineBanner'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
    { href: '/tecnico/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/tecnico/nuevo-reporte', icon: Plus, label: 'Nuevo', fab: true },
    { href: '/tecnico/mis-reportes', icon: ClipboardList, label: 'Reportes' },
]

export default function TecnicoLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [tecnico, setTecnico] = useState<{ nombre: string; apellido: string } | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function cargarTecnico() {
            const supabase = createClient()

            // Obtener sesión actual
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                setLoading(false)
                return
            }

            // Buscar en la tabla tecnicos usando el email
            const { data: tecnicoData } = await supabase
                .from('tecnicos')
                .select('nombre, apellido')
                .eq('email', session.user.email)
                .single()

            if (tecnicoData) {
                setTecnico(tecnicoData)
            } else {
                // Fallback: usar metadata de auth
                setTecnico({
                    nombre: session.user.user_metadata?.nombre || 'Técnico',
                    apellido: session.user.user_metadata?.apellido || ''
                })
            }
            setLoading(false)
        }

        cargarTecnico()
    }, [])

    // Mostrar un estado de carga mientras se obtienen los datos
    if (loading) {
        return (
            <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E40AF] mx-auto"></div>
                    <p className="mt-2 text-sm text-[#64748B]">Cargando...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#F1F5F9] flex flex-col">
            {/* ── Top bar ── */}
            <header className="fixed top-0 left-0 right-0 z-40 bg-[#0F172A] shadow-md">
                <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E40AF]">
                            <HardHat className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white leading-none">Mobilhospital</p>
                            <p className="text-[10px] text-[#64748B] leading-none mt-0.5">Panel Técnico</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-right">
                            <p className="text-xs font-semibold text-white leading-none">
                                {tecnico ? `${tecnico.nombre} ${tecnico.apellido}` : 'Cargando...'}
                            </p>
                            <p className="text-[10px] text-[#64748B] leading-none mt-0.5">Técnico</p>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1E40AF] text-white text-xs font-bold">
                            {tecnico ? tecnico.nombre[0] : '?'}
                            {tecnico ? tecnico.apellido[0] : ''}
                        </div>
                        <form action="/auth/logout" method="POST" className="ml-1 flex items-center">
                            <button
                                type="submit"
                                title="Cerrar Sesión"
                                className="text-[#94A3B8] hover:text-white transition-colors p-1"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            {/* ── Offline banner (se inserta debajo del top bar) ── */}
            <OfflineBanner />

            {/* ── Contenido principal ── */}
            <main className="flex-1 pt-14 pb-20 overflow-y-auto">
                <div className="max-w-lg mx-auto p-4 space-y-4">
                    {children}
                </div>
            </main>

            {/* ── Bottom navigation ── */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2E8F0] shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
                <div className="flex items-end max-w-lg mx-auto">
                    {NAV_ITEMS.map((item) => {
                        const active = item.href === '/tecnico/nuevo-reporte'
                            ? pathname === item.href || pathname.startsWith('/tecnico/nuevo-reporte/')
                            : pathname.startsWith(item.href)
                        const Icon = item.icon
                        return (
                            <button
                                key={item.href}
                                onClick={() => router.push(item.href)}
                                className={`flex-1 flex flex-col items-center justify-center transition-all
                  ${item.fab ? 'pb-3 pt-1 gap-0' : 'h-16 gap-1'}
                `}
                            >
                                {item.fab ? (
                                    <div className={`flex h-13 w-13 -mt-5 items-center justify-center rounded-full w-14 h-14 shadow-lg transition-colors
                    ${active ? 'bg-[#1E3A8A]' : 'bg-[#1E40AF]'}`}>
                                        <Icon className="h-6 w-6 text-white" />
                                    </div>
                                ) : (
                                    <Icon className={`h-5 w-5 ${active ? 'text-[#1E40AF]' : 'text-[#94A3B8]'}`} />
                                )}
                                <span className={`text-[10px] font-medium ${item.fab ? 'mt-1 text-[#1E40AF]' : active ? 'text-[#1E40AF]' : 'text-[#94A3B8]'}`}>
                                    {item.label}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </nav>
        </div>
    )
}