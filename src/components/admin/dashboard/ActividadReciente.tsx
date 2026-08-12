/**
 * src/components/admin/dashboard/ActividadReciente.tsx
 * Últimos movimientos, como línea de tiempo agrupada por día.
 *
 * El agrupado en "Hoy / Ayer / fecha" hace el trabajo que antes tocaba hacer
 * leyendo la columna de fechas una por una. Y el tiempo relativo se acompaña
 * SIEMPRE de la fecha exacta en el title: "hace 20 min" se entiende de un
 * vistazo pero no sirve para nada si luego hay que citarlo en un parte.
 *
 * Arriba, el volumen de reportes de la última semana. Es contexto, no adorno:
 * dice si lo que se ve debajo es un día normal o uno cargado.
 */

import Link from 'next/link'
import {
    AlertTriangle,
    ArrowUpRight,
    Clock,
    Flame,
    PackagePlus,
    ShieldCheck,
    Wrench,
    type LucideIcon,
} from 'lucide-react'
import TarjetaPanel from './TarjetaPanel'
import type { ActividadReciente as Actividad, PuntoDia } from '@/app/actions/dashboard'

interface ActividadRecienteProps {
    actividad: Actividad[]
    reportesPorDia: PuntoDia[]
}

/**
 * Estados del flujo tras la migración 023: en_progreso → cerrado, con anulado
 * como única marcha atrás.
 */
const ESTADOS: Record<string, { label: string; clase: string }> = {
    en_progreso: { label: 'En progreso', clase: 'bg-marca-suave text-marca-tinta' },
    cerrado: { label: 'Cerrado', clase: 'bg-ok-suave text-ok-tinta' },
    anulado: { label: 'Anulado', clase: 'bg-critico-suave text-critico-tinta' },
}

/**
 * Icono y fondo por tipo de mantenimiento.
 *
 * La clave se busca en minúsculas y por inclusión: el catálogo tiene
 * 'Preventivo-Correctivo', que debe caer del lado del correctivo, y nombres
 * nuevos como 'Preventivo Anual' encuentran igual su icono.
 */
const TIPOS: { coincide: string; icono: LucideIcon; clase: string }[] = [
    { coincide: 'correctivo', icono: Wrench, clase: 'bg-critico-suave text-critico-tinta' },
    { coincide: 'emergencia', icono: Flame, clase: 'bg-grave-suave text-grave-tinta' },
    { coincide: 'instalación', icono: PackagePlus, clase: 'bg-marca-suave text-marca-tinta' },
    { coincide: 'instalacion', icono: PackagePlus, clase: 'bg-marca-suave text-marca-tinta' },
    { coincide: 'retiro', icono: PackagePlus, clase: 'bg-panel-suave text-tinta-media' },
    { coincide: 'preventivo', icono: ShieldCheck, clase: 'bg-ok-suave text-ok-tinta' },
]

const TIPO_POR_DEFECTO = { icono: AlertTriangle, clase: 'bg-panel-suave text-tinta-media' }

/** Alto del área del sparkline, en píxeles reales. */
const ALTO_SPARKLINE = 44

const LEYENDA_SPARKLINE = [
    { color: 'var(--serie-1)', texto: 'hoy (resaltado)' },
    { color: 'var(--barra-suave)', texto: 'días con reportes' },
    { color: 'var(--barra-vacia)', texto: 'día en 0 (barra mínima)' },
]

function estiloTipo(nombre: string | null) {
    if (!nombre) return TIPO_POR_DEFECTO

    const clave = nombre.toLowerCase()
    return TIPOS.find((t) => clave.includes(t.coincide)) ?? TIPO_POR_DEFECTO
}

// ─── Fechas ──────────────────────────────────────────────────────────────────

function claveDia(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 'Hoy', 'Ayer' o la fecha escrita. */
function tituloDia(iso: string): string {
    const fecha = new Date(iso)
    const hoy = new Date()
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)

    if (claveDia(fecha) === claveDia(hoy)) return 'Hoy'
    if (claveDia(fecha) === claveDia(ayer)) return 'Ayer'

    return fecha.toLocaleDateString('es-EC', { day: 'numeric', month: 'long' })
}

function tiempoRelativo(iso: string): string {
    const segundos = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)

    if (segundos < 60) return 'hace un momento'
    if (segundos < 3600) return `hace ${Math.floor(segundos / 60)} min`
    if (segundos < 86400) return `hace ${Math.floor(segundos / 3600)} h`

    const dias = Math.floor(segundos / 86400)
    return dias === 1 ? 'hace 1 día' : `hace ${dias} días`
}

