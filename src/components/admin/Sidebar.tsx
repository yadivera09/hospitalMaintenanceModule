'use client'

/**
 * src/components/admin/Sidebar.tsx
 * Sidebar fijo del panel administrador.
 * Muestra navegación jerárquica por módulos con grupos desplegables.
 * Resalta la ruta activa con el color brand (#1E40AF).
 */

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    Building2,
    FileText,
    Stethoscope,
    HardHat,
    BookOpen,
    ClipboardList,
    BarChart2,
    Activity,
    X,
    Wrench,
    ShieldCheck,
    KeyRound,
    Users,
    UsersRound,
    ScrollText,
    ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// =============================================================================
// TIPOS
// =============================================================================

interface NavItem {
    label: string
    href: string
    icon: React.ComponentType<{ className?: string }>
}

interface NavModule {
    label: string
    icon: React.ComponentType<{ className?: string }>
    /** Prefijo de ruta para determinar si el módulo está activo */
    prefix: string
    items: NavItem[]
}

interface SidebarProps {
    /** Controla si el sidebar está abierto en móvil */
    mobileOpen: boolean
    /** Callback para cerrar el sidebar en móvil */
    onClose: () => void
}

// =============================================================================
// CONFIGURACIÓN DE MÓDULOS
// =============================================================================

const NAV_MODULES: NavModule[] = [
    {
        label: 'Mantenimiento',
        icon: Wrench,
        prefix: '/admin/dashboard,/admin/clientes,/admin/contratos,/admin/equipos,/admin/tecnicos,/admin/catalogos,/admin/reportes',
        items: [
            { label: 'Dashboard',  href: '/admin/dashboard',          icon: LayoutDashboard },
            { label: 'Clientes',   href: '/admin/clientes',           icon: Building2 },
            { label: 'Contratos',  href: '/admin/contratos',          icon: FileText },
            { label: 'Equipos',    href: '/admin/equipos',            icon: Stethoscope },
            { label: 'Técnicos',   href: '/admin/tecnicos',           icon: HardHat },
            { label: 'Catálogos',  href: '/admin/catalogos',          icon: BookOpen },
            { label: 'Reportes',   href: '/admin/reportes',           icon: ClipboardList },
            { label: 'Análisis',   href: '/admin/reportes/analisis',  icon: BarChart2 },
        ],
    },
    {
        label: 'Seguridad',
        icon: ShieldCheck,
        prefix: '/admin/seguridad',
        items: [
            { label: 'Roles',      href: '/admin/seguridad/roles',     icon: KeyRound },
            { label: 'Usuarios',   href: '/admin/seguridad/usuarios',  icon: Users },
            { label: 'Grupos',     href: '/admin/seguridad/grupos',    icon: UsersRound },
            { label: 'Auditoría',  href: '/admin/seguridad/auditoria', icon: ScrollText },
        ],
    },
]

// =============================================================================
// COMPONENTE
// =============================================================================

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
    const pathname = usePathname()

    const isActive = (href: string) =>
        pathname === href || pathname.startsWith(`${href}/`)

    /** Devuelve true si la ruta actual pertenece a este módulo */
    function moduleIsActive(mod: NavModule): boolean {
        return mod.items.some((item) => isActive(item.href))
    }

    // Estado abierto/cerrado por módulo.
    // Mantenimiento abierto por defecto; Seguridad solo si la ruta activa es suya.
    const [openModules, setOpenModules] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {}
        NAV_MODULES.forEach((mod) => {
            // Mantenimiento siempre abierto por defecto
            initial[mod.label] = mod.label === 'Mantenimiento' || moduleIsActive(mod)
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

                    <div className="space-y-1">
                        {NAV_MODULES.map((mod) => {
                            const ModIcon = mod.icon
                            const isOpen = openModules[mod.label] ?? false
                            const hasActive = moduleIsActive(mod)

                            return (
                                <div key={mod.label}>
                                    {/* ── Header del módulo (desplegable) ── */}
                                    <button
                                        onClick={() => toggleModule(mod.label)}
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
                                        <span className="flex-1 text-left">{mod.label}</span>
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
                                            {mod.items.map(({ label, href, icon: Icon }) => {
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
