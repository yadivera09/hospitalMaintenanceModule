import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/offline/catalogs
 * Devuelve todos los catálogos necesarios para el modo offline en una sola llamada.
 * Requiere sesión activa (cookie de Supabase).
 */
export async function GET() {
    try {
        const supabase = createClient()

        const [tiposRes, insumosRes, categoriasRes, checklistsRes] = await Promise.all([
            supabase
                .from('tipos_mantenimiento')
                .select('*')
                .eq('activo', true)
                .order('nombre'),
            supabase
                .from('insumos')
                .select('*')
                .eq('activo', true)
                .order('nombre'),
            supabase
                .from('categorias_equipo')
                .select('*')
                .eq('activa', true)
                .order('nombre'),
            supabase
                .from('actividades_checklist')
                .select('*')
                .eq('activa', true)
                .order('categoria_id, orden'),
        ])

        if (tiposRes.error) throw tiposRes.error
        if (insumosRes.error) throw insumosRes.error
        if (categoriasRes.error) throw categoriasRes.error
        if (checklistsRes.error) throw checklistsRes.error

        return NextResponse.json({
            tipos_mantenimiento: tiposRes.data,
            insumos: insumosRes.data,
            categorias: categoriasRes.data,
            checklists: checklistsRes.data,
        })
    } catch (err) {
        console.error('[/api/offline/catalogs]', err)
        return NextResponse.json({ error: 'Error al cargar catálogos.' }, { status: 500 })
    }
}