function fechaExacta(iso: string): string {
    return new Date(iso).toLocaleString('es-EC', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function ActividadReciente({ actividad, reportesPorDia }: ActividadRecienteProps) {
    // Agrupado por día conservando el orden de llegada, que ya viene de más
    // reciente a más antiguo.
    const grupos: { titulo: string; items: Actividad[] }[] = []

    for (const item of actividad) {
        const titulo = tituloDia(item.updated_at)
        const ultimo = grupos[grupos.length - 1]

        if (ultimo && ultimo.titulo === titulo) ultimo.items.push(item)
        else grupos.push({ titulo, items: [item] })
    }

    const maxDia = Math.max(...reportesPorDia.map((d) => d.total), 1)
    const hoy = reportesPorDia.find((d) => d.esHoy)

    return (
        <TarjetaPanel
            titulo="Actividad reciente"
            icono={Clock}
            sinPadding
            accion={
                <Link
                    href="/admin/reportes"
                    className="flex items-center gap-1 text-[11px] font-medium text-marca-tinta hover:underline"
                >
                    Ver todos
                    <ArrowUpRight className="h-3 w-3" />
                </Link>
            }
        >
            {/* ── Volumen de la última semana ─────────────────────────────── */}
            <div className="border-b border-borde-suave px-5 py-4">
                <div className="flex items-end gap-1.5" style={{ height: ALTO_SPARKLINE }}>
                    {reportesPorDia.map((d) => (
                        <div
                            key={d.dia}
                            className="flex h-full flex-1 items-end"
                            title={`${d.etiqueta}: ${d.total} ${d.total === 1 ? 'reporte' : 'reportes'}`}
                        >
                            {/* Un día sin reportes se dibuja con un filete gris de
                                3px, no con el hueco vacío: el hueco se lee como
                                "falta el dato" y el filete como "ese día fue cero". */}
                            <div
                                className="w-full rounded-[3px]"
                                style={
                                    d.total === 0
                                        ? { height: 3, backgroundColor: 'var(--barra-vacia)' }
                                        : {
                                            height: Math.max((d.total / maxDia) * ALTO_SPARKLINE, 6),
                                            // Hoy en el azul fuerte y el resto
                                            // rebajado: la comparación que importa
                                            // es "hoy contra la semana".
                                            backgroundColor: d.esHoy ? 'var(--serie-1)' : 'var(--barra-suave)',
                                        }
                                }
                            />
                        </div>
                    ))}
                </div>

                {/* Etiquetas de día */}
                <div className="mt-1.5 flex gap-1.5">
                    {reportesPorDia.map((d) => (
                        <span
                            key={d.dia}
                            className={`flex-1 text-center text-[10px] ${
                                d.esHoy ? 'font-semibold text-marca-tinta' : 'text-tinta-tenue'
                            }`}
                        >
                            {d.esHoy ? 'hoy' : d.etiqueta}
                        </span>
                    ))}
                </div>

                <p className="mt-2 text-[11px] text-tinta-tenue">
                    Reportes por día · últimos {reportesPorDia.length} días · hoy: {hoy?.total ?? 0}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {LEYENDA_SPARKLINE.map((l) => (
                        <span key={l.texto} className="flex items-center gap-1.5">
                            <span
                                className="h-2 w-2 shrink-0 rounded-[2px]"
                                style={{ backgroundColor: l.color }}
                            />
                            <span className="text-[10px] text-tinta-tenue">{l.texto}</span>
                        </span>
                    ))}
                </div>
            </div>

            {actividad.length === 0 ? (
                <div className="flex h-[220px] flex-col items-center justify-center text-center">
                    <Clock className="mb-3 h-8 w-8 text-borde" />
                    <p className="text-sm text-tinta-tenue">No hay reportes registrados aún.</p>
                </div>
            ) : (
                <div className="divide-y divide-borde-suave">
                    {grupos.map((grupo) => (
                        <section key={grupo.titulo}>
                            <h3 className="bg-panel-suave px-5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-tinta-tenue">
                                {grupo.titulo}
                            </h3>

                            <ul className="divide-y divide-borde-suave">
                                {grupo.items.map((item) => {
                                    const estado = ESTADOS[item.estado_reporte] ?? ESTADOS.en_progreso
                                    const tipo = estiloTipo(item.tipo_nombre)
                                    const Icono = tipo.icono

                                    return (
                                        <li key={item.id}>
                                            <Link
                                                href={`/admin/reportes/${item.id}`}
                                                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-panel-suave"
                                            >
                                                <span
                                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tipo.clase}`}
                                                >
                                                    <Icono className="h-4 w-4" />
                                                </span>

                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium text-tinta">
                                                        {item.tecnico_nombre}
                                                        {item.tipo_nombre && (
                                                            <span className="font-normal text-tinta-media">
                                                                {' · '}
                                                                {item.tipo_nombre}
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="truncate font-mono text-[11px] text-tinta-tenue">
                                                        {item.serial ?? item.codigo_mh}
                                                    </p>
                                                </div>

                                                <div className="flex shrink-0 flex-col items-end gap-1">
                                                    <span
                                                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${estado.clase}`}
                                                    >
                                                        {estado.label}
                                                    </span>
                                                    <span
                                                        className="text-[11px] text-tinta-tenue"
                                                        title={fechaExacta(item.updated_at)}
                                                    >
                                                        {tiempoRelativo(item.updated_at)}
                                                    </span>
                                                </div>
                                            </Link>
                                        </li>
                                    )
                                })}
                            </ul>
                        </section>
                    ))}
                </div>
            )}
        </TarjetaPanel>
    )
}
