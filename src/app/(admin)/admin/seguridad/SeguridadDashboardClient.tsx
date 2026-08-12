'use client'

/**
 * src/app/(admin)/admin/seguridad/SeguridadDashboardClient.tsx
 * Client Component — Dashboard de seguridad.
 * Muestra 4 KPIs + tabla de últimos 5 usuarios con sus roles.
 */

import { useRouter } from 'next/navigation'
import {
    ShieldCheck,
    Users,
    BookLock,
    UsersRound,
    ClipboardList,
    ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { UsuarioConRoles } from '@/app/actions/seguridad/usuarios'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
    totalUsuariosActivos: number
    totalRoles: number
    totalGrupos: number
    totalAuditoria: number
    ultimosUsuarios: UsuarioConRoles[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export default function SeguridadDashboardClient({
    totalUsuariosActivos,
    totalRoles,
    totalGrupos,
    totalAuditoria,
    ultimosUsuarios,
}: Props) {
    const router = useRouter()

    const KPI_CARDS = [
        {
            label: 'Usuarios activos',
            value: totalUsuariosActivos,
            sub: 'Con acceso al sistema',
            icon: Users,
            color: 'text-marca-tinta',
            bg: 'bg-marca-suave',
            cardBg: '',
            href: '/admin/seguridad/usuarios',
        },
        {
            label: 'Roles configurados',
            value: totalRoles,
            sub: 'Roles del sistema RBAC',
            icon: BookLock,
            color: 'text-violet-600',
            bg: 'bg-violet-100',
            cardBg: '',
            href: '/admin/seguridad/roles',
        },
        {
            label: 'Grupos de trabajo',
            value: totalGrupos,
            sub: 'Equipos y áreas',
            icon: UsersRound,
            color: 'text-cyan-600',
            bg: 'bg-cyan-100',
            cardBg: '',
            href: '/admin/seguridad/grupos',
        },
        {
            label: 'Registros de auditoría',
            value: totalAuditoria,
            sub: 'Acciones registradas',
            icon: ClipboardList,
            color: 'text-ok-tinta',
            bg: 'bg-ok-suave',
            cardBg: '',
            href: '/admin/seguridad/auditoria',
        },
    ]

    return (
        <div className="space-y-6">
            {/* ── Encabezado ── */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-marca-suave">
                    <ShieldCheck className="h-5 w-5 text-marca-tinta" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-tinta leading-none">Seguridad</h1>
                    <p className="text-sm text-tinta-tenue mt-0.5">
                        Control de accesos, roles y auditoría del sistema
                    </p>
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {KPI_CARDS.map((kpi) => {
                    const Icon = kpi.icon
                    return (
                        <button
                            key={kpi.label}
                            onClick={() => router.push(kpi.href)}
                            className={`text-left rounded-lg border p-5 shadow-sm transition-all hover:shadow-md hover:border-marca-linea ${
                                kpi.cardBg || 'bg-panel border-borde'
                            }`}
                        >
                            <div className="flex items-start justify-between">
                                <p className="text-sm font-medium text-tinta-tenue">{kpi.label}</p>
                                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.bg}`}>
                                    <Icon className={`h-4 w-4 ${kpi.color}`} />
                                </div>
                            </div>
                            <p className={`mt-2 text-3xl font-bold tabular-nums ${kpi.color}`}>
                                {kpi.value.toLocaleString('es-EC')}
                            </p>
                            <p className="mt-1 text-xs text-tinta-tenue">{kpi.sub}</p>
                        </button>
                    )
                })}
            </div>

            {/* ── Últimos usuarios ── */}
            <div className="rounded-xl border border-borde bg-panel shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-2 px-5 py-4 border-b border-borde">
                    <Users className="h-4 w-4 text-tinta-tenue" />
                    <h2 className="text-sm font-semibold text-tinta">Usuarios del sistema</h2>
                    <span className="ml-auto text-xs text-tinta-tenue bg-panel-suave rounded-full px-2 py-0.5">
                        Últimos 5
                    </span>
                </div>

                {ultimosUsuarios.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <Users className="h-8 w-8 text-borde mb-3" />
                        <p className="text-sm text-tinta-tenue">No hay usuarios registrados.</p>
                    </div>
                ) : (
                    <>
                        {/* Cabecera de tabla */}
                        <div className="hidden sm:grid grid-cols-[2fr_2fr_2fr_1fr_auto] gap-x-4 px-5 py-2.5 bg-panel-suave border-b border-borde">
                            {['Nombre', 'Email', 'Rol(es)', 'Estado', ''].map((h) => (
                                <span key={h} className="text-xs font-medium text-tinta-tenue uppercase tracking-wide">
                                    {h}
                                </span>
                            ))}
                        </div>

                        <ul className="divide-y divide-borde">
                            {ultimosUsuarios.map((usuario) => (
                                <li key={usuario.id}>
                                    <div className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_2fr_1fr_auto] gap-x-4 items-center px-5 py-3.5 hover:bg-panel-suave transition-colors">
                                        {/* Nombre */}
                                        <span className="text-sm font-medium text-tinta truncate">
                                            {usuario.nombre} {usuario.apellido}
                                        </span>

                                        {/* Email */}
                                        <span className="text-sm text-tinta-media truncate hidden sm:block">
                                            {usuario.email}
                                        </span>

                                        {/* Roles */}
                                        <div className="flex flex-wrap gap-1 hidden sm:flex">
                                            {usuario.roles.length === 0 ? (
                                                <span className="text-xs text-tinta-tenue">Sin rol</span>
                                            ) : (
                                                usuario.roles.map((rol) => (
                                                    <span
                                                        key={rol.id}
                                                        className="inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-medium bg-marca-suave text-marca-tinta border border-marca-linea"
                                                    >
                                                        {rol.nombre}
                                                    </span>
                                                ))
                                            )}
                                        </div>

                                        {/* Estado */}
                                        <span
                                            className={`hidden sm:inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-medium w-fit ${
                                                usuario.activo
                                                    ? 'bg-ok-suave text-ok-tinta border border-ok-linea'
                                                    : 'bg-panel-suave text-tinta-tenue border border-borde'
                                            }`}
                                        >
                                            {usuario.activo ? 'Activo' : 'Inactivo'}
                                        </span>

                                        {/* Acción */}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => router.push(`/admin/seguridad/usuarios/${usuario.id}`)}
                                            className="h-7 px-2 text-xs text-marca-tinta hover:bg-marca-suave"
                                            id={`btn-ver-usuario-${usuario.id}`}
                                        >
                                            Ver
                                            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </>
                )}

                {/* Footer */}
                <div className="flex justify-end px-5 py-3 border-t border-borde bg-panel-suave">
                    <button
                        onClick={() => router.push('/admin/seguridad/usuarios')}
                        className="text-xs text-marca-tinta hover:underline font-medium"
                    >
                        Ver todos los usuarios →
                    </button>
                </div>
            </div>

            {/* ── Links rápidos ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { href: '/admin/seguridad/roles', label: 'Gestionar roles →', sub: 'Crear y editar roles y permisos por módulo' },
                    { href: '/admin/seguridad/grupos', label: 'Gestionar grupos →', sub: 'Equipos de trabajo y responsables' },
                    { href: '/admin/seguridad/auditoria', label: 'Ver auditoría →', sub: 'Registro completo de acciones del sistema' },
                ].map((link) => (
                    <button
                        key={link.href}
                        onClick={() => router.push(link.href)}
                        className="text-left group rounded-xl bg-panel border border-borde p-5 shadow-sm hover:border-marca-linea hover:shadow-md transition-all"
                    >
                        <p className="text-sm font-semibold text-tinta group-hover:text-marca-tinta transition-colors">
                            {link.label}
                        </p>
                        <p className="text-xs text-tinta-tenue mt-1">{link.sub}</p>
                    </button>
                ))}
            </div>
        </div>
    )
}
