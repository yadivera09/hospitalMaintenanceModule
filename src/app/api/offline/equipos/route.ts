import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/offline/equipos?tecnico_id=<uuid>
 * Devuelve equipos activos enriquecidos con cliente, contrato y ubicación
 * para caché offline. Usa la misma lógica que getEquipos() del panel online.
 * Requiere sesión activa (cookie de Supabase).
 */
export async function GET(req: NextRequest) {
    const tecnicoId = req.nextUrl.searchParams.get('tecnico_id')
    if (!tecnicoId) {
        return NextResponse.json({ error: 'tecnico_id requerido.' }, { status: 400 })
    }

    try {
        const supabase = createClient()

        // Equipos activos con categoría y tipo de mantenimiento
        const { data: equipos, error: equiposError } = await supabase
            .from('equipos')
            .select(`
                *,
                categoria:categorias_equipo(id, nombre),
                tipo_mantenimiento:tipos_mantenimiento(id, nombre)
            `)
            .eq('activo', true)
            .order('nombre')

        if (equiposError) throw equiposError

        // Contratos vigentes con cliente y ubicación — misma vista que usa getEquipos()
        const { data: vigentes, error: vigentesError } = await supabase
            .from('v_equipo_contrato_vigente')
            .select('equipo_id, cliente_nombre, cliente_id, contrato_id, numero_contrato, ubicacion_id, ubicacion_nombre')

        if (vigentesError) throw vigentesError

        const vigentesMap = Object.fromEntries(
            (vigentes ?? []).map((v) => [v.equipo_id, v])
        )

        // Último reporte preventivo por equipo — misma lógica que getUltimoMantenimientoPreventivo()
        // pero en batch para evitar N+1. Ordenado desc para que el primero por equipo_id sea el más reciente.
        const { data: preventivos } = await supabase
            .from('reportes_mantenimiento')
            .select('equipo_id, fecha_inicio, tipo:tipos_mantenimiento!inner(es_planificado)')
            .eq('tipo.es_planificado', true)
            .in('estado_reporte', ['pendiente_firma_cliente', 'cerrado'])
            .order('fecha_inicio', { ascending: false })

        const preventivoMap: Record<string, string> = {}
        for (const p of preventivos ?? []) {
            if (!preventivoMap[p.equipo_id]) {
                preventivoMap[p.equipo_id] = p.fecha_inicio
            }
        }

        // Combinar: añadir campos denormalizados que el wizard necesita offline
        const equiposEnriquecidos = (equipos ?? []).map((e) => {
            const v = vigentesMap[e.id]
            return {
                ...e,
                categoria_nombre:        (e.categoria as any)?.nombre ?? null,
                cliente_nombre:          v?.cliente_nombre   ?? null,
                cliente_id:              v?.cliente_id       ?? null,
                contrato_id:             v?.contrato_id      ?? null,
                numero_contrato:         v?.numero_contrato  ?? null,
                ubicacion_id:            v?.ubicacion_id     ?? null,
                ubicacion_nombre:        v?.ubicacion_nombre ?? null,
                ultimo_preventivo_fecha: preventivoMap[e.id] ?? null,
            }
        })

        return NextResponse.json({ equipos: equiposEnriquecidos })
    } catch (err) {
        console.error('[/api/offline/equipos]', err)
        return NextResponse.json({ error: 'Error al cargar equipos.' }, { status: 500 })
    }
}
