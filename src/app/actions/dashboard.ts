'use server'

/**
 * src/app/actions/dashboard.ts
 * Server Actions para el Dashboard Admin.
 *
 * Todo el resumen se resuelve en UNA sola función con las consultas en
 * paralelo. Antes eran dos llamadas independientes que repetían la
 * comprobación de permiso; ahora el dashboard pide más datos y hacerlo así
 * evitaría multiplicar por diez esa repetición.
 *
 * Las agregaciones se hacen en JavaScript sobre columnas sueltas (fechas e
 * ids), no con vistas nuevas: el esquema se migra a mano en el SQL Editor, así
 * que una pantalla no debería exigir objetos nuevos en la base para pintarse.
 * A cambio hay que traer filas, y por eso cada consulta que no es un count
 * lleva un tope explícito de rango.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermiso, SIN_PERMISO } from '@/lib/seguridad/guard'
import { MODULO, PERMISO } from '@/lib/seguridad/modulos'
// La definición del periodo vive en lib/ y no aquí: este archivo es 'use server'
// y solo puede EXPORTAR funciones async. Importar valores sí está permitido.
import { definicionPeriodo, PERIODO_POR_DEFECTO, type Periodo } from '@/lib/dashboard/periodo'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

/** Métrica de cabecera: valor actual, comparación honesta y nota al pie. */
export interface Kpi {
    valor: number
    /**
     * Variación porcentual frente al periodo anterior, o null cuando no existe
     * una comparación real. Se deja en null a propósito en las métricas de
     * stock cuya historia no está en la base: inventarse un porcentaje ahí es
     * peor que no mostrarlo.
     */
    variacion: number | null
    /** Texto de apoyo bajo el número. */
    nota: string
}

export interface PuntoMes {
    /** Clave 'YYYY-MM', para ordenar */
    mes: string
    /** Etiqueta corta del eje: 'ene', 'feb'… */
    etiqueta: string
    /** Reportes por serie, en el mismo orden que ResumenDashboard.series */
    valores: number[]
    total: number
}

/** Total de una serie en la ventana del gráfico, con su comparación anual. */
export interface ResumenSerie {
    nombre: string
    total: number
    /** Frente a los 12 meses anteriores; null si entonces no hubo ninguno */
    variacion: number | null
}

export interface EstadoFlota {
    total: number
    alDia: number
    vencidos: number
    nuncaMantenidos: number
}

export interface TecnicoRanking {
    nombre: string
    cerrados: number
    /**
     * Horas medias entre el alta del reporte (created_at) y su cierre
     * (fecha_fin). null cuando ninguno de sus reportes tiene ambas fechas.
     */
    promedioHoras: number | null
}

export type NivelCorrectivos = 'critico' | 'alerta' | 'normal'

export interface EquipoCritico {
    marca: string
    modelo: string
    categoria: string
    correctivos: number
    equiposAfectados: number
    /** Correctivos por equipo del modelo. Es lo que decide el nivel. */
    tasa: number
    nivel: NivelCorrectivos
}

/** Un día del sparkline de actividad. */
export interface PuntoDia {
    /** 'YYYY-MM-DD' en hora local */
    dia: string
    /** Etiqueta corta del eje: 'lun', 'mar'… */
    etiqueta: string
    total: number
    esHoy: boolean
}

export interface ActividadReciente {
    id: string
    /** Código del equipo intervenido */
    codigo_mh: string
    /** Serial del reporte (numero_reporte_fisico); null si aún no se asignó */
    serial: string | null
    tecnico_nombre: string
    tipo_nombre: string | null
    estado_reporte: string
    updated_at: string
}

