/**
 * src/app/(admin)/admin/dashboard/page.tsx
 * Dashboard Admin — Server Component con métricas reales del módulo.
 *
 * Todo el contenido sale de getResumenDashboard(): una llamada, una
 * comprobación de permiso, y las consultas en paralelo dentro.
 *
 * La pantalla está pintada contra los tokens de tema (bg-panel, text-tinta,
 * border-borde…), no contra hex fijos. Por eso el modo claro y el oscuro son el
 * mismo diseño con otros valores, sin un solo `dark:` repartido por el árbol.
 */

import Link from 'next/link'
import {
    Activity,
    AlertTriangle,
    ArrowUpRight,
    CheckCircle2,
    FileText,
    LayoutDashboard,
    Users,
    Wrench,
} from 'lucide-react'
import { getResumenDashboard } from '@/app/actions/dashboard'
import { esPeriodo, PERIODO_POR_DEFECTO } from '@/lib/dashboard/periodo'
import SelectorPeriodo from '@/components/admin/dashboard/SelectorPeriodo'
import TarjetaKpi from '@/components/admin/dashboard/TarjetaKpi'
import GraficoMantenimientos from '@/components/admin/dashboard/GraficoMantenimientos'
import EstadoFlota from '@/components/admin/dashboard/EstadoFlota'
import RankingTecnicos from '@/components/admin/dashboard/RankingTecnicos'
import ActividadReciente from '@/components/admin/dashboard/ActividadReciente'
import EquiposCriticos from '@/components/admin/dashboard/EquiposCriticos'

export const metadata = {
    title: 'Dashboard — Mobilhospital',
    description: 'Panel de control del administrador del módulo de mantenimiento.',
}

export default async function DashboardPage({
    searchParams,
}: {
    searchParams?: { periodo?: string; grafico?: string }
}) {
    // Un valor desconocido en la URL cae al valor por defecto en vez de romper
    // la página: son parámetros que cualquiera puede escribir a mano.
    const periodo = esPeriodo(searchParams?.periodo) ? searchParams.periodo : PERIODO_POR_DEFECTO

    // Solo se acepta un año de cuatro cifras plausible; cualquier otra cosa
    // vuelve a los últimos doce meses.
    const anioPedido = Number(searchParams?.grafico)
    const anioGrafico = Number.isInteger(anioPedido) && anioPedido >= 2000 && anioPedido <= 2100
        ? anioPedido
        : null

    const { data: resumen, error } = await getResumenDashboard(periodo, anioGrafico)

    if (error || !resumen) {
        return (
            <div className="rounded-xl border border-critico bg-critico-suave p-5">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-critico" />
                    <div>
                        <p className="text-sm font-semibold text-tinta">
                            No se pudo cargar el dashboard
                        </p>
                        <p className="mt-1 text-sm text-tinta-media">{error}</p>
                    </div>
                </div>
            </div>
        )
    }

    const {
        kpis, series, resumenSeries, serieMensual, flota, topTecnicos, equiposCriticos, actividad,
        etiquetaPeriodo, aniosDisponibles, reportesPorDia,
    } = resumen

    return (
        <div className="space-y-5">
            {/* ── Encabezado ──────────────────────────────────────────────── */}
            <header className="flex flex-wrap items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-marca-suave">
                    <LayoutDashboard className="h-5 w-5 text-marca-tinta" />
                </span>
                <div className="min-w-0">
                    <h1 className="text-xl font-bold leading-none text-tinta">Dashboard</h1>
                    <p className="mt-1 text-sm text-tinta-tenue">
                        Resumen general del módulo de mantenimiento
                    </p>
                </div>

                <div className="ml-auto">
                    <SelectorPeriodo activo={periodo} anioGrafico={anioGrafico} />
                </div>
            </header>

            {/* ── Aviso de mantenimientos vencidos ─────────────────────────
                Solo aparece cuando hay algo que atender: un banner permanente
                deja de leerse a la semana. */}
            {kpis.vencidos.valor > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-aviso bg-aviso-suave px-4 py-3">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-aviso" />
                    <p className="flex-1 text-sm text-tinta">
                        <span className="font-semibold">
                            {kpis.vencidos.valor} {kpis.vencidos.valor === 1 ? 'equipo' : 'equipos'}
                        </span>{' '}
                        con el mantenimiento vencido
                        {flota.nuncaMantenidos > 0 && (
                            <>
                                , de los cuales{' '}
                                <span className="font-semibold">{flota.nuncaMantenidos}</span> nunca
                                han tenido uno
                            </>
                        )}
                        .
                    </p>
                    <Link
                        href="/admin/equipos"
                        className="flex items-center gap-1 rounded-lg bg-panel px-3 py-1.5 text-xs font-medium text-tinta transition-colors hover:bg-panel-suave"
                    >
                        Ver equipos
                        <ArrowUpRight className="h-3 w-3" />
                    </Link>
                </div>
            )}

            {/* ── Métricas de cabecera ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                <TarjetaKpi etiqueta="Equipos en contrato" icono={Activity} kpi={kpis.equipos} />
                <TarjetaKpi
                    etiqueta="Reportes abiertos"
                    icono={Wrench}
                    kpi={kpis.reportesAbiertos}
                    tono="aviso"
                />
                <TarjetaKpi
                    etiqueta="Mantenim. vencidos"
                    icono={AlertTriangle}
                    kpi={kpis.vencidos}
                    tono="critico"
                    subirEsBueno={false}
                />
                <TarjetaKpi etiqueta="Reportes cerrados" icono={CheckCircle2} kpi={kpis.cerrados} />
                <TarjetaKpi etiqueta="Técnicos activos" icono={Users} kpi={kpis.tecnicos} />
                <TarjetaKpi etiqueta="Contratos vigentes" icono={FileText} kpi={kpis.contratos} />
            </div>

            {/* ── Gráfico + estado de la flota ─────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="xl:col-span-2">
                    <GraficoMantenimientos
                        series={series}
                        resumen={resumenSeries}
                        datos={serieMensual}
                        anioGrafico={anioGrafico}
                        aniosDisponibles={aniosDisponibles}
                        periodo={periodo}
                    />
                </div>
                <EstadoFlota flota={flota} />
            </div>

            {/* ── Actividad + ranking ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="xl:col-span-2">
                    <ActividadReciente actividad={actividad} reportesPorDia={reportesPorDia} />
                </div>
                <RankingTecnicos tecnicos={topTecnicos} periodo={etiquetaPeriodo} />
            </div>

            {/* ── Equipos problemáticos ────────────────────────────────────── */}
            <EquiposCriticos equipos={equiposCriticos} periodo={etiquetaPeriodo} />
        </div>
    )
}
