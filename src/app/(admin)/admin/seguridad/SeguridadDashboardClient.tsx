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
            color: 'text-[#1E40AF]',
            bg: 'bg-[#1E40AF]/10',
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
            color: 'text-[#0891B2]',
            bg: 'bg-cyan-100',
            cardBg: '',
            href: '/admin/seguridad/grupos',
        },
        {
            label: 'Registros de auditoría',
            value: totalAuditoria,
            sub: 'Acciones registradas',
            icon: ClipboardList,
            color: 'text-emerald-600',
            bg: 'bg-emerald-100',
            cardBg: '',
            href: '/admin/seguridad/auditoria',
        },
    ]

    return (
        <div className="space-y-6">
            {/* ── Encabezado ── */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E40AF]/10">
                    <ShieldCheck className="h-5 w-5 text-[#1E40AF]" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-[#0F172A] leading-none">Seguridad</h1>
                    <p className="text-sm text-[#94A3B8] mt-0.5">
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
                            className={`text-left rounded-lg border p-5 shadow-sm transition-all hover:shadow-md hover:border-[#1E40AF]/20 ${
                                kpi.cardBg || 'bg-white border-[#E2E8F0]'
                            }`}
                        >
                            <div className="flex items-start justify-between">
                                <p className="text-sm font-medium text-[#94A3B8]">{kpi.label}</p>
                                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.bg}`}>
                                    <Icon className={`h-4 w-4 ${kpi.color}`} />
                                </div>
                            </div>
                            <p className={`mt-2 text-3xl font-bold tabular-nums ${kpi.color}`}>
                                {kpi.value.toLocaleString('es-EC')}
                            </p>
                            <p className="mt-1 text-xs text-[#94A3B8]">{kpi.sub}</p>
                        </button>
                    )
                })}
            </div>

            {/* ── Últimos usuarios ── */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E2E8F0]">
                    <Users className="h-4 w-4 text-[#94A3B8]" />
                    <h2 className="text-sm font-semibold text-[#0F172A]">Usuarios del sistema</h2>
                    <span className="ml-auto text-xs text-[#94A3B8] bg-[#F1F5F9] rounded-full px-2 py-0.5">
                        Últimos 5
                    </span>
                </div>

                {ultimosUsuarios.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <Users className="h-8 w-8 text-[#E2E8F0] mb-3" />
                        <p className="text-sm text-[#94A3B8]">No hay usuarios registrados.</p>
                    </div>
                ) : (
                    <>
                        {/* Cabecera de tabla */}
                        <div className="hidden sm:grid grid-cols-[2fr_2fr_2fr_1fr_auto] gap-x-4 px-5 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                            {['Nombre', 'Email', 'Rol(es)', 'Estado', ''].map((h) => (
                                <span key={h} className="text-xs font-medium text-[#94A3B8] uppercase tracking-wide">
                                    {h}
                                </span>
                            ))}
                        </div>

                        <ul className="divide-y divide-[#E2E8F0]">
                            {ultimosUsuarios.map((usuario) => (
                                <li key={usuario.id}>
                                    <div className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_2fr_1fr_auto] gap-x-4 items-center px-5 py-3.5 hover:bg-[#F8FAFC] transition-colors">
                                        {/* Nombre */}
                                        <span className="text-sm font-medium text-[#0F172A] truncate">
                                            {usuario.nombre} {usuario.apellido}
                                        </span>

                                        {/* Email */}
                                        <span className="text-sm text-[#64748B] truncate hidden sm:block">
                                            {usuario.email}
                                        </span>

                                        {/* Roles */}
                                        <div className="flex flex-wrap gap-1 hidden sm:flex">
                                            {usuario.roles.length === 0 ? (
                                                <span className="text-xs text-[#94A3B8]">Sin rol</span>
                                            ) : (
                                                usuario.roles.map((rol) => (
                                                    <span
                                                        key={rol.id}
                                                        className="inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-medium bg-[#1E40AF]/10 text-[#1E40AF] border border-[#1E40AF]/20"
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
                                                    ? 'bg-green-50 text-green-700 border border-green-200'
                                                    : 'bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0]'
                                            }`}
                                        >
                                            {usuario.activo ? 'Activo' : 'Inactivo'}
                                        </span>

                                        {/* Acción */}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => router.push(`/admin/seguridad/usuarios/${usuario.id}`)}
                                            className="h-7 px-2 text-xs text-[#1E40AF] hover:bg-[#1E40AF]/5"
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
                <div className="flex justify-end px-5 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC]">
                    <button
                        onClick={() => router.push('/admin/seguridad/usuarios')}
                        className="text-xs text-[#1E40AF] hover:underline font-medium"
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
                        className="text-left group rounded-xl bg-white border border-[#E2E8F0] p-5 shadow-sm hover:border-[#1E40AF]/30 hover:shadow-md transition-all"
                    >
                        <p className="text-sm font-semibold text-[#0F172A] group-hover:text-[#1E40AF] transition-colors">
                            {link.label}
                        </p>
                        <p className="text-xs text-[#94A3B8] mt-1">{link.sub}</p>
                    </button>
                ))}
            </div>
        </div>
    )
}