export interface ResumenDashboard {
    /** Ventana con la que se calcularon las métricas de actividad */
    periodo: Periodo
    /** Su etiqueta, para no repetir el mapa en cada componente */
    etiquetaPeriodo: string
    kpis: {
        equipos: Kpi
        reportesAbiertos: Kpi
        vencidos: Kpi
        cerrados: Kpi
        tecnicos: Kpi
        contratos: Kpi
    }
    /** Año fijado en el gráfico mensual; null = los últimos 12 meses */
    anioGrafico: number | null
    /** Años con reportes, de más reciente a más antiguo, para el filtro */
    aniosDisponibles: number[]
    /** Nombres de las series apiladas del gráfico, en orden fijo */
    series: string[]
    /** Totales por serie de la ventana visible, para las tarjetas del gráfico */
    resumenSeries: ResumenSerie[]
    serieMensual: PuntoMes[]
    flota: EstadoFlota
    topTecnicos: TecnicoRanking[]
    equiposCriticos: EquipoCritico[]
    /** Reportes por día de la última semana, para el sparkline de actividad */
    reportesPorDia: PuntoDia[]
    actividad: ActividadReciente[]
}

type Resultado =
    | { data: ResumenDashboard; error: null }
    | { data: null; error: string }

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Máximo de filas por consulta no agregada. Ver cabecera del archivo. */
const TOPE_FILAS = 9999

/**
 * Umbrales de nivel por TASA de fallo: correctivos ÷ equipos de ese modelo.
 *
 * La tasa, y no el conteo, porque el conteo premia a los modelos raros: un
 * modelo con un solo equipo y tres averías es mucho peor señal que otro con
 * treinta equipos y cinco, y por conteo absoluto salía al revés.
 *
 * Sustituye a los umbrales de v_correctivos_por_marca_modelo (5 y 3 absolutos),
 * que ya no se usa porque la vista agrega todo el histórico y aquí hace falta
 * acotar por periodo.
 */
const TASA_CRITICA = 2
const TASA_ALERTA = 1

/** Tipos de mantenimiento que cuentan como intervención correctiva. */
const TIPOS_CORRECTIVOS = ['Correctivo', 'Preventivo-Correctivo']

/** Filas del ranking de correctivos. */
const MAX_CORRECTIVOS = 6

/** Filas del ranking de técnicos. */
const MAX_TECNICOS = 7

/** Días del sparkline de actividad reciente. */
const DIAS_SPARKLINE = 7

/** Series del gráfico apilado: los 3 tipos con más volumen y el resto juntos. */
const MAX_SERIES = 3
const SERIE_OTROS = 'Otros'

const MESES_GRAFICO = 12

function isoFecha(d: Date): string {
    return d.toISOString().slice(0, 10)
}

