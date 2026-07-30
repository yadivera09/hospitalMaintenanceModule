import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Usa cookies de sesión: nunca puede prerenderizarse.
export const dynamic = 'force-dynamic'

/**
 * GET /api/offline/catalogs
 * Devuelve todos los catálogos necesarios para el modo offline en una sola llamada.
 * Incluye: tipos_mantenimiento, insumos, categorias, checklists, ubicaciones, tecnicos.
 * Requiere sesión activa (cookie de Supabase).
 */
export async function GET() {
    try {
        const supabase = createClient()

        const [
            tiposRes,
            insumosRes,
            categoriasRes,
            checklistsRes,
            ubicacionesRes,
            tecnicosRes,
        ] = await Promise.all([
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
            // Todas las ubicaciones con cliente — el wizard filtra por cliente en modo online,
            // pero offline se muestran todas (sin filtro por cliente).
            supabase
                .from('ubicaciones')
                .select('*, cliente:clientes(id, razon_social)')
                .eq('activa', true)
                .order('nombre'),
            // Técnicos activos — solo campos necesarios para el selector de apoyo.
            supabase
                .from('tecnicos')
                .select('id, nombre, apellido, email, activo')
                .eq('activo', true)
                .order('nombre'),
        ])

        if (tiposRes.error)       throw tiposRes.error
        if (insumosRes.error)     throw insumosRes.error
        if (categoriasRes.error)  throw categoriasRes.error
        if (checklistsRes.error)  throw checklistsRes.error
        if (ubicacionesRes.error) throw ubicacionesRes.error
        if (tecnicosRes.error)    throw tecnicosRes.error

        return NextResponse.json({
            tipos_mantenimiento: tiposRes.data,
            insumos:             insumosRes.data,
            categorias:          categoriasRes.data,
            checklists:          checklistsRes.data,
            ubicaciones:         ubicacionesRes.data,
            tecnicos:            tecnicosRes.data,
        })
    } catch (err) {
        console.error('[/api/offline/catalogs]', err)
        return NextResponse.json({ error: 'Error al cargar catálogos.' }, { status: 500 })
    }
}
