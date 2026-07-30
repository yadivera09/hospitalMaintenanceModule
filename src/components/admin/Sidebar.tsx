'use client'

/**
 * src/components/admin/Sidebar.tsx
 * Sidebar fijo del panel administrador.
 *
 * La estructura llega ya filtrada por permisos desde el layout (server):
 * solo contiene los módulos sobre los que el usuario tiene permiso 'ver'.
 * Antes era una constante en el código y todos veían lo mismo.
 *
 * Los iconos no se guardan en la base: la columna 'icono' trae un nombre y
 * aquí se resuelve al componente. Guardar componentes en la base es imposible,
 * y guardar clases CSS ataría el esquema a una librería concreta.
 */

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    Building2,
    FileText,
    FilePlus,
    Stethoscope,
    HardHat,
    BookOpen,
    ClipboardList,
    BarChart2,
    Activity,
    X,
    Wrench,
    Settings,
    ShieldCheck,
    KeyRound,
    Users,
    UsersRound,
    Network,
    ScrollText,
    ChevronDown,
    Circle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MenuNav } from '@/lib/seguridad/navegacion'

// =============================================================================
// TIPOS
// =============================================================================

interface SidebarProps {
    /** Menús y módulos visibles para el usuario, ya filtrados por permisos */
    navegacion: MenuNav[]
    /** Controla si el sidebar está abierto en móvil */
    mobileOpen: boolean
    /** Callback para cerrar el sidebar en móvil */
    onClose: () => void
}

type IconoComponente = React.ComponentType<{ className?: string }>

// =============================================================================
// ICONOS
// =============================================================================

const ICONOS: Record<string, IconoComponente> = {
    LayoutDashboard,
    Building2,
    FileText,
    FilePlus,
    Stethoscope,
    HardHat,
    BookOpen,
    ClipboardList,
    BarChart2,
    Wrench,
    Settings,
    ShieldCheck,
    KeyRound,
    Users,
    UsersRound,
    Network,
    ScrollText,
}

/**
 * Nombres de Bootstrap Icons traducidos al icono equivalente de lucide.
 *
 * La columna 'icono' convive con dos convenciones: los módulos de /admin/* se
 * sembraron con clases de Bootstrap Icons ('bi bi-speedometer2') y los de
 * /tecnico/* con nombres de lucide ('LayoutDashboard'). El seed de la migración
 * 018 no pudo unificarlos porque su ON CONFLICT (url) DO NOTHING respetaba las
 * filas que ya existían.
 *
 * Resultado: 12 de los 15 módulos no encontraban componente y caían al círculo
 * genérico. Traducirlos aquí arregla la vista sin depender de que los datos se
 * normalicen, y sigue funcionando si alguien vuelve a dar de alta un módulo con
 * la convención antigua.
 */
const ALIAS_BOOTSTRAP: Record<string, string> = {
    'bi-speedometer2': 'LayoutDashboard',
    'bi-building': 'Building2',
    'bi-file-text': 'FileText',
    'bi-heart-pulse': 'Stethoscope',
    'bi-person-gear': 'HardHat',
    'bi-book': 'BookOpen',
    'bi-clipboard-list': 'ClipboardList',
    'bi-bar-chart': 'BarChart2',
    'bi-key': 'KeyRound',
    'bi-people': 'Users',
    'bi-diagram-3': 'Network',
    'bi-journal-text': 'ScrollText',
    'bi-tools': 'Wrench',
    'bi-gear': 'Settings',
    'bi-shield-lock': 'ShieldCheck',
}

/**
 * Respaldo por nombre de grupo, para menús cuyo icono no resuelva.
 * Los tres son los sembrados por la migración 013.
 */
const ICONOS_MENU: Record<string, IconoComponente> = {
    Operaciones: Wrench,
    Administración: Settings,
    Administracion: Settings,
    Seguridad: ShieldCheck,
}

/**
 * Traduce el valor de la columna 'icono' al componente que lo dibuja.
 *
 * Acepta las dos convenciones: un nombre de lucide tal cual, o una clase de
 * Bootstrap Icons con o sin el prefijo 'bi ' ('bi bi-key' y 'bi-key' dan lo
 * mismo). Sin coincidencia devuelve el círculo, que señala visualmente que ese
 * módulo tiene un icono sin mapear.
 */
function resolverIcono(nombre: string | undefined): IconoComponente {
    if (!nombre) return Circle

    const limpio = nombre.trim()

    if (ICONOS[limpio]) return ICONOS[limpio]

    // 'bi bi-key' → 'bi-key'; una clase suelta como 'bi-key' ya viene lista.
    const clase = limpio.startsWith('bi ') ? limpio.slice(3).trim() : limpio
    const equivalente = ALIAS_BOOTSTRAP[clase]

    return equivalente ? ICONOS[equivalente] ?? Circle : Circle
}

// =============================================================================
// COMPONENTE
// =============================================================================

