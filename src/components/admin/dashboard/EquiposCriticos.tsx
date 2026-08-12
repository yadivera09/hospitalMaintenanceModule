/**
 * src/components/admin/dashboard/EquiposCriticos.tsx
 * Ranking de marcas y modelos por número de intervenciones correctivas.
 *
 * ── Por qué barras horizontales y no una tabla ───────────────────────────────
 * La pregunta es de magnitud comparada ("cuál falla más"), y para eso el largo
 * de la barra se lee de un vistazo mientras que una columna de cifras hay que
 * recorrerla. Van en horizontal porque las etiquetas son largas — marca y
 * modelo juntos — y en vertical no cabrían sin girar el texto.
 *
 * ── Sobre el color ───────────────────────────────────────────────────────────
 * El color codifica el NIVEL, no la magnitud, y sale de la paleta de estado, que
 * es fija y no se tematiza. En claro el ámbar no llega a 3:1 contra el blanco a
 * propósito: por eso cada barra lleva su cifra al final y hay leyenda con los
 * tres niveles. El color acompaña la lectura; nunca la sostiene solo.
 *
 * Los umbrales viven en actions/dashboard.ts, que es donde se clasifica.
 */

import { AlertTriangle, ShieldAlert, Wrench } from 'lucide-react'
import TarjetaPanel from './TarjetaPanel'
import type { EquipoCritico, NivelCorrectivos } from '@/app/actions/dashboard'

interface EquiposCriticosProps {
    equipos: EquipoCritico[]
    /** Etiqueta de la ventana temporal, del selector de periodo */
    periodo: string
}

const NIVELES: Record<NivelCorrectivos, { label: string; color: string; chip: string }> = {
    critico: { label: 'Crítico', color: 'var(--critico)', chip: 'bg-critico-suave text-critico-tinta' },
    alerta: { label: 'Alerta', color: 'var(--aviso)', chip: 'bg-aviso-suave text-aviso-tinta' },
    normal: { label: 'Normal', color: 'var(--ok)', chip: 'bg-ok-suave text-ok-tinta' },
}

/** Marcas del eje: el primer múltiplo de cuatro que cubre el máximo. */
function techoLimpio(max: number): number {
    if (max <= 4) return 4
    return Math.ceil(max / 4) * 4
}

/**
 * Alto por fila y margen del eje.
 *
 * El gráfico mide lo que necesita: con un solo modelo ocupa ~70px en vez de
 * reservar el alto de una tabla y dejar medio panel en blanco.
 */
const ALTO_FILA = 45
const ALTO_EJE = 25

/** Una tasa se escribe con un decimal: 3.0, 1.5. */
function formatoTasa(tasa: number): string {
    return tasa.toFixed(1)
}

export default function EquiposCriticos({ equipos, periodo }: EquiposCriticosProps) {
    const maximo = Math.max(...equipos.map((e) => e.correctivos), 0)
    const techo = techoLimpio(maximo)
    const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(techo * f))

    // El peor caso encabeza el pie de la tarjeta: es el que justifica mirar aquí.
    const peor = equipos[0]

    return (
        <TarjetaPanel
            titulo="Equipos con más correctivos"
            icono={Wrench}
            accion={
                <span className="rounded-full bg-panel-suave px-2.5 py-1 text-[11px] font-medium text-tinta-media">
                    {periodo}
                </span>
            }
        >
            {equipos.length === 0 ? (
                <div className="flex h-[200px] flex-col items-center justify-center px-5 text-center">
                    <Wrench className="mb-3 h-8 w-8 text-borde" />
                    <p className="text-sm text-tinta-tenue">
                        Ningún correctivo cerrado en este periodo.
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-tinta-tenue">
                        Solo cuentan los reportes cerrados de tipo Correctivo y
                        Preventivo-Correctivo. Prueba con una ventana más amplia.
                    </p>
                </div>
            ) : (
                <>
                    <p className="text-xs text-tinta-tenue">
                        Ranking por número de correctivos, color según tasa de fallo
                        (correctivos ÷ equipos del modelo)
                    </p>

                    {/* Leyenda */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                        {(Object.keys(NIVELES) as NivelCorrectivos[]).map((n) => (
                            <div key={n} className="flex items-center gap-1.5">
                                <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                                    style={{ backgroundColor: NIVELES[n].color }}
                                />
                                <span className="text-xs text-tinta-media">{NIVELES[n].label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Barras — el alto lo fija el número de filas */}
                    <div
                        className="mt-4 flex flex-col justify-around"
                        style={{ height: equipos.length * ALTO_FILA }}
                    >
                        {equipos.map((e, i) => {
                            const nivel = NIVELES[e.nivel]
                            const detalle = `${e.correctivos} ${e.correctivos === 1 ? 'correctivo' : 'correctivos'} en ${e.equiposAfectados} ${e.equiposAfectados === 1 ? 'equipo' : 'equipos'} · tasa ${formatoTasa(e.tasa)}`

                            return (
                                <div
                                    key={`${e.marca}-${e.modelo}-${i}`}
                                    className="flex items-center gap-3"
                                    title={`${e.marca} ${e.modelo} · ${e.categoria} · ${detalle}`}
                                >
                                    <span className="w-28 shrink-0 truncate text-right text-xs text-tinta-media sm:w-36">
                                        {e.marca} {e.modelo}
                                    </span>

                                    <div className="relative min-w-0 flex-1">
                                        {/* Cuadrícula del eje, por detrás de la barra */}
                                        <div
                                            className="pointer-events-none absolute inset-0 flex justify-between"
                                            aria-hidden="true"
                                        >
                                            {marcas.map((m) => (
                                                <span key={m} className="w-px bg-reja" />
                                            ))}
                                        </div>

                                        <div
                                            className="relative h-5 rounded-r-[4px]"
                                            style={{
                                                width: `${Math.max((e.correctivos / techo) * 100, 2)}%`,
                                                backgroundColor: nivel.color,
                                            }}
                                        />
                                    </div>

                                    <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-tinta">
                                        {e.correctivos}
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    {/* Eje X — alineado con el área de barras */}
                    <div className="flex items-center gap-3" style={{ height: ALTO_EJE }}>
                        <span className="w-28 shrink-0 sm:w-36" />
                        <div className="flex min-w-0 flex-1 justify-between">
                            {marcas.map((m) => (
                                <span key={m} className="text-[10px] tabular-nums text-tinta-tenue">
                                    {m}
                                </span>
                            ))}
                        </div>
                        <span className="w-5 shrink-0" />
                    </div>

                    {/* Pie: el caso que justifica mirar la tarjeta */}
                    {peor && (
                        <div className="flex flex-wrap items-center gap-2 border-t border-borde-suave pt-3">
                            <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${NIVELES[peor.nivel].chip}`}
                            >
                                {peor.nivel === 'critico' ? (
                                    <ShieldAlert className="h-3 w-3" />
                                ) : (
                                    <AlertTriangle className="h-3 w-3" />
                                )}
                                {peor.correctivos}{' '}
                                {peor.correctivos === 1 ? 'correctivo' : 'correctivos'} en{' '}
                                {peor.equiposAfectados}{' '}
                                {peor.equiposAfectados === 1 ? 'equipo' : 'equipos'} · tasa{' '}
                                {formatoTasa(peor.tasa)} → {NIVELES[peor.nivel].label.toLowerCase()}
                            </span>

                            {peor.nivel !== 'normal' && (
                                <span className="text-[11px] text-tinta-tenue">
                                    ← tasa de fallo alta, priorizar revisión
                                </span>
                            )}
                        </div>
                    )}
                </>
            )}
        </TarjetaPanel>
    )
}
