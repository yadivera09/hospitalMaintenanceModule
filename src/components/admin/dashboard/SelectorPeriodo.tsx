/**
 * src/components/admin/dashboard/SelectorPeriodo.tsx
 * Ventana temporal de las métricas de actividad del dashboard.
 *
 * Son enlaces con ?periodo=… y no un desplegable de cliente: el dashboard se
 * renderiza en el servidor, así que cambiar de ventana es cambiar de URL. Sale
 * gratis que el estado sobreviva a una recarga y que un periodo concreto se
 * pueda compartir por enlace, sin bajar ni un byte de JavaScript.
 */

import Link from 'next/link'
import { PERIODOS, type Periodo } from '@/lib/dashboard/periodo'
import { cn } from '@/lib/utils'

export default function SelectorPeriodo({
    activo,
    anioGrafico,
}: {
    activo: Periodo
    /** Año fijado en el gráfico: se arrastra para no reiniciarlo al cambiar de periodo */
    anioGrafico: number | null
}) {
    const sufijoGrafico = anioGrafico !== null ? `&grafico=${anioGrafico}` : ''

    return (
        <div
            className="flex flex-wrap items-center gap-1 rounded-lg border border-borde bg-panel p-1"
            role="group"
            aria-label="Periodo de las métricas"
        >
            {PERIODOS.map((p) => {
                const esActivo = p.clave === activo
                return (
                    <Link
                        key={p.clave}
                        href={`/admin/dashboard?periodo=${p.clave}${sufijoGrafico}`}
                        scroll={false}
                        aria-current={esActivo ? 'true' : undefined}
                        className={cn(
                            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                            esActivo
                                ? 'bg-marca text-white'
                                : 'text-tinta-media hover:bg-panel-suave hover:text-tinta'
                        )}
                    >
                        {p.etiqueta}
                    </Link>
                )
            })}
        </div>
    )
}
