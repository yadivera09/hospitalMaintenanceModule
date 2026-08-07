/**
 * src/components/admin/dashboard/GraficoMantenimientos.tsx
 * Reportes por mes, desglosados por tipo de mantenimiento.
 *
 * ── Por qué apiladas ─────────────────────────────────────────────────────────
 * La pregunta que responde es de parte-sobre-total ("de los trabajos del mes,
 * cuántos fueron preventivos"), y para eso la barra apilada es la forma directa.
 *
 * ── Por qué como máximo tres tipos + 'Otros' ─────────────────────────────────
 * Los colores de serie salen de una paleta validada contra estas dos superficies
 * (#FFFFFF en claro, #111827 en oscuro) para daltonismo y contraste. Los tres
 * primeros pasan todas las comprobaciones; a partir del cuarto dejan de ser
 * distinguibles bajo deuteranopia. El recorte se hace en la consulta, no aquí.
 *
 * ── Por qué CSS y no SVG ─────────────────────────────────────────────────────
 * Las medidas son en píxeles fijos —el hueco entre bloques, el radio de las
 * esquinas— y un viewBox de SVG las escalaría junto al ancho, así que dejarían
 * de medir lo que dicen. En CSS se cumplen exactas y el gráfico sigue siendo
 * responsive.
 *
 * El hover es CSS puro (group-hover) para que esto sea un Server Component: no
 * hay estado que mantener, solo un panel que aparece.
 */

import { ArrowDownRight, ArrowUpRight, BarChart3 } from 'lucide-react'
import TarjetaPanel from './TarjetaPanel'
import SelectorAnioGrafico from './SelectorAnioGrafico'
import type { PuntoMes, ResumenSerie } from '@/app/actions/dashboard'
import type { Periodo } from '@/lib/dashboard/periodo'
import { cn } from '@/lib/utils'

interface GraficoMantenimientosProps {
    series: string[]
    resumen: ResumenSerie[]
    datos: PuntoMes[]
    /** Año fijado, o null para los últimos doce meses */
    anioGrafico: number | null
    aniosDisponibles: number[]
    /** Periodo del resto del dashboard, que el filtro debe conservar */
    periodo: Periodo
}

/** Alto del área de trazado. Fijo: las alturas de los bloques son px reales. */
const ALTO = 224

/** Separación entre bloques de una misma pila. */
const HUECO = 4

/** Radio de los bloques. Se recorta en los bajos para no deformar el valor. */
const RADIO = 8

/** Tokens de color por posición de serie. El orden es el validado. */
const COLOR_SERIE = ['var(--serie-1)', 'var(--serie-2)', 'var(--serie-3)', 'var(--serie-otros)']

/** Tarjetas de la columna izquierda: las series con nombre propio, sin 'Otros'. */
const MAX_TARJETAS = 3

/**
 * Techo del eje: el primer múltiplo de cuatro "redondo" que cubre el máximo.
 *
 * Aunque ya no se dibujen marcas de eje, el techo sigue haciendo falta: es lo
 * que mantiene los doce meses en la MISMA escala. Sin él cada columna se
 * normalizaría contra sí misma y todas parecerían igual de altas.
 */
function techoLimpio(max: number): number {
    if (max <= 4) return 4

    const pasos = [1, 2, 3, 4, 5, 8, 10, 15, 20, 25, 40, 50, 75, 100, 150, 200, 250, 400, 500, 750, 1000, 1500, 2500]

    for (const paso of pasos) {
        if (paso * 4 >= max) return paso * 4
    }

    return Math.ceil(max / 4) * 4
}

