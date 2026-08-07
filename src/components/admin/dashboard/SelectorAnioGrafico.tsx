/**
 * src/components/admin/dashboard/SelectorAnioGrafico.tsx
 * Filtro del gráfico mensual: últimos doce meses o un año natural concreto.
 *
 * Va por su propio parámetro de URL (`grafico`) y no por el del periodo, porque
 * solo afecta a esta tarjeta. Cada enlace arrastra el `periodo` actual para no
 * reiniciar el resto del dashboard al cambiar de año.
 *
 * No hay filtro de mes suelto: la unidad del gráfico ES el mes, así que filtrar
 * a uno dejaría una sola barra y nada que comparar. Eligiendo el año se ven sus
 * doce meses, que es la lectura que el gráfico sabe dar.
 */

import Link from 'next/link'
import type { Periodo } from '@/lib/dashboard/periodo'
import { cn } from '@/lib/utils'

interface SelectorAnioGraficoProps {
    /** Año activo, o null para los últimos doce meses */
    activo: number | null
    anios: number[]
    /** Periodo vigente, para conservarlo en el enlace */
    periodo: Periodo
}

/** Años que se muestran como botón. El resto quedaría por debajo del pliegue. */
const MAX_ANIOS = 4

export default function SelectorAnioGrafico({ activo, anios, periodo }: SelectorAnioGraficoProps) {
    const opciones: { clave: string; etiqueta: string; anio: number | null }[] = [
        { clave: 'ultimos', etiqueta: '12 meses', anio: null },
        ...anios.slice(0, MAX_ANIOS).map((a) => ({
            clave: String(a),
            etiqueta: String(a),
            anio: a,
        })),
    ]

    return (
        <div
            className="flex flex-wrap items-center gap-1 rounded-lg bg-panel-suave p-0.5"
            role="group"
            aria-label="Ventana del gráfico"
        >
            {opciones.map((o) => {
                const esActivo = o.anio === activo
                const href = o.anio === null
                    ? `/admin/dashboard?periodo=${periodo}`
                    : `/admin/dashboard?periodo=${periodo}&grafico=${o.anio}`

                return (
                    <Link
                        key={o.clave}
                        href={href}
                        scroll={false}
                        aria-current={esActivo ? 'true' : undefined}
                        className={cn(
                            'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                            esActivo
                                ? 'bg-panel text-tinta shadow-[0_1px_2px_var(--sombra)]'
                                : 'text-tinta-media hover:text-tinta'
                        )}
                    >
                        {o.etiqueta}
                    </Link>
                )
            })}
        </div>
    )
}