export default function Sidebar({ navegacion, mobileOpen, onClose }: SidebarProps) {
    const pathname = usePathname()

    const isActive = (href: string) =>
        pathname === href || pathname.startsWith(`${href}/`)

    /** Devuelve true si la ruta actual pertenece a este menú */
    function menuIsActive(menu: MenuNav): boolean {
        return menu.modulos.some((m) => isActive(m.url))
    }

    // Abierto el primer grupo por defecto, y cualquiera que contenga la ruta activa.
    const [openModules, setOpenModules] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {}
        navegacion.forEach((menu, i) => {
            initial[menu.nombre] = i === 0 || menuIsActive(menu)
        })
        return initial
    })

    function toggleModule(label: string) {
        setOpenModules((prev) => ({ ...prev, [label]: !prev[label] }))
    }

    return (
        <>
            {/* Overlay oscuro para móvil */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            {/* Panel del sidebar */}
            <aside
                className={cn(
                    // Base
                    'fixed top-0 left-0 z-30 h-full w-64 flex flex-col',
                    'bg-[#0F172A] border-r border-white/5',
                    'transition-transform duration-300 ease-in-out',
                    // Móvil: oculto por defecto, visible cuando mobileOpen
                    mobileOpen ? 'translate-x-0' : '-translate-x-full',
                    // Desktop: siempre visible
                    'lg:translate-x-0 lg:static lg:z-auto'
                )}
                aria-label="Navegación principal"
            >
                {/* ── Encabezado / Logo ──────────────────────────── */}
                <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1E40AF]">
                            <Activity className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-white leading-none">
                                Mobilhospital
                            </p>
                            <p className="text-xs text-[#94A3B8] leading-none mt-0.5">
                                Mantenimiento
                            </p>
                        </div>
                    </div>

                    {/* Botón cerrar — solo en móvil */}
                    <button
                        onClick={onClose}
                        className="lg:hidden p-1 rounded text-[#94A3B8] hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Cerrar menú"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* ── Navegación ─────────────────────────────────── */}
                <nav className="flex-1 overflow-y-auto px-3 py-4">
                    <p className="px-3 pb-2 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                        Módulos
                    </p>

                    {navegacion.length === 0 && (
                        <p className="px-3 py-2 text-xs text-[#94A3B8] leading-relaxed">
                            No tienes módulos asignados. Contacta al administrador.
                        </p>
                    )}

                    <div className="space-y-1">
                        {navegacion.map((mod) => {
                            // El icono del grupo sale del dato; el mapa por
                            // nombre solo cubre el caso de que no resuelva.
                            // Antes se ignoraba menus.icono y los tres grupos
                            // salían con la misma llave inglesa.
                            const IconoDelDato = resolverIcono(mod.icono)
                            const ModIcon = IconoDelDato !== Circle
                                ? IconoDelDato
                                : ICONOS_MENU[mod.nombre] ?? Wrench
                            const isOpen = openModules[mod.nombre] ?? false
                            const hasActive = menuIsActive(mod)

                            return (
                                <div key={mod.nombre}>
                                    {/* ── Header del módulo (desplegable) ── */}
                                    <button
                                        onClick={() => toggleModule(mod.nombre)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium',
                                            'transition-colors duration-150',
                                            hasActive
                                                ? 'text-white hover:bg-white/8'
                                                : 'text-[#94A3B8] hover:bg-white/8 hover:text-white'
                                        )}
                                        aria-expanded={isOpen}
                                    >
                                        <ModIcon
                                            className={cn(
                                                'h-4 w-4 shrink-0',
                                                hasActive ? 'text-white' : 'text-[#94A3B8]'
                                            )}
                                        />
                                        <span className="flex-1 text-left">{mod.nombre}</span>
                                        <ChevronDown
                                            className={cn(
                                                'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                                                hasActive ? 'text-white' : 'text-[#94A3B8]',
                                                isOpen && 'rotate-180'
                                            )}
                                        />
                                    </button>

                                    {/* ── Items del módulo (colapsable) ── */}
                                    <div
                                        className={cn(
                                            'overflow-hidden transition-all duration-200 ease-in-out',
                                            isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                                        )}
                                    >
                                        <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 space-y-0.5 py-0.5">
                                            {mod.modulos.map(({ nombre: label, url: href, icono }) => {
                                                const Icon = resolverIcono(icono)
                                                const active = isActive(href)
                                                return (
                                                    <Link
                                                        key={href}
                                                        href={href}
                                                        onClick={onClose}
                                                        className={cn(
                                                            'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150',
                                                            active
                                                                ? 'bg-[#1E40AF] text-white shadow-sm'
                                                                : 'text-[#94A3B8] hover:bg-white/8 hover:text-white'
                                                        )}
                                                        aria-current={active ? 'page' : undefined}
                                                    >
                                                        <Icon
                                                            className={cn(
                                                                'h-4 w-4 shrink-0',
                                                                active ? 'text-white' : 'text-[#94A3B8]'
                                                            )}
                                                        />
                                                        {label}

                                                        {/* Indicador activo */}
                                                        {active && (
                                                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-300" />
                                                        )}
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </nav>

                {/* ── Footer del sidebar ─────────────────────────── */}
                <div className="px-4 py-4 border-t border-white/10">
                    <p className="text-xs text-[#94A3B8] text-center">
                        v1.0 · Panel Admin
                    </p>
                </div>
            </aside>
        </>
    )
}
