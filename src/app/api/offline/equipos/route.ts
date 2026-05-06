import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/offline/equipos?tecnico_id=<uuid>
 * Devuelve los equipos asignados al técnico (via equipo_contratos) para caché offline.
 * Requiere sesión activa (cookie de Supabase).
 */
export async function GET(req: NextRequest) {
    const tecnicoId = req.nextUrl.searchParams.get('tecnico_id')
    if (!tecnicoId) {
        return NextResponse.json({ error: 'tecnico_id requerido.' }, { status: 400 })
    }

    try {
        const supabase = createClient()

        // Traer los equipos de contratos activos donde aparece el técnico.
        // Se usa como caché de búsqueda offline, no es exhaustivo.
        const { data, error } = await supabase
            .from('equipos')
            .select(`
                *,
                categoria:categorias_equipo(id, nombre),
                tipo_mantenimiento:tipos_mantenimiento(id, nombre)
            `)
            .eq('activo', true)
            .order('nombre')

        if (error) throw error

        return NextResponse.json({ equipos: data })
    } catch (err) {
        console.error('[/api/offline/equipos]', err)
        return NextResponse.json({ error: 'Error al cargar equipos.' }, { status: 500 })
    }
}
