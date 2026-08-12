'use client'

/**
 * src/components/tecnico/TecnicoLayoutClient.tsx
 *
 * Interfaz del panel técnico — mobile-first, barra superior fija y navegación
 * inferior con tabs.
 *
 * La identidad ya viene resuelta por el layout servidor: aquí no se consulta
 * quién es el usuario. Antes este componente lo averiguaba por su cuenta con
 * getSession(), que decodifica el JWT de la cookie SIN validarlo contra el
 * servidor de Auth, y caía a user_metadata cuando no encontraba ficha —
 * un campo que el propio usuario puede escribir.
 */

import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Plus, ClipboardList, HardHat, LogOut } from 'lucide-react'
import OfflineBanner from '@/components/tecnico/OfflineBanner'
import PreparacionOfflineBanner from '@/components/tecnico/PreparacionOfflineBanner'
import { useEffect, useRef, useState } from 'react'
import { registerServiceWorker } from '@/lib/pwa/register-sw'
import type { ProgresoPreparacion } from '@/lib/offline/preparar'

const NAV_ITEMS = [
    { href: '/tecnico/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/tecnico/nuevo-reporte', icon: Plus, label: 'Nuevo', fab: true },
    { href: '/tecnico/mis-reportes', icon: ClipboardList, label: 'Reportes' },
]

export interface TecnicoSesion {
    /** tecnicos.id — cadena vacía si el usuario no tiene ficha de técnico. */
    id: string
    nombre: string
    apellido: string
}

export default function TecnicoLayoutClient({
    tecnico,
    children,
}: {
    tecnico: TecnicoSesion
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const router = useRouter()
    const [preparacion, setPreparacion] = useState<ProgresoPreparacion | null>(null)

    /**
     * Estado del preparador entre reintentos.
     *
     * `corriendo` evita que dos disparadores se solapen — reconectar suele venir
     * acompañado de un cambio de visibilidad, y sin esto la preparación
     * arrancaría dos veces y descargaría todo por duplicado.
     */
    const preparacionRef = useRef({ corriendo: false, completada: false })

    useEffect(() => {
        registerServiceWorker()
    }, [])

    useEffect(() => {
        // Sin ficha de técnico no hay nada que precargar: los equipos y los
        // reportes se piden por tecnicos.id. Se avisa en vez de fallar callado,
        // porque el síntoma en campo sería una app que simplemente no funciona.
        if (!tecnico.id) {
            setPreparacion({
                fase: 'error',
                detalle: 'Tu usuario no tiene ficha de técnico.',
                porcentaje: 0,
                listo: false,
                error: 'sin-ficha',
            })
            return
        }

        // Cachear el técnico actual: el wizard y la duplicación offline lo leen
        // de aquí para saber a nombre de quién se crea el reporte.
        import('@/lib/offline/db').then(({ guardarCatalogo }) => {
            guardarCatalogo('tecnico_actual', tecnico).catch(() => {})
        })

        // Dejar el dispositivo listo para trabajar sin red: datos, pantallas y
        // el JavaScript que las hace arrancar.
        //
        // Se reintenta, y no es un detalle. Antes esto corría UNA vez al montar
        // el layout: si el técnico abría la app con mala cobertura —o sin
        // ninguna— la preparación fallaba y no volvía a intentarse hasta que
        // recargara la página. Es decir, el escenario que la preparación existe
        // para evitar era justo el que la dejaba sin hacer, y el técnico salía a
        // campo con el dispositivo a medias sin enterarse.
        let cancelado = false

        async function preparar(motivo: string) {
            const estado = preparacionRef.current

            if (estado.corriendo || estado.completada) return
            if (!navigator.onLine) return

            estado.corriendo = true

            try {
                const { prepararModoOffline } = await import('@/lib/offline/preparar')

                await prepararModoOffline(tecnico.id, (progreso) => {
                    if (cancelado) return

                    setPreparacion(progreso)

                    // Solo 'listo' cierra el asunto. 'listo-parcial' significa que
                    // los datos están pero las pantallas no, así que conviene
                    // volver a intentarlo en la siguiente oportunidad.
                    if (progreso.fase === 'listo') preparacionRef.current.completada = true
                })
            } catch (err) {
                console.warn(`[layout] preparación offline falló (${motivo}):`, err)
            } finally {
                preparacionRef.current.corriendo = false
            }
        }

        preparar('arranque')

        const alConectar = () => preparar('reconexión')
        const alCambiarVisibilidad = () => {
            // El móvil del técnico pasa el día bloqueado: 'online' pudo dispararse
            // con la pantalla apagada y la app suspendida.
            if (document.visibilityState === 'visible') preparar('pestaña visible')
        }

        window.addEventListener('online', alConectar)
        document.addEventListener('visibilitychange', alCambiarVisibilidad)

        return () => {
            cancelado = true
            window.removeEventListener('online', alConectar)
            document.removeEventListener('visibilitychange', alCambiarVisibilidad)
        }
    }, [tecnico])

    const iniciales = `${tecnico.nombre[0] ?? '?'}${tecnico.apellido[0] ?? ''}`

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
                                {tecnico.nombre} {tecnico.apellido}
                            </p>
                            <p className="text-[10px] text-[#64748B] leading-none mt-0.5">Técnico</p>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1E40AF] text-white text-xs font-bold">
                            {iniciales}
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

            {/* ── Preparación del modo offline ── */}
            <PreparacionOfflineBanner progreso={preparacion} />

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
