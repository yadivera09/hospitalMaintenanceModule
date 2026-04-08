/**
 * src/app/(admin)/admin/dashboard/page.tsx
 * Dashboard Admin — Server Component con KPIs reales y actividad reciente.
 * BLOQUE 2 — Conectado a Supabase vía getDashboardStats + getActividadReciente.
 */

import Link from 'next/link'
import { Activity, Wrench, AlertTriangle, Users, Clock } from 'lucide-react'
import { getDashboardStats, getActividadReciente } from '@/app/actions/dashboard'

export const metadata = {
    title: 'Dashboard — Mobilhospital',
    description: 'Panel de control del administrador del módulo de mantenimiento.',
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-EC', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    })
}

const ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
    en_progreso: { label: 'En progreso', className: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
    pendiente_firma_cliente: { label: 'Pte. firma cliente', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
    cerrado: { label: 'Cerrado', className: 'bg-green-50 text-green-700 border border-green-200' },
    anulado: { label: 'Anulado', className: 'bg-red-50 text-red-600 border border-red-200' },
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
    const [statsResult, actividadResult] = await Promise.all([
        getDashboardStats(),
        getActividadReciente(),
    ])

    const kpis = statsResult.data ?? { equiposActivos: 0, reportesAbiertos: 0, mantenimientosVencidos: 0, tecnicosActivos: 0 }
    const actividad = actividadResult.data ?? []

    const KPI_CARDS = [
        {
            label: 'Equipos activos',
            value: kpis.equiposActivos,
            sub: 'En contrato vigente',
            icon: Activity,
            color: 'text-[#1E40AF]',
            bg: 'bg-[#1E40AF]/10',
            cardBg: '',
        },
        {
            label: 'Reportes abiertos',
            value: kpis.reportesAbiertos,
            sub: 'En progreso o pendiente firma cliente',
            icon: Wrench,
            color: kpis.reportesAbiertos > 0 ? 'text-amber-600' : 'text-[#94A3B8]',
            bg: kpis.reportesAbiertos > 0 ? 'bg-amber-100' : 'bg-[#F1F5F9]',
            cardBg: kpis.reportesAbiertos > 0 ? 'bg-amber-50/60 border-amber-200' : '',
        },
        {
            label: 'Mantenimientos vencidos',
            value: kpis.mantenimientosVencidos,
            sub: 'Requieren atención urgente',
            icon: AlertTriangle,
            color: kpis.mantenimientosVencidos > 0 ? 'text-red-600' : 'text-green-600',
            bg: kpis.mantenimientosVencidos > 0 ? 'bg-red-100' : 'bg-green-100',
            cardBg: kpis.mantenimientosVencidos > 0 ? 'bg-red-50/60 border-red-200' : '',
        },
        {
            label: 'Técnicos activos',
            value: kpis.tecnicosActivos,
            sub: 'Disponibles en el sistema',
            icon: Users,
            color: 'text-[#0891B2]',
            bg: 'bg-cyan-100',
            cardBg: '',
        },
    ]

    return (
        <div className="space-y-6">
            {/* Encabezado */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E40AF]/10">
                    <Activity className="h-5 w-5 text-[#1E40AF]" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-[#0F172A] leading-none">Dashboard</h1>
                    <p className="text-sm text-[#94A3B8] mt-0.5">Resumen general del módulo de mantenimiento</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {KPI_CARDS.map((kpi) => {
                    const Icon = kpi.icon
                    return (
                        <div
                            key={kpi.label}
                            className={`rounded-lg border p-5 shadow-sm transition-colors ${kpi.cardBg || 'bg-white border-[#E2E8F0]'
                                }`}
                        >
                            <div className="flex items-start justify-between">
                                <p className="text-sm font-medium text-[#94A3B8]">{kpi.label}</p>
                                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.bg}`}>
                                    <Icon className={`h-4 w-4 ${kpi.color}`} />
                                </div>
                            </div>
                            <p className={`mt-2 text-3xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
                            <p className="mt-1 text-xs text-[#94A3B8]">{kpi.sub}</p>
                        </div>
                    )
                })}
            </div>

            {/* Actividad reciente */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E2E8F0]">
                    <Clock className="h-4 w-4 text-[#94A3B8]" />
                    <h2 className="text-sm font-semibold text-[#0F172A]">Actividad reciente</h2>
                    <span className="ml-auto text-xs text-[#94A3B8] bg-[#F1F5F9] rounded-full px-2 py-0.5">
                        Últimos 5 reportes
                    </span>
                </div>

                {actividad.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <Clock className="h-8 w-8 text-[#E2E8F0] mb-3" />
                        <p className="text-sm text-[#94A3B8]">No hay reportes registrados aún.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-[#E2E8F0]">
                        {actividad.map((item) => {
                            const estadoCfg = ESTADO_CONFIG[item.estado_reporte] ?? ESTADO_CONFIG.en_progreso
                            return (
                                <li key={item.id}>
                                    <Link
                                        href={`/admin/reportes/${item.id}`}
                                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#F8FAFC] transition-colors group"
                                    >
                                        {/* Código del equipo */}
                                        <span className="font-mono text-xs font-semibold text-[#1E40AF] w-28 shrink-0 group-hover:underline">
                                            {item.codigo_mh}
                                        </span>

                                        {/* Técnico y tipo */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-[#334155] truncate">{item.tecnico_nombre}</p>
                                            {item.tipo_nombre && (
                                                <p className="text-xs text-[#94A3B8] truncate">{item.tipo_nombre}</p>
                                            )}
                                        </div>

                                        {/* Estado badge */}
                                        <span className={`shrink-0 inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-medium ${estadoCfg.className}`}>
                                            {estadoCfg.label}
                                        </span>

                                        {/* Fecha */}
                                        <span className="shrink-0 text-xs text-[#94A3B8] hidden sm:block w-36 text-right">
                                            {formatFecha(item.updated_at)}
                                        </span>
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                )}

                <div className="flex justify-end px-5 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC]">
                    <Link
                        href="/admin/reportes"
                        className="text-xs text-[#1E40AF] hover:underline font-medium"
                    >
                        Ver todos los reportes →
                    </Link>
                </div>
            </div>

            {/* Links rápidos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/admin/reportes" className="group rounded-xl bg-white border border-[#E2E8F0] p-5 shadow-sm hover:border-[#1E40AF]/30 hover:shadow-md transition-all">
                    <p className="text-sm font-semibold text-[#0F172A] group-hover:text-[#1E40AF] transition-colors">
                        Ver reportes abiertos →
                    </p>
                    <p className="text-xs text-[#94A3B8] mt-1">Reportes en progreso y pendientes de firma</p>
                </Link>
                <Link href="/admin/equipos" className="group rounded-xl bg-white border border-[#E2E8F0] p-5 shadow-sm hover:border-[#1E40AF]/30 hover:shadow-md transition-all">
                    <p className="text-sm font-semibold text-[#0F172A] group-hover:text-[#1E40AF] transition-colors">
                        Equipos con mantenimiento vencido →
                    </p>
                    <p className="text-xs text-[#94A3B8] mt-1">Requieren programación urgente</p>
                </Link>
            </div>
        </div>
    )
}
