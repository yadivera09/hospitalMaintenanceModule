import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Usa cookies de sesión: nunca puede prerenderizarse.
export const dynamic = 'force-dynamic'

/**
 * GET /api/offline/reportes?tecnico_id=<uuid>
 *
 * Reportes del técnico con TODAS sus colecciones, para guardarlos en IndexedDB.
 *
 * Por qué van completos y no solo la cabecera:
 *   Offline hay que poder abrir el detalle y, sobre todo, DUPLICAR un reporte.
 *   Duplicar significa arrancar un borrador nuevo copiando checklist, insumos,
 *   accesorios y técnicos de apoyo del original. Si aquí solo viajara la
 *   cabecera, duplicar exigiría cuatro consultas más — justo lo que no hay sin
 *   red. Con el reporte completo en el dispositivo, la duplicación es una copia
 *   en memoria.
 *
 * Se limita a los reportes cerrados o pendientes de firma: los borradores
 * abiertos viven en 'reportes_borrador', que es una store distinta y con otro
 * ciclo de vida.
 */

/** Tope de reportes a cachear. Los técnicos duplican trabajo reciente. */
const LIMITE = 100

export async function GET(req: NextRequest) {
    const tecnicoId = req.nextUrl.searchParams.get('tecnico_id')

    if (!tecnicoId) {
        return NextResponse.json({ error: 'tecnico_id requerido.' }, { status: 400 })
    }

    try {
        const supabase = createClient()

        const { data: reportes, error } = await supabase
            .from('reportes_mantenimiento')
            .select(`
                *,
                equipo:equipos(id, codigo_mh, nombre, marca, modelo, numero_serie, categoria_id),
                tipo_mantenimiento:tipos_mantenimiento(id, nombre)
            `)
            .eq('tecnico_principal_id', tecnicoId)
            .eq('activo', true)
            .order('fecha_inicio', { ascending: false })
            .limit(LIMITE)

        if (error) throw error

        const ids = (reportes ?? []).map((r) => r.id)

        if (ids.length === 0) {
            return NextResponse.json({ reportes: [] })
        }

        // Las colecciones se traen en cuatro consultas por lote y se agrupan en
        // memoria. Una por reporte serían 4×N viajes para el mismo resultado.
        const [apoyo, usados, requeridos, accesorios, checklist] = await Promise.all([
            supabase
                .from('reporte_tecnicos')
                .select('reporte_id, tecnico_id, rol')
                .in('reporte_id', ids)
                .eq('rol', 'apoyo'),
            supabase
                .from('reporte_insumos_usados')
                .select('reporte_id, insumo_id, cantidad, insumo:insumos(nombre, codigo, unidad_medida)')
                .in('reporte_id', ids),
            supabase
                .from('reporte_insumos_requeridos')
                .select('reporte_id, insumo_id, cantidad, observacion, insumo:insumos(nombre, codigo, unidad_medida)')
                .in('reporte_id', ids),
            supabase
                .from('reporte_accesorios')
                .select('reporte_id, descripcion, cantidad, estado_equipo_contexto')
                .in('reporte_id', ids),
            supabase
                .from('reporte_actividades')
                .select(`
                    reporte_id, actividad_id, completada, observacion,
                    actividad:actividades_checklist(descripcion, obligatoria)
                `)
                .in('reporte_id', ids),
        ])

        // Arrow function y no `function`: el chequeo de tipos corre con target
        // ES5 (tsconfig.json no lo declara) y ahí una declaración de función
        // dentro de un bloque es un error en modo estricto.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const agrupar = (filas: any[] | null | undefined): Record<string, any[]> => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mapa: Record<string, any[]> = {}
            for (const fila of filas ?? []) {
                ;(mapa[fila.reporte_id] ??= []).push(fila)
            }
            return mapa
        }

        const apoyoMap      = agrupar(apoyo.data)
        const usadosMap     = agrupar(usados.data)
        const requeridosMap = agrupar(requeridos.data)
        const accesoriosMap = agrupar(accesorios.data)
        // El fallo de una colección no debe tumbar el precache entero: es
        // preferible un reporte cacheado sin checklist que ningún reporte.
        const checklistMap  = agrupar(checklist.error ? [] : checklist.data)

        const completos = (reportes ?? []).map((r) => ({
            ...r,
            tecnicos_apoyo:      (apoyoMap[r.id] ?? []).map((t) => t.tecnico_id),
            insumos_usados:      usadosMap[r.id] ?? [],
            insumos_requeridos:  requeridosMap[r.id] ?? [],
            accesorios:          accesoriosMap[r.id] ?? [],
            checklist:           checklistMap[r.id] ?? [],
        }))

        return NextResponse.json({ reportes: completos })
    } catch (err) {
        console.error('[/api/offline/reportes]', err)
        return NextResponse.json({ error: 'Error al cargar reportes.' }, { status: 500 })
    }
}
