/**
 * src/components/admin/dashboard/EstadoFlota.tsx
 * Reparto de la flota entre al día, vencido y nunca mantenido.
 *
 * Se dibuja como una regleta de marcas finas en vez de una barra continua: a
 * simple vista se aprecia la proporción, y de cerca las marcas se pueden contar,
 * que es lo que distingue "casi todo al día" de "tres cuartas partes al día".
 *
 * Los tres colores son de la paleta de estado, que es fija y no se tematiza. En
 * claro, el ámbar queda por debajo de 3:1 contra el blanco a propósito — por eso
 * cada estado viaja SIEMPRE con su etiqueta y su cifra debajo. El color acompaña
 * a la lectura; nunca la sostiene solo.
 */

import { Gauge } from 'lucide-react'
import TarjetaPanel from './TarjetaPanel'
import type { EstadoFlota as EstadoFlotaDatos } from '@/app/actions/dashboard'

interface EstadoFlotaProps {
    flota: EstadoFlotaDatos
}

/** Número de marcas de la regleta. */
const MARCAS = 40

interface Tramo {
    clave: string
    etiqueta: string
    valor: number
    color: string
    textoChip: string
}

/**
 * Reparte las marcas proporcionalmente, garantizando al menos una a cada tramo
 * con valor. Un solo equipo vencido entre cuatrocientos redondearía a cero
 * marcas y desaparecería del gráfico — justo el dato que hay que ver.
 */
function repartirMarcas(tramos: Tramo[], total: number): string[] {
    if (total === 0) return []

    const crudo = tramos.map((t) => ({
        color: t.color,
        exacto: (t.valor / total) * MARCAS,
        asignadas: t.valor > 0 ? Math.max(1, Math.floor((t.valor / total) * MARCAS)) : 0,
    }))

    // Reparte el sobrante por mayor resto, para no perder ni inventar marcas.
    let restantes = MARCAS - crudo.reduce((acc, c) => acc + c.asignadas, 0)

    const porResto = [...crudo]
        .map((c, i) => ({ i, resto: c.exacto - Math.floor(c.exacto) }))
        .sort((a, b) => b.resto - a.resto)

    let cursor = 0
    while (restantes > 0 && porResto.length > 0) {
        const destino = porResto[cursor % porResto.length]
        if (crudo[destino.i].exacto > 0) {
            crudo[destino.i].asignadas += 1
            restantes -= 1
        }
        cursor += 1
        if (cursor > MARCAS * 2) break
    }

    // Si sobran marcas por exceso de mínimos, se quitan del tramo más grande.
    while (restantes < 0) {
        const mayor = crudo.reduce((a, b) => (a.asignadas >= b.asignadas ? a : b))
        if (mayor.asignadas <= 1) break
        mayor.asignadas -= 1
        restantes += 1
    }

    return crudo.flatMap((c) => Array<string>(c.asignadas).fill(c.color))
}

export default function EstadoFlota({ flota }: EstadoFlotaProps) {
    const tramos: Tramo[] = [
        {
            clave: 'alDia',
            etiqueta: 'Al día',
            valor: flota.alDia,
            color: 'var(--ok)',
            textoChip: 'text-ok-tinta',
        },
        {
            clave: 'vencidos',
            etiqueta: 'Vencidos',
            valor: flota.vencidos,
            color: 'var(--aviso)',
            textoChip: 'text-aviso-tinta',
        },
        {
            clave: 'nunca',
            etiqueta: 'Sin mantenimiento',
            valor: flota.nuncaMantenidos,
            color: 'var(--critico)',
            textoChip: 'text-critico-tinta',
        },
    ]

    const marcas = repartirMarcas(tramos, flota.total)
    const porcentajeAlDia = flota.total > 0 ? Math.round((flota.alDia / flota.total) * 100) : 0

    return (
        <TarjetaPanel titulo="Estado de la flota" icono={Gauge}>
            {flota.total === 0 ? (
                <div className="flex h-[200px] flex-col items-center justify-center text-center">
                    <Gauge className="mb-3 h-8 w-8 text-borde" />
                    <p className="text-sm text-tinta-tenue">
                        No hay equipos asignados a un contrato vigente.
                    </p>
                </div>
            ) : (
                <>
                    <p className="text-3xl font-semibold leading-none text-tinta">
                        {porcentajeAlDia}%
                    </p>
                    <p className="mt-1.5 text-xs text-tinta-tenue">
                        de {flota.total.toLocaleString('es-EC')} equipos con el mantenimiento al día
                    </p>

                    {/* Regleta */}
                    <div className="mt-4 flex h-10 items-stretch gap-[2px]" aria-hidden="true">
                        {marcas.map((color, i) => (
                            <span
                                key={i}
                                className="flex-1 rounded-[1px]"
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>

                    {/* Etiquetas: el canal que sostiene la lectura */}
                    <ul className="mt-4 space-y-2.5">
                        {tramos.map((t) => (
                            <li key={t.clave} className="flex items-center gap-2">
                                <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: t.color }}
                                />
                                <span className="flex-1 text-xs text-tinta-media">{t.etiqueta}</span>
                                <span className="text-xs font-semibold tabular-nums text-tinta">
                                    {t.valor}
                                </span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </TarjetaPanel>
    )
}
