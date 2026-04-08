'use client'

/**
 * src/components/admin/Navbar.tsx
 * Navbar superior del panel administrador.
 * Muestra: breadcrumb dinámico, nombre/rol del usuario, botón de cierre de sesión.
 * En BLOQUE 1 se usa un mock de usuario; la sesión real se conectará en BLOQUE 2.
 */

import { usePathname, useRouter } from 'next/navigation'
import { Menu, LogOut, ChevronRight, Home } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { UsuarioSesion } from '@/types'

// =============================================================================
// TIPOS
// =============================================================================

interface NavbarProps {
    /** Callback para abrir el sidebar en móvil */
    onMenuClick: () => void
    /** Usuario de sesión activa (mock en BLOQUE 1) */
    usuario: UsuarioSesion
}

// =============================================================================
// HELPERS — Breadcrumb
// =============================================================================

/** Mapeo de segmentos de ruta a etiquetas legibles en español */
const SEGMENT_LABELS: Record<string, string> = {
    admin: 'Admin',
    dashboard: 'Dashboard',
    clientes: 'Clientes',
    contratos: 'Contratos',
    equipos: 'Equipos',
    tecnicos: 'Técnicos',
    catalogos: 'Catálogos',
    reportes: 'Reportes',
    nuevo: 'Nuevo',
    editar: 'Editar',
    detalle: 'Detalle',
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Construye los segmentos de breadcrumb a partir del pathname actual.
 * Omite el segmento 'admin' del display y reemplaza UUIDs con 'Detalle'.
 */
function buildBreadcrumbs(pathname: string) {
    const segments = pathname.split('/').filter(Boolean)
    return segments
        .filter((s) => s !== 'admin')
        .map((segment, index, arr) => ({
            label: UUID_REGEX.test(segment)
                ? 'Detalle'
                : (SEGMENT_LABELS[segment] ?? capitalize(segment)),
            href: '/admin/' + arr.slice(0, index + 1).join('/'),
            isLast: index === arr.length - 1,
        }))
}

function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

// =============================================================================
// COMPONENTE
// =============================================================================

export default function Navbar({ onMenuClick, usuario }: NavbarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const breadcrumbs = buildBreadcrumbs(pathname)

    /** Cierra sesión via route handler POST /auth/logout */
    const handleLogout = () => {
        const form = document.createElement('form')
        form.method = 'POST'
        form.action = '/auth/logout'
        document.body.appendChild(form)
        form.submit()
    }

    return (
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 bg-white border-b border-[#E2E8F0] px-4 lg:px-6">

            {/* Botón hamburguesa — solo en móvil */}
            <button
                onClick={onMenuClick}
                className="lg:hidden p-2 rounded-md text-[#334155] hover:bg-[#F1F5F9] transition-colors"
                aria-label="Abrir menú"
                id="navbar-menu-toggle"
            >
                <Menu className="h-5 w-5" />
            </button>

            {/* ── Breadcrumb ─────────────────────────────────── */}
            <nav aria-label="Breadcrumb" className="flex-1 min-w-0">
                <ol className="flex items-center gap-1 text-sm text-[#94A3B8] truncate">
                    <li>
                        <a
                            href="/admin/dashboard"
                            className="flex items-center hover:text-[#1E40AF] transition-colors"
                            aria-label="Inicio"
                        >
                            <Home className="h-3.5 w-3.5 shrink-0" />
                        </a>
                    </li>

                    {breadcrumbs.map((crumb) => (
                        <li key={crumb.href} className="flex items-center gap-1">
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                            {crumb.isLast ? (
                                <span className="font-medium text-[#0F172A] truncate">
                                    {crumb.label}
                                </span>
                            ) : (
                                <a
                                    href={crumb.href}
                                    className="hover:text-[#1E40AF] transition-colors truncate"
                                >
                                    {crumb.label}
                                </a>
                            )}
                        </li>
                    ))}
                </ol>
            </nav>

            {/* ── Info de usuario + Logout ────────────────────── */}
            <div className="flex items-center gap-3 shrink-0">
                {/* Nombre y badge */}
                <div className="hidden sm:flex flex-col items-end gap-0.5">
                    <span className="text-sm font-semibold text-[#0F172A] leading-none">
                        {usuario.nombre} {usuario.apellido}
                    </span>
                    <Badge
                        className="text-xs px-2 py-0 bg-[#1E40AF] text-white border-0 rounded-sm"
                    >
                        Administrador
                    </Badge>
                </div>

                {/* Avatar inicial */}
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1E40AF] text-white text-sm font-bold select-none">
                    {usuario.nombre.charAt(0).toUpperCase()}
                </div>

                {/* Botón cerrar sesión */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="gap-1.5 text-[#94A3B8] hover:text-[#DC2626] hover:bg-red-50 transition-colors"
                    aria-label="Cerrar sesión"
                    id="navbar-logout-btn"
                >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline text-xs font-medium">Salir</span>
                </Button>
            </div>
        </header>
    )
}