/** Clave 'YYYY-MM-DD' de una fecha, leída en la zona horaria del servidor. */
function claveDia(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Día calendario de un `fecha_inicio`, tal como se guardó.
 *
 * OJO: `fecha_inicio` NO es un instante, es la "fecha de ejecución" que el
 * técnico elige en el paso 1 del wizard. Se guarda como medianoche UTC —
 * '2026-08-07T00:00:00+00:00'— así que convertirla a hora local la retrasa un
 * día entero: en Ecuador (UTC-5) esa medianoche son las 19:00 del día 6.
 *
 * El síntoma era que el sparkline contaba los reportes de hoy en el día
 * anterior y "hoy" salía siempre en 0 aunque acabaran de registrarse. El mismo
 * desfase movía al mes anterior los reportes del día 1 en el gráfico mensual.
 *
 * Por eso se lee la parte de fecha del valor y no se construye un Date: es la
 * fecha que se escribió, no un momento del tiempo. Si algún día `fecha_inicio`
 * pasara a guardar hora real, esto habría que convertirlo a America/Guayaquil.
 */
function diaDeFechaInicio(fechaInicio: string): string {
    return fechaInicio.slice(0, 10)
}

function restarDias(desde: Date, dias: number): Date {
    const d = new Date(desde)
    d.setDate(d.getDate() - dias)
    return d
}

/**
 * Variación porcentual entre dos periodos.
 *
 * Con periodo anterior en cero no se devuelve el infinito ni un 100% inventado:
 * no hay base sobre la que comparar, y la tarjeta lo trata como "sin dato".
 */
function variacion(actual: number, previo: number): number | null {
    if (previo === 0) return null
    return Math.round(((actual - previo) / previo) * 100)
}

function plural(n: number, singular: string, plural_: string): string {
    return n === 1 ? `${n} ${singular}` : `${n} ${plural_}`
}

// ─────────────────────────────────────────────────────────────────────────────
// getResumenDashboard
// ─────────────────────────────────────────────────────────────────────────────

export async function getResumenDashboard(
    periodo: Periodo = PERIODO_POR_DEFECTO,
    /** Año concreto para el gráfico mensual; null = los últimos 12 meses. */
    anioGrafico: number | null = null
): Promise<Resultado> {
    if (!await requirePermiso([MODULO.DASHBOARD, PERMISO.VER])) {
        return { data: null, error: SIN_PERMISO }
    }

    try {
        // Cliente de servicio: el resumen cruza tecnicos, contratos y vistas que
        // RLS restringe por rol. La autorización ya la resolvió requirePermiso.
        const db = createAdminClient()

        const ahora = new Date()
        const hoy = isoFecha(ahora)
        const en60Dias = isoFecha(restarDias(ahora, -60))

        // La ventana la elige quien mira el dashboard. La comparación usa el
        // intervalo inmediatamente anterior de la MISMA longitud: comparar 7
        // días contra 30 daría una caída del 75% que no significa nada.
        const { dias: diasPeriodo, etiqueta: etiquetaPeriodo } = definicionPeriodo(periodo)
        const desde = isoFecha(restarDias(ahora, diasPeriodo))
        const desdePrevio = isoFecha(restarDias(ahora, diasPeriodo * 2))

        // Medianoche local del primer día del sparkline. Restar días sin ajustar
        // la hora dejaría fuera los reportes de esa misma mañana, y la primera
        // barra saldría corta.
        const inicioSparkline = restarDias(ahora, DIAS_SPARKLINE - 1)
        inicioSparkline.setHours(0, 0, 0, 0)

        // El filtro de la consulta se ancla a la medianoche UTC de ese día, no a
        // la local. fecha_inicio se guarda a medianoche UTC, así que un límite
        // en las 05:00 UTC —que es la medianoche de Guayaquil— dejaría fuera
        // justo los reportes del primer día del sparkline.
        const desdeSparkline = `${claveDia(inicioSparkline)}T00:00:00.000Z`

        // Ventana del gráfico: doce meses en los dos modos. Con año elegido va
        // de enero a diciembre de ese año; sin él, los últimos doce meses
        // terminando en el actual.
        const inicioGrafico = anioGrafico !== null
            ? new Date(anioGrafico, 0, 1)
            : new Date(ahora.getFullYear(), ahora.getMonth() - (MESES_GRAFICO - 1), 1)

        // Límite superior EXCLUSIVO. En modo año hace falta de verdad: sin él la
        // consulta se traería también los meses posteriores y las tarjetas de
        // totales contarían reportes que no están en el gráfico.
        const finGrafico = new Date(
            inicioGrafico.getFullYear(),
            inicioGrafico.getMonth() + MESES_GRAFICO,
            1
        )

        // Y doce meses más atrás, solo para comparar los totales por tipo. Se
        // piden en la misma consulta: son dos columnas por fila y partir el
        // rango en dos viajes costaría más que traerlas juntas.
        const inicioComparativa = new Date(
            inicioGrafico.getFullYear(),
            inicioGrafico.getMonth() - MESES_GRAFICO,
            1
        )

        const [
            equiposRes,
            equiposPrevioRes,
            abiertosRes,
            pendientesFirmaRes,
            vencidosRes,
            cerradosRes,
            cerradosPrevioRes,
            tecnicosRes,
            contratosRes,
            contratosPorVencerRes,
            tiposRes,
            reportesVentanaRes,
            cerradosDetalleRes,
            primerReporteRes,
            criticosRes,
            actividadRes,
            reportesPorDiaRes,
        ] = await Promise.all([
            // 1. Equipos con contrato vigente
            db.from('v_equipo_contrato_vigente')
                .select('equipo_id', { count: 'exact', head: true }),

            // 2. Los que ya estaban asignados al empezar el periodo. Se
            //    reconstruye desde equipo_contratos, que sí guarda las fechas:
            //    la vista solo conoce el presente.
            db.from('equipo_contratos')
                .select('id', { count: 'exact', head: true })
                .lte('fecha_asignacion', desde)
                .or(`fecha_retiro.is.null,fecha_retiro.gt.${desde}`),

            // 3. Reportes abiertos — tras la migración 023 solo hay un estado
            //    abierto: en_progreso.
            db.from('reportes_mantenimiento')
                .select('id', { count: 'exact', head: true })
                .eq('estado_reporte', 'en_progreso')
                .eq('activo', true),

            // 4. Cerrados a los que todavía les falta la firma del cliente.
            //    Ocupa el sitio del antiguo estado 'pendiente_firma_cliente':
            //    la espera sigue existiendo, pero ya no bloquea el cierre, así
            //    que ahora se mide por la ausencia de la firma.
            db.from('reportes_mantenimiento')
                .select('id', { count: 'exact', head: true })
                .eq('estado_reporte', 'cerrado')
                .is('firma_cliente', null)
                .eq('activo', true),

            // 5. Mantenimientos vencidos, con la fecha del último cerrado para
            //    poder separar "vencido" de "nunca mantenido"
            db.from('v_equipos_mantenimiento_vencido')
                .select('equipo_id, fecha_ultimo_cerrado')
                .range(0, TOPE_FILAS),

            // 6. Reportes cerrados dentro del periodo elegido
            db.from('reportes_mantenimiento')
                .select('id', { count: 'exact', head: true })
                .eq('estado_reporte', 'cerrado')
                .gte('fecha_fin', desde),

            // 7. Y en el intervalo anterior de la misma longitud
            db.from('reportes_mantenimiento')
                .select('id', { count: 'exact', head: true })
                .eq('estado_reporte', 'cerrado')
                .gte('fecha_fin', desdePrevio)
                .lt('fecha_fin', desde),

            // 8. Técnicos activos
            db.from('tecnicos')
                .select('id', { count: 'exact', head: true })
                .eq('activo', true),

            // 9. Contratos vigentes: activos y sin fecha de fin o aún por vencer
            db.from('contratos')
                .select('id', { count: 'exact', head: true })
                .eq('activo', true)
                .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`),

            // 10. Contratos que vencen dentro de 60 días
            db.from('contratos')
                .select('id', { count: 'exact', head: true })
                .eq('activo', true)
                .gte('fecha_fin', hoy)
                .lte('fecha_fin', en60Dias),

            // 11. Catálogo de tipos, para nombrar las series sin joins por fila
            db.from('tipos_mantenimiento').select('id, nombre'),

            // 12. Reportes de la ventana del gráfico. Solo dos columnas: el
            //     join por fila multiplicaría el payload sin aportar nada.
            db.from('reportes_mantenimiento')
                .select('fecha_inicio, tipo_mantenimiento_id')
                .eq('activo', true)
                .gte('fecha_inicio', inicioComparativa.toISOString())
                .lt('fecha_inicio', finGrafico.toISOString())
                .range(0, TOPE_FILAS),

            // 13. Cerrados del periodo por técnico, para el ranking.
            //     created_at y fecha_fin son timestamps reales (a diferencia de
            //     fecha_inicio), así que su diferencia sí mide tiempo de trabajo.
            db.from('reportes_mantenimiento')
                .select('tecnico_principal_id, created_at, fecha_fin')
                .eq('estado_reporte', 'cerrado')
                .gte('fecha_fin', desde)
                .range(0, TOPE_FILAS),

            // 14b. El reporte más antiguo, para saber qué años ofrecer en el
            //      filtro del gráfico. Una fila, la columna mínima.
            db.from('reportes_mantenimiento')
                .select('fecha_inicio')
                .order('fecha_inicio', { ascending: true })
                .limit(1),

            // 14. Correctivos cerrados DENTRO del periodo elegido.
            //
            //     Ya no se usa v_correctivos_por_marca_modelo: esa vista agrega
            //     todo el histórico y no acepta filtro de fecha, así que una
            //     tarjeta que dijera "últimos 90 días" estaría mostrando el
            //     total de siempre. El agrupado por marca y modelo se hace aquí,
            //     con los mismos umbrales que traía la vista.
            db.from('reportes_mantenimiento')
                .select('equipo_id, tipo_mantenimiento_id, equipo:equipos(marca, modelo, categoria:categorias_equipo(nombre))')
                .eq('estado_reporte', 'cerrado')
                .gte('fecha_fin', desde)
                .range(0, TOPE_FILAS),

            // 15. Últimos movimientos
            db.from('reportes_mantenimiento')
                .select(`
                    id,
                    estado_reporte,
                    updated_at,
                    numero_reporte_fisico,
                    equipo:equipos(codigo_mh),
                    tecnico_principal:tecnicos(nombre, apellido),
                    tipo:tipos_mantenimiento(nombre)
                `)
                .eq('activo', true)
                .order('updated_at', { ascending: false })
                .limit(8),

            // 16. Reportes de los últimos 7 días, para el sparkline.
            //     Consulta propia y no la del gráfico mensual: aquella cambia de
            //     ventana al fijar un año concreto, y entonces "los últimos 7
            //     días" podrían quedar fuera del rango.
            db.from('reportes_mantenimiento')
                .select('fecha_inicio')
                .eq('activo', true)
                .gte('fecha_inicio', desdeSparkline)
                .range(0, TOPE_FILAS),
        ])

        // ── Flota ────────────────────────────────────────────────────────────
        const filasVencidas = (vencidosRes.data ?? []) as { fecha_ultimo_cerrado: string | null }[]
        const nuncaMantenidos = filasVencidas.filter((f) => !f.fecha_ultimo_cerrado).length
        const vencidos = filasVencidas.length
        const equiposEnContrato = equiposRes.count ?? 0

        const flota: EstadoFlota = {
            total: equiposEnContrato,
            // Los vencidos salen de la vista, que cubre TODO equipo activo con
            // tipo planificado — también los que no están en contrato. Restarlos
            // sin tope daría negativo en ese caso.
            alDia: Math.max(equiposEnContrato - vencidos, 0),
            vencidos: vencidos - nuncaMantenidos,
            nuncaMantenidos,
        }

        // ── Serie mensual apilada ────────────────────────────────────────────
        const nombreTipo = new Map<string, string>(
            ((tiposRes.data ?? []) as { id: string; nombre: string }[]).map((t) => [t.id, t.nombre])
        )

        // La consulta trae 24 meses: los 12 que se dibujan y los 12 anteriores,
        // que solo sirven para la comparación de las tarjetas laterales.
        const reportesTraidos = (reportesVentanaRes.data ?? []) as {
            fecha_inicio: string
            tipo_mantenimiento_id: string | null
        }[]

        // El corte también va por la fecha escrita, no por el instante: si no,
        // los reportes del día 1 del primer mes se irían al tramo de comparación.
        const cortePrimerMes = `${inicioGrafico.getFullYear()}-${String(inicioGrafico.getMonth() + 1).padStart(2, '0')}-01`

        const reportesVentana = reportesTraidos.filter(
            (r) => diaDeFechaInicio(r.fecha_inicio) >= cortePrimerMes
        )
        const reportesPrevios = reportesTraidos.filter(
            (r) => diaDeFechaInicio(r.fecha_inicio) < cortePrimerMes
        )

        // Los tres tipos con más volumen mandan; el resto se suma en 'Otros'.
        // Es el límite de series que la paleta soporta sin que dos colores se
        // confundan bajo daltonismo (ver el comentario del gráfico).
        //
        // El reparto se decide con los 12 meses VISIBLES, no con los 24: si no,
        // un tipo que ya no se usa podría quedarse con un color del gráfico.
        const totalPorTipo = new Map<string, number>()
        for (const r of reportesVentana) {
            const nombre = nombreTipo.get(r.tipo_mantenimiento_id ?? '') ?? SERIE_OTROS
            totalPorTipo.set(nombre, (totalPorTipo.get(nombre) ?? 0) + 1)
        }

        const principales = Array.from(totalPorTipo.entries())
            .filter(([nombre]) => nombre !== SERIE_OTROS)
            .sort((a, b) => b[1] - a[1])
            .slice(0, MAX_SERIES)
            .map(([nombre]) => nombre)

        const hayResto = totalPorTipo.size > principales.length
        const series = hayResto ? [...principales, SERIE_OTROS] : principales

        const indiceSerie = new Map(series.map((s, i) => [s, i]))
        const indiceOtros = indiceSerie.get(SERIE_OTROS) ?? -1

        const meses: PuntoMes[] = []
        for (let i = 0; i < MESES_GRAFICO; i++) {
            const d = new Date(inicioGrafico.getFullYear(), inicioGrafico.getMonth() + i, 1)
            const nombreMes = d.toLocaleDateString('es-EC', { month: 'short' }).replace('.', '')

            // En modo "últimos 12 meses" la ventana cruza de un año a otro, así
            // que enero lleva el año: sin eso, dos etiquetas 'ene' seguidas en
            // el eje serían indistinguibles.
            const etiqueta = anioGrafico === null && d.getMonth() === 0
                ? `${nombreMes} ${String(d.getFullYear()).slice(2)}`
                : nombreMes

            meses.push({
                mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                etiqueta,
                valores: series.map(() => 0),
                total: 0,
            })
        }

        const indiceMes = new Map(meses.map((m, i) => [m.mes, i]))

        for (const r of reportesVentana) {
            // 'YYYY-MM' recortado de la fecha guardada, sin pasar por Date
            const clave = diaDeFechaInicio(r.fecha_inicio).slice(0, 7)
            const im = indiceMes.get(clave)
            if (im === undefined) continue

            const nombre = nombreTipo.get(r.tipo_mantenimiento_id ?? '') ?? SERIE_OTROS
            const is = indiceSerie.get(nombre) ?? indiceOtros
            if (is < 0) continue

            meses[im].valores[is] += 1
            meses[im].total += 1
        }

        // Totales por serie, con su comparación contra los 12 meses anteriores.
        // Alimentan las tarjetas de la izquierda del gráfico.
        const totalPrevioPorSerie = new Map<string, number>()
        for (const r of reportesPrevios) {
            const nombre = nombreTipo.get(r.tipo_mantenimiento_id ?? '') ?? SERIE_OTROS
            const clave = indiceSerie.has(nombre) ? nombre : SERIE_OTROS
            totalPrevioPorSerie.set(clave, (totalPrevioPorSerie.get(clave) ?? 0) + 1)
        }

        const resumenSeries: ResumenSerie[] = series.map((nombre, i) => {
            const total = meses.reduce((acc, m) => acc + (m.valores[i] ?? 0), 0)
            return {
                nombre,
                total,
                variacion: variacion(total, totalPrevioPorSerie.get(nombre) ?? 0),
            }
        })

        // ── Años que ofrece el filtro del gráfico ────────────────────────────
        // Del más reciente al más antiguo con reportes. Sin reportes, solo el
        // año en curso: una lista vacía dejaría el filtro sin nada que pulsar.
        const primerReporte = (primerReporteRes.data ?? [])[0] as { fecha_inicio: string } | undefined
        const anioMasAntiguo = primerReporte
            ? new Date(primerReporte.fecha_inicio).getFullYear()
            : ahora.getFullYear()

        const aniosDisponibles: number[] = []
        for (let a = ahora.getFullYear(); a >= anioMasAntiguo; a--) aniosDisponibles.push(a)

        // ── Ranking de técnicos ──────────────────────────────────────────────
        interface AcumuladoTecnico {
            cerrados: number
            /** Horas acumuladas y cuántos reportes las aportaron */
            horas: number
            muestras: number
        }

        const porTecnico = new Map<string, AcumuladoTecnico>()

        for (const r of (cerradosDetalleRes.data ?? []) as {
            tecnico_principal_id: string
            created_at: string | null
            fecha_fin: string | null
        }[]) {
            const acc = porTecnico.get(r.tecnico_principal_id) ?? { cerrados: 0, horas: 0, muestras: 0 }
            acc.cerrados += 1

            if (r.created_at && r.fecha_fin) {
                const ms = new Date(r.fecha_fin).getTime() - new Date(r.created_at).getTime()

                // Se descartan las diferencias negativas: no son tiempos de
                // trabajo, son reportes cuyo cierre se rellenó a mano por detrás
                // (los 48 que migró la 023 tomaron fecha_fin de la firma).
                if (ms >= 0) {
                    acc.horas += ms / 3_600_000
                    acc.muestras += 1
                }
            }

            porTecnico.set(r.tecnico_principal_id, acc)
        }

        const idsTop = Array.from(porTecnico.entries())
            .sort((a, b) => b[1].cerrados - a[1].cerrados)
            .slice(0, MAX_TECNICOS)

        let topTecnicos: TecnicoRanking[] = []

        if (idsTop.length > 0) {
            const { data: fichas } = await db
                .from('tecnicos')
                .select('id, nombre, apellido')
                .in('id', idsTop.map(([id]) => id))

            const nombrePorId = new Map(
                ((fichas ?? []) as { id: string; nombre: string; apellido: string }[])
                    .map((t) => [t.id, `${t.nombre} ${t.apellido}`])
            )

            topTecnicos = idsTop.map(([id, acc]) => ({
                nombre: nombrePorId.get(id) ?? 'Técnico dado de baja',
                cerrados: acc.cerrados,
                promedioHoras: acc.muestras > 0 ? acc.horas / acc.muestras : null,
            }))
        }

        // ── Ranking de correctivos por marca y modelo ────────────────────────
        //
        // El tipo se filtra aquí y no en la consulta porque la condición es por
        // NOMBRE del tipo, no por id: pedirlo a PostgREST obligaría a un join
        // filtrado por tabla relacionada, y el catálogo de tipos ya está cargado.
        const idsCorrectivos = new Set(
            ((tiposRes.data ?? []) as { id: string; nombre: string }[])
                .filter((t) => TIPOS_CORRECTIVOS.includes(t.nombre))
                .map((t) => t.id)
        )

        interface Agrupado {
            marca: string
            modelo: string
            categoria: string
            correctivos: number
            equipos: Set<string>
        }

        const porModelo = new Map<string, Agrupado>()

        for (const r of (criticosRes.data ?? []) as any[]) {
            if (!idsCorrectivos.has(r.tipo_mantenimiento_id)) continue

            const marca = r.equipo?.marca ?? '—'
            const modelo = r.equipo?.modelo ?? '—'
            const clave = `${marca}||${modelo}`

            const actual = porModelo.get(clave) ?? {
                marca,
                modelo,
                categoria: r.equipo?.categoria?.nombre ?? '—',
                correctivos: 0,
                equipos: new Set<string>(),
            }

            actual.correctivos += 1
            actual.equipos.add(r.equipo_id)
            porModelo.set(clave, actual)
        }

        const equiposCriticos: EquipoCritico[] = Array.from(porModelo.values())
            .sort((a, b) => b.correctivos - a.correctivos)
            .slice(0, MAX_CORRECTIVOS)
            .map((g) => {
                const equiposAfectados = Math.max(g.equipos.size, 1)
                const tasa = g.correctivos / equiposAfectados

                return {
                    marca: g.marca,
                    modelo: g.modelo,
                    categoria: g.categoria,
                    correctivos: g.correctivos,
                    equiposAfectados,
                    tasa,
                    nivel: (tasa >= TASA_CRITICA
                        ? 'critico'
                        : tasa >= TASA_ALERTA
                            ? 'alerta'
                            : 'normal') as NivelCorrectivos,
                }
            })

        // ── Reportes por día (sparkline) ─────────────────────────────────────
        const hoyClave = claveDia(ahora)
        const reportesPorDia: PuntoDia[] = []

        for (let i = 0; i < DIAS_SPARKLINE; i++) {
            const d = new Date(inicioSparkline)
            d.setDate(d.getDate() + i)

            reportesPorDia.push({
                dia: claveDia(d),
                etiqueta: d.toLocaleDateString('es-EC', { weekday: 'short' }).replace('.', ''),
                total: 0,
                esHoy: claveDia(d) === hoyClave,
            })
        }

        const indiceDia = new Map(reportesPorDia.map((p, i) => [p.dia, i]))

        for (const r of (reportesPorDiaRes.data ?? []) as { fecha_inicio: string }[]) {
            const id = indiceDia.get(diaDeFechaInicio(r.fecha_inicio))
            if (id !== undefined) reportesPorDia[id].total += 1
        }

        // ── Actividad reciente ───────────────────────────────────────────────
        const actividad: ActividadReciente[] = ((actividadRes.data ?? []) as any[]).map((r) => ({
            id: r.id,
            codigo_mh: r.equipo?.codigo_mh ?? '—',
            serial: r.numero_reporte_fisico ?? null,
            tecnico_nombre: r.tecnico_principal
                ? `${r.tecnico_principal.nombre} ${r.tecnico_principal.apellido}`
                : '—',
            tipo_nombre: r.tipo?.nombre ?? null,
            estado_reporte: r.estado_reporte,
            updated_at: r.updated_at,
        }))

        // ── KPIs ─────────────────────────────────────────────────────────────
        const abiertos = abiertosRes.count ?? 0
        const pendientesFirma = pendientesFirmaRes.count ?? 0
        const cerrados = cerradosRes.count ?? 0
        const cerradosPrevio = cerradosPrevioRes.count ?? 0
        const tecnicosActivos = tecnicosRes.count ?? 0
        const tecnicosConActividad = porTecnico.size
        const contratosVigentes = contratosRes.count ?? 0
        const contratosPorVencer = contratosPorVencerRes.count ?? 0

        return {
            data: {
                periodo,
                etiquetaPeriodo,
                kpis: {
                    equipos: {
                        valor: equiposEnContrato,
                        variacion: variacion(equiposEnContrato, equiposPrevioRes.count ?? 0),
                        nota: 'Con contrato vigente',
                    },
                    reportesAbiertos: {
                        valor: abiertos,
                        variacion: null,
                        nota: pendientesFirma > 0
                            ? `${plural(pendientesFirma, 'cerrado espera', 'cerrados esperan')} firma del cliente`
                            : 'Ningún cerrado sin firma del cliente',
                    },
                    vencidos: {
                        valor: vencidos,
                        variacion: null,
                        nota: nuncaMantenidos > 0
                            ? `${nuncaMantenidos} sin ningún mantenimiento`
                            : 'Todos con historial previo',
                    },
                    cerrados: {
                        valor: cerrados,
                        variacion: variacion(cerrados, cerradosPrevio),
                        nota: etiquetaPeriodo === 'Hoy' ? 'Hoy' : `Últimos ${etiquetaPeriodo.toLowerCase()}`,
                    },
                    tecnicos: {
                        valor: tecnicosActivos,
                        variacion: null,
                        nota: `${tecnicosConActividad} con cierres en el periodo`,
                    },
                    contratos: {
                        valor: contratosVigentes,
                        variacion: null,
                        nota: contratosPorVencer > 0
                            ? `${plural(contratosPorVencer, 'vence', 'vencen')} en 60 días`
                            : 'Ninguno vence en 60 días',
                    },
                },
                anioGrafico,
                aniosDisponibles,
                series,
                resumenSeries,
                serieMensual: meses,
                flota,
                topTecnicos,
                equiposCriticos,
                reportesPorDia,
                actividad,
            },
            error: null,
        }
    } catch (err) {
        console.error('[getResumenDashboard]', err)
        return { data: null, error: 'Error al cargar el resumen del dashboard.' }
    }
}
