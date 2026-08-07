/**
 * src/components/admin/dashboard/RankingTecnicos.tsx
 * Técnicos con más reportes cerrados en el periodo elegido.
 *
 * Lista compacta, una fila por técnico. Sustituye al podio de tres columnas:
 * aquel dedicaba media tarjeta a los tres primeros y dejaba fuera al resto,
 * así que con pocos técnicos quedaba un hueco enorme debajo y con muchos no se
 * veían. Aquí entran siete en el mismo alto y se comparan de un vistazo.
 *
 * Una sola serie, así que no lleva leyenda: no hay dos colores que distinguir.
 * El primero va en el azul fuerte y el resto rebajado — es jerarquía, no
 * identidad; la magnitud sigue estando en el largo de la barra y en la cifra.
 */

import { Trophy } from 'lucide-react'
import TarjetaPanel from './TarjetaPanel'
import type { TecnicoRanking } from '@/app/actions/dashboard'
import { cn } from '@/lib/utils'

interface RankingTecnicosProps {
    tecnicos: TecnicoRanking[]
    /** Etiqueta de la ventana elegida en el selector de periodo */
    periodo: string
}

/**
 * Fondos suaves del avatar, uno por posición.
 *
 * Van con variantes `dark:` en vez de tokens porque son decorativos: no
 * codifican ningún dato, solo separan una fila de la siguiente. Meterlos en la
 * paleta de tokens los pondría al mismo nivel que los colores que sí informan.
 */
const AVATARES = [
    'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
    'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
    'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
]

function iniciales(nombre: string): string {
    const partes = nombre.trim().split(/\s+/).filter(Boolean)
    if (partes.length === 0) return '—'
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
    return (partes[0][0] + partes[1][0]).toUpperCase()
}

export default function RankingTecnicos({ tecnicos, periodo }: RankingTecnicosProps) {
    const maximo = Math.max(...tecnicos.map((t) => t.cerrados), 1)

    return (
        <TarjetaPanel
            titulo="Técnicos con más cierres"
            icono={Trophy}
            accion={
                <span className="rounded-full bg-panel-suave px-2.5 py-1 text-[11px] font-medium text-tinta-media">
                    {periodo}
                </span>
            }
        >
            {tecnicos.length === 0 ? (
                <div className="flex h-[200px] flex-col items-center justify-center px-4 text-center">
                    <Trophy className="mb-3 h-8 w-8 text-borde" />
                    <p className="text-sm text-tinta-tenue">
                        Ningún reporte cerrado en este periodo. Prueba con una ventana más amplia.
                    </p>
                </div>
            ) : (
                <ul className="space-y-3">
                    {tecnicos.map((t, i) => {
                        const esPrimero = i === 0

                        return (
                            <li key={`${t.nombre}-${i}`} className="flex items-center gap-3">
                                <span
                                    className={cn(
                                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                                        AVATARES[i % AVATARES.length]
                                    )}
                                    aria-hidden="true"
                                >
                                    {iniciales(t.nombre)}
                                </span>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline gap-2">
                                        <p className="truncate text-sm font-medium text-tinta">
                                            {t.nombre}
                                        </p>

                                        {esPrimero && (
                                            <span className="shrink-0 rounded-full bg-marca-suave px-1.5 py-0.5 text-[10px] font-semibold text-marca-tinta">
                                                1.º
                                            </span>
                                        )}

                                        <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums text-tinta">
                                            {t.cerrados}
                                        </span>
                                    </div>

                                    {/* Barra de 8px, con el extremo del dato redondeado */}
                                    <div className="mt-1.5 h-2 w-full">
                                        <div
                                            className="h-full rounded-full"
                                            style={{
                                                width: `${Math.max((t.cerrados / maximo) * 100, 4)}%`,
                                                backgroundColor: esPrimero
                                                    ? 'var(--serie-1)'
                                                    : 'var(--barra-media)',
                                            }}
                                        />
                                    </div>

                                    <p className="mt-1 text-[11px] text-tinta-tenue">
                                        {t.promedioHoras !== null
                                            ? `Prom. resolución: ${t.promedioHoras.toFixed(1)} h`
                                            : 'Prom. resolución: sin datos'}
                                    </p>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </TarjetaPanel>
    )
}