export default function GraficoMantenimientos({
    series,
    resumen,
    datos,
    anioGrafico,
    aniosDisponibles,
    periodo,
}: GraficoMantenimientosProps) {
    const totalVentana = datos.reduce((acc, m) => acc + m.total, 0)

    const maxMes = Math.max(...datos.map((m) => m.total), 0)
    const techo = techoLimpio(maxMes)

    // La escala descuenta TODOS los huecos posibles, no los de cada columna.
    // Descontar solo los propios daría a un mes de dos bloques más píxeles por
    // reporte que a uno de cuatro, y las alturas dejarían de ser comparables.
    const altoUtil = ALTO - (series.length - 1) * HUECO

    const tarjetas = resumen.filter((r) => r.nombre !== 'Otros').slice(0, MAX_TARJETAS)

    return (
        <TarjetaPanel
            titulo="Mantenimientos por mes"
            icono={BarChart3}
            accion={
                <SelectorAnioGrafico
                    activo={anioGrafico}
                    anios={aniosDisponibles}
                    periodo={periodo}
                />
            }
        >
            {totalVentana === 0 ? (
                <div className="flex h-[248px] flex-col items-center justify-center px-4 text-center">
                    <BarChart3 className="mb-3 h-8 w-8 text-borde" />
                    <p className="text-sm text-tinta-tenue">
                        {anioGrafico !== null
                            ? `No hay reportes registrados en ${anioGrafico}.`
                            : 'Todavía no hay reportes en los últimos 12 meses.'}
                    </p>
                </div>
            ) : (
                <>
                    {/* ── Leyenda ─────────────────────────────────────────────
                        Siempre presente con dos o más series: es el canal fiable
                        de identidad, y el único que no depende de distinguir
                        colores. El texto va en tinta, nunca en el color de la
                        serie. */}
                    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                        {series.map((nombre, i) => (
                            <div key={nombre} className="flex items-center gap-1.5">
                                <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: COLOR_SERIE[i] ?? COLOR_SERIE[3] }}
                                />
                                <span className="text-xs text-tinta-media">{nombre}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-4">
                        {/* ── Tarjetas por tipo ───────────────────────────── */}
                        <div className="w-28 shrink-0 divide-y divide-borde-suave sm:w-32">
                            {tarjetas.map((t, i) => {
                                const subio = (t.variacion ?? 0) > 0
                                const Flecha = subio ? ArrowUpRight : ArrowDownRight

                                return (
                                    <div key={t.nombre} className={cn('py-3', i === 0 && 'pt-0')}>
                                        <p className="truncate text-xs text-tinta-media" title={t.nombre}>
                                            {t.nombre}
                                        </p>
                                        <p className="mt-1 text-2xl font-semibold leading-none text-tinta">
                                            {t.total.toLocaleString('es-EC')}
                                        </p>
                                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                            <span className="text-[11px] text-tinta-tenue">
                                                {anioGrafico !== null ? anioGrafico : '12 meses'}
                                            </span>
                                            {t.variacion !== null && t.variacion !== 0 && (
                                                <span
                                                    className={cn(
                                                        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                                                        subio ? 'bg-ok-suave text-ok' : 'bg-critico-suave text-critico'
                                                    )}
                                                >
                                                    <Flecha className="h-2.5 w-2.5" />
                                                    {Math.abs(t.variacion)}%
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* ── Bloques ─────────────────────────────────────── */}
                        <div className="min-w-0 flex-1">
                            {/* El padding superior es el sitio del rótulo del mes
                                más alto: sin él quedaría recortado. */}
                            <div className="flex items-end gap-1.5 pt-5" style={{ height: ALTO + 20 }}>
                                {datos.map((mes, iMes) => {
                                    // El panel flotante se ancla al borde en los
                                    // meses de los extremos: centrado se saldría
                                    // de la tarjeta.
                                    const anclaje =
                                        iMes <= 1
                                            ? 'left-0'
                                            : iMes >= datos.length - 2
                                                ? 'right-0'
                                                : 'left-1/2 -translate-x-1/2'

                                    const esElMasAlto = mes.total === maxMes && maxMes > 0

                                    return (
                                        <div
                                            key={mes.mes}
                                            className="group relative flex h-full flex-1 flex-col justify-end outline-none"
                                            tabIndex={0}
                                            aria-label={`${mes.etiqueta}: ${mes.total} reportes`}
                                        >
                                            <div className="relative mx-auto flex w-full max-w-[46px] flex-col-reverse gap-[4px]">
                                                {/* Rótulo directo, solo en el mes más
                                                    alto. Un número sobre cada columna
                                                    se convierte en ruido y deja de
                                                    leerse; el resto lo lleva el
                                                    detalle al pasar por encima. */}
                                                {esElMasAlto && (
                                                    <span className="pointer-events-none absolute inset-x-0 -top-5 text-center text-[11px] font-semibold tabular-nums text-tinta">
                                                        {mes.total}
                                                    </span>
                                                )}

                                                {mes.valores.map((valor, iSerie) => {
                                                    if (valor <= 0) return null

                                                    const alto = Math.max((valor / techo) * altoUtil, 4)

                                                    return (
                                                        <div
                                                            key={iSerie}
                                                            style={{
                                                                height: alto,
                                                                // El radio se recorta en los
                                                                // bloques bajos: fijarlo en 8px
                                                                // obligaría a darles un alto
                                                                // mínimo, y ese mínimo es lo
                                                                // que haría mentir a la altura.
                                                                borderRadius: Math.min(RADIO, alto / 2),
                                                                backgroundColor: COLOR_SERIE[iSerie] ?? COLOR_SERIE[3],
                                                            }}
                                                        />
                                                    )
                                                })}
                                            </div>

                                            {/* Detalle del mes */}
                                            <div
                                                className={cn(
                                                    'pointer-events-none absolute top-0 z-10 hidden w-max min-w-[150px] rounded-lg border border-borde bg-panel-alto p-2.5 shadow-lg group-hover:block group-focus:block',
                                                    anclaje
                                                )}
                                            >
                                                <p className="mb-1.5 text-[11px] font-semibold text-tinta">
                                                    {mes.etiqueta} · {mes.total} reportes
                                                </p>
                                                <ul className="space-y-1">
                                                    {series.map((nombre, iSerie) => (
                                                        <li
                                                            key={nombre}
                                                            className="flex items-center gap-2 text-[11px] text-tinta-media"
                                                        >
                                                            <span
                                                                className="h-2 w-2 shrink-0 rounded-full"
                                                                style={{ backgroundColor: COLOR_SERIE[iSerie] ?? COLOR_SERIE[3] }}
                                                            />
                                                            <span className="flex-1 truncate">{nombre}</span>
                                                            <span className="tabular-nums font-medium text-tinta">
                                                                {mes.valores[iSerie] ?? 0}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* ── Eje X ───────────────────────────────────── */}
                            <div className="mt-2 flex gap-1.5">
                                {datos.map((mes) => (
                                    <span
                                        key={mes.mes}
                                        className="flex-1 text-center text-[11px] text-tinta-tenue"
                                    >
                                        {mes.etiqueta}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </TarjetaPanel>
    )
}
