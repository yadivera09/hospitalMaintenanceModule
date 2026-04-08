'use server'

/**
 * src/app/actions/analisis.ts
 * Server actions para la página de Análisis de reportes.
 * Tab 1 — Equipos con más reportes, todos los tipos, umbrales relativos
 * Tab 2 — Duración de intervenciones (hora_entrada → hora_salida)
 */

import { createClient } from '@/lib/supabase/server'
import type { VistaCorrectivosModelo, VistaDuracionIntervencion } from '@/types'

// =============================================================================
// TAB 1 — EQUIPOS PROBLEMÁTICOS (todos los tipos, umbrales relativos)
// =============================================================================

export async function getEquiposProblematicos(): Promise<{
    data: VistaCorrectivosModelo[]
    error: string | null
}> {
    try {
        const supabase = createClient()

        const { data, error } = await supabase
            .from('reportes_mantenimiento')
            .select(`
                id,
                equipo_id,
                fecha_inicio,
                equipo:equipos(
                    marca,
                    modelo,
                    categoria:categorias_equipo(nombre)
                ),
                tipo:tipos_mantenimiento(nombre, es_planificado)
            `)
            .in('estado_reporte', ['pendiente_firma_cliente', 'cerrado'])
            .eq('activo', true)

        if (error) throw error

        // Agrupar por marca + modelo + categoría — todos los tipos
        const groups = new Map<string, {
            marca: string
            modelo: string
            nombre_categoria: string
            equipoIds: Set<string>
            count: number
            ultimaFecha: string | null
            tipoCounts: Map<string, number>
        }>()

        for (const r of (data ?? [])) {
            const marca = (r.equipo as any)?.marca ?? '—'
            const modelo = (r.equipo as any)?.modelo ?? '—'
            const cat = (r.equipo as any)?.categoria?.nombre ?? '—'
            const key = `${marca}||${modelo}||${cat}`
            const tipoNombre = (r.tipo as any)?.nombre ?? '—'

            if (!groups.has(key)) {
                groups.set(key, { marca, modelo, nombre_categoria: cat, equipoIds: new Set(), count: 0, ultimaFecha: null, tipoCounts: new Map() })
            }
            const g = groups.get(key)!
            g.count++
            g.equipoIds.add(r.equipo_id)
            if (!g.ultimaFecha || r.fecha_inicio > g.ultimaFecha) g.ultimaFecha = r.fecha_inicio
            g.tipoCounts.set(tipoNombre, (g.tipoCounts.get(tipoNombre) ?? 0) + 1)
        }

        const totals = Array.from(groups.values()).map(g => g.count)

        // Umbrales relativos: avg ± desviación estándar
        const avg = totals.reduce((s, v) => s + v, 0) / (totals.length || 1)
        const stddev = Math.sqrt(totals.reduce((s, v) => s + (v - avg) ** 2, 0) / (totals.length || 1))
        const umbralCritico = avg + stddev
        const umbralAlerta = avg

        const result: VistaCorrectivosModelo[] = Array.from(groups.values())
            .map(g => {
                // Tipo más frecuente
                let tipoFrecuente = '—'
                let maxCount = 0
                for (const [nombre, cnt] of g.tipoCounts) {
                    if (cnt > maxCount) { maxCount = cnt; tipoFrecuente = nombre }
                }

                const nivel: VistaCorrectivosModelo['nivel_alerta'] =
                    g.count >= umbralCritico ? 'critico' : g.count >= umbralAlerta ? 'alerta' : 'normal'

                return {
                    marca: g.marca,
                    modelo: g.modelo,
                    nombre_categoria: g.nombre_categoria,
                    total_correctivos: g.count,
                    equipos_afectados: g.equipoIds.size,
                    promedio_correctivos_por_equipo: parseFloat((g.count / g.equipoIds.size).toFixed(2)),
                    ultimo_correctivo: g.ultimaFecha,
                    nivel_alerta: nivel,
                    tipo_frecuente: tipoFrecuente,
                }
            })
            .sort((a, b) => b.total_correctivos - a.total_correctivos)

        return { data: result, error: null }
    } catch (err) {
        console.error('[getEquiposProblematicos]', err)
        return { data: [], error: 'Error al cargar equipos problemáticos' }
    }
}

// =============================================================================
// TAB 2 — DURACIÓN DE INTERVENCIONES
// =============================================================================

export async function getDuracionIntervenciones(): Promise<{
    data: VistaDuracionIntervencion[]
    error: string | null
}> {
    try {
        const supabase = createClient()

        const { data, error } = await supabase
            .from('reportes_mantenimiento')
            .select(`
                id,
                fecha_inicio,
                hora_entrada,
                hora_salida,
                equipo:equipos(codigo_mh, marca, modelo),
                tipo:tipos_mantenimiento(nombre),
                tecnico:tecnicos(nombre, apellido)
            `)
            .in('estado_reporte', ['pendiente_firma_cliente', 'cerrado'])
            .not('hora_entrada', 'is', null)
            .not('hora_salida', 'is', null)
            .order('fecha_inicio', { ascending: false })
            .limit(50)

        if (error) throw error

        const result: VistaDuracionIntervencion[] = (data ?? []).map((r: any) => {
            let duracion_minutos: number | null = null
            if (r.hora_entrada && r.hora_salida) {
                const [hE, mE] = (r.hora_entrada as string).split(':').map(Number)
                const [hS, mS] = (r.hora_salida as string).split(':').map(Number)
                const diff = (hS * 60 + mS) - (hE * 60 + mE)
                duracion_minutos = diff > 0 ? diff : null
            }

            return {
                id_reporte: r.id,
                codigo_mh: r.equipo?.codigo_mh ?? '—',
                marca: r.equipo?.marca ?? '—',
                modelo: r.equipo?.modelo ?? '—',
                nombre_tipo: r.tipo?.nombre ?? '—',
                fecha_ejecucion: r.fecha_inicio,
                hora_entrada: r.hora_entrada,
                hora_salida: r.hora_salida,
                duracion_minutos,
                tecnico_responsable: r.tecnico
                    ? `${r.tecnico.nombre} ${r.tecnico.apellido}`
                    : '—',
                cliente_nombre: null,
            } satisfies VistaDuracionIntervencion
        })

        return { data: result, error: null }
    } catch (err) {
        console.error('[getDuracionIntervenciones]', err)
        return { data: [], error: 'Error al cargar duración de intervenciones' }
    }
}
