/**
 * src/components/admin/dashboard/TarjetaPanel.tsx
 * Contenedor común de las tarjetas del dashboard.
 *
 * Existe para que las nueve tarjetas compartan una sola definición de superficie,
 * borde y cabecera. Repetir esas clases en cada una es justo la vía por la que
 * los dos temas se separan: basta olvidar un token en un sitio para que esa
 * tarjeta se quede clara en modo oscuro.
 */

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TarjetaPanelProps {
    titulo: string
    icono: LucideIcon
    /** Contenido alineado a la derecha de la cabecera: chip, enlace, periodo… */
    accion?: React.ReactNode
    /** Quita el padding del cuerpo, para listas y tablas a sangre */
    sinPadding?: boolean
    className?: string
    children: React.ReactNode
}

export default function TarjetaPanel({
    titulo,
    icono: Icono,
    accion,
    sinPadding = false,
    className,
    children,
}: TarjetaPanelProps) {
    return (
        <section
            className={cn(
                'flex flex-col rounded-xl border border-borde bg-panel overflow-hidden',
                'shadow-[0_1px_2px_var(--sombra)]',
                className
            )}
        >
            <header className="flex items-center gap-2 px-5 py-4 border-b border-borde-suave">
                <Icono className="h-4 w-4 text-tinta-tenue shrink-0" />
                <h2 className="text-sm font-semibold text-tinta">{titulo}</h2>
                {accion && <div className="ml-auto flex items-center">{accion}</div>}
            </header>

            <div className={cn('flex-1', !sinPadding && 'p-5')}>{children}</div>
        </section>
    )
}
