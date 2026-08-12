/**
 * src/components/admin/dashboard/TarjetaKpi.tsx
 * Tarjeta de métrica de cabecera: icono, etiqueta, valor, variación y nota.
 *
 * El valor NO lleva tabular-nums. Esa propiedad da a cada dígito el ancho de un
 * cero, lo que alinea columnas de tabla pero deja los números grandes sueltos y
 * separados. Aquí se quiere el ancho natural; el tabular queda para las tablas
 * y los ejes.
 *
 * La variación solo se pinta cuando existe una comparación real (ver el tipo
 * Kpi en actions/dashboard). Y el color no depende del signo sino de si subir
 * es bueno para esa métrica: más reportes cerrados es una buena noticia, más
 * mantenimientos vencidos no.
 */

import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Kpi } from '@/app/actions/dashboard'

export type TonoKpi = 'neutro' | 'aviso' | 'critico'

interface TarjetaKpiProps {
    etiqueta: string
    icono: LucideIcon
    kpi: Kpi
    /** Tono de la tarjeta. 'aviso' y 'critico' solo se aplican si hay valor. */
    tono?: TonoKpi
    /** true cuando subir es lo deseable (cierres); false cuando es mala señal. */
    subirEsBueno?: boolean
}

const TONOS: Record<TonoKpi, { icono: string; valor: string; marco: string }> = {
    neutro: {
        icono: 'bg-marca-suave text-marca-tinta',
        valor: 'text-tinta',
        marco: 'border-borde',
    },
    aviso: {
        icono: 'bg-aviso-suave text-aviso-tinta',
        valor: 'text-tinta',
        marco: 'border-aviso',
    },
    critico: {
        icono: 'bg-critico-suave text-critico-tinta',
        valor: 'text-critico-tinta',
        marco: 'border-critico',
    },
}

export default function TarjetaKpi({
    etiqueta,
    icono: Icono,
    kpi,
    tono = 'neutro',
    subirEsBueno = true,
}: TarjetaKpiProps) {
    // Un tono de alarma sin nada que alarmar es ruido: con el contador a cero la
    // tarjeta vuelve a ser neutra.
    const tonoEfectivo: TonoKpi = kpi.valor > 0 ? tono : 'neutro'
    const estilo = TONOS[tonoEfectivo]

    const subio = (kpi.variacion ?? 0) > 0
    const esBuenaNoticia = subio === subirEsBueno
    const Flecha = subio ? ArrowUpRight : ArrowDownRight

    return (
        <div
            className={cn(
                'rounded-xl border bg-panel p-4 shadow-[0_1px_2px_var(--sombra)]',
                estilo.marco
            )}
        >
            <div className="flex items-center gap-2">
                <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg shrink-0', estilo.icono)}>
                    <Icono className="h-3.5 w-3.5" />
                </span>
                <p className="text-xs font-medium text-tinta-media truncate">{etiqueta}</p>
            </div>

            <p className={cn('mt-3 text-3xl font-semibold leading-none', estilo.valor)}>
                {kpi.valor.toLocaleString('es-EC')}
            </p>

            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                <p className="text-xs text-tinta-tenue">{kpi.nota}</p>

                {kpi.variacion !== null && kpi.variacion !== 0 && (
                    <span
                        className={cn(
                            'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium',
                            esBuenaNoticia ? 'bg-ok-suave text-ok-tinta' : 'bg-critico-suave text-critico-tinta'
                        )}
                    >
                        <Flecha className="h-3 w-3" />
                        {Math.abs(kpi.variacion)}%
                    </span>
                )}
            </div>
        </div>
    )
}
