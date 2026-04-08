'use server'

/**
 * src/app/actions/catalogos.ts
 * Server Actions para catálogos: categorias_equipo, insumos, ubicaciones, actividades_checklist.
 * BLOQUE 2 — Conectado a Supabase real.
 */

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

type ActionResult<T> = { data: T | null; error: string | null }

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface Categoria {
    id: string
    nombre: string
    descripcion: string | null
    activa: boolean
    created_at: string
    updated_at: string
}

export interface Insumo {
    id: string
    nombre: string
    codigo: string | null
    unidad_medida: string
    descripcion: string | null
    activo: boolean
    created_at: string
    updated_at: string
}

export interface Ubicacion {
    id: string
    cliente_id: string
    nombre: string
    descripcion: string | null
    activa: boolean
    created_at: string
    updated_at: string
}

export interface UbicacionConCliente extends Ubicacion {
    cliente?: {
        id: string
        razon_social: string
    }
}

export interface ActividadChecklist {
    id: string
    categoria_id: string
    descripcion: string
    orden: number
    obligatoria: boolean
    activa: boolean
    created_at: string
    updated_at: string
}

export interface TipoMantenimiento {
    id: string
    nombre: string
    descripcion: string | null
    periodicidad_dias: number
    es_planificado: boolean
    activo: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS ZOD
// ─────────────────────────────────────────────────────────────────────────────

const CategoriaSchema = z.object({
    nombre: z.string().min(1, 'El nombre es obligatorio'),
    descripcion: z.string().nullable().optional(),
    activa: z.boolean().default(true),
})

const InsumoSchema = z.object({
    nombre: z.string().min(1, 'El nombre es obligatorio'),
    codigo: z.string().nullable().optional(),
    unidad_medida: z.string().default('unidad'),
    descripcion: z.string().nullable().optional(),
    activo: z.boolean().default(true),
})

const UbicacionSchema = z.object({
    cliente_id: z.string().uuid('Debes seleccionar un cliente'),
    nombre: z.string().min(1, 'El nombre es obligatorio'),
    descripcion: z.string().nullable().optional(),
    activa: z.boolean().default(true),
})

const ActividadSchema = z.object({
    categoria_id: z.string().uuid('Debes seleccionar una categoría'),
    descripcion: z.string().min(3, 'La descripción debe tener al menos 3 caracteres'),
    orden: z.number().int().default(0),
    obligatoria: z.boolean().default(false),
    activa: z.boolean().default(true),
})

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS MANTENIMIENTO
// ─────────────────────────────────────────────────────────────────────────────
export async function getTiposMantenimiento(): Promise<ActionResult<TipoMantenimiento[]>> {
    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('tipos_mantenimiento')
            .select('*')
            .eq('activo', true)
            .order('nombre', { ascending: true })

        if (error) throw error
        return { data: data as TipoMantenimiento[], error: null }
    } catch (err) {
        console.error('[getTiposMantenimiento]', err)
        return { data: null, error: 'Error al cargar tipos de mantenimiento.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORÍAS
// ─────────────────────────────────────────────────────────────────────────────

export async function getCategorias(soloActivas?: boolean): Promise<ActionResult<Categoria[]>> {
    try {
        const supabase = createClient()
        let query = supabase
            .from('categorias_equipo')
            .select('*')
            .order('nombre', { ascending: true })

        if (soloActivas) {
            query = query.eq('activa', true)
        }

        const { data, error } = await query
        if (error) throw error
        return { data: data as Categoria[], error: null }
    } catch (err) {
        console.error('[getCategorias]', err)
        return { data: null, error: 'Error al cargar categorías.' }
    }
}

export async function createCategoria(raw: unknown): Promise<ActionResult<Categoria>> {
    const parsed = CategoriaSchema.safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('categorias_equipo')
            .insert(parsed.data)
            .select()
            .single()
        if (error) {
            if (error.code === '23505') return { data: null, error: 'Ya existe una categoría con ese nombre.' }
            throw error
        }
        return { data: data as Categoria, error: null }
    } catch (err) {
        console.error('[createCategoria]', err)
        return { data: null, error: 'Error al crear la categoría.' }
    }
}

export async function updateCategoria(id: string, raw: unknown): Promise<ActionResult<Categoria>> {
    const parsed = CategoriaSchema.partial().safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('categorias_equipo')
            .update(parsed.data)
            .eq('id', id)
            .select()
            .single()
        if (error) throw error
        return { data: data as Categoria, error: null }
    } catch (err) {
        console.error('[updateCategoria]', err)
        return { data: null, error: 'Error al actualizar la categoría.' }
    }
}

/** Alterna el estado activa/inactiva de una categoría */
export async function toggleActivaCategoria(id: string): Promise<ActionResult<boolean>> {
    try {
        const supabase = createClient()
        const { data: current, error: fetchErr } = await supabase.from('categorias_equipo').select('activa').eq('id', id).single()
        if (fetchErr) throw fetchErr

        const { error: updateErr } = await supabase.from('categorias_equipo').update({ activa: !current.activa }).eq('id', id)
        if (updateErr) throw updateErr

        return { data: !current.activa, error: null }
    } catch (err) {
        return { data: null, error: 'Error al cambiar estado de la categoría.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// INSUMOS
// ─────────────────────────────────────────────────────────────────────────────

export async function getInsumos(filtros?: { activo?: boolean, search?: string }): Promise<ActionResult<Insumo[]>> {
    try {
        const supabase = createClient()
        let query = supabase
            .from('insumos')
            .select('*')
            .order('nombre', { ascending: true })

        if (filtros?.activo !== undefined) query = query.eq('activo', filtros.activo)
        if (filtros?.search) {
            query = query.or(`nombre.ilike.%${filtros.search}%,codigo.ilike.%${filtros.search}%`)
        }

        const { data, error } = await query
        if (error) throw error
        return { data: data as Insumo[], error: null }
    } catch (err) {
        console.error('[getInsumos]', err)
        return { data: null, error: 'Error al cargar insumos.' }
    }
}

export async function createInsumo(raw: unknown): Promise<ActionResult<Insumo>> {
    const parsed = InsumoSchema.safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('insumos')
            .insert({ ...parsed.data, codigo: parsed.data.codigo || null })
            .select()
            .single()
        if (error) {
            if (error.code === '23505') return { data: null, error: 'Ya existe un insumo con ese código.' }
            throw error
        }
        return { data: data as Insumo, error: null }
    } catch (err) {
        console.error('[createInsumo]', err)
        return { data: null, error: 'Error al crear el insumo.' }
    }
}

export async function updateInsumo(id: string, raw: unknown): Promise<ActionResult<Insumo>> {
    const parsed = InsumoSchema.partial().safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('insumos')
            .update({ ...parsed.data, codigo: parsed.data.codigo || null })
            .eq('id', id)
            .select()
            .single()
        if (error) throw error
        return { data: data as Insumo, error: null }
    } catch (err) {
        console.error('[updateInsumo]', err)
        return { data: null, error: 'Error al actualizar el insumo.' }
    }
}

export async function toggleActivoInsumo(id: string): Promise<ActionResult<boolean>> {
    try {
        const supabase = createClient()
        const { data: current, error: fetchErr } = await supabase.from('insumos').select('activo').eq('id', id).single()
        if (fetchErr) throw fetchErr

        const { error: updateErr } = await supabase.from('insumos').update({ activo: !current.activo }).eq('id', id)
        if (updateErr) throw updateErr

        return { data: !current.activo, error: null }
    } catch (err) {
        return { data: null, error: 'Error al cambiar estado del insumo.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// UBICACIONES
// ─────────────────────────────────────────────────────────────────────────────

export async function getUbicaciones(clienteId?: string): Promise<ActionResult<UbicacionConCliente[]>> {
    try {
        const supabase = createClient()
        let query = supabase
            .from('ubicaciones')
            .select('*, cliente:clientes!inner(id, razon_social)')
            .order('nombre', { ascending: true })

        if (clienteId && clienteId !== 'todos') {
            query = query.eq('cliente_id', clienteId)
        }

        const { data, error } = await query
        if (error) throw error
        return { data: data as UbicacionConCliente[], error: null }
    } catch (err) {
        console.error('[getUbicaciones]', err)
        return { data: null, error: 'Error al cargar ubicaciones.' }
    }
}

export async function createUbicacion(raw: unknown): Promise<ActionResult<Ubicacion>> {
    const parsed = UbicacionSchema.safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('ubicaciones')
            .insert(parsed.data)
            .select()
            .single()
        if (error) throw error
        return { data: data as Ubicacion, error: null }
    } catch (err) {
        console.error('[createUbicacion]', err)
        return { data: null, error: 'Error al crear la ubicación.' }
    }
}

export async function updateUbicacion(id: string, raw: unknown): Promise<ActionResult<Ubicacion>> {
    const parsed = UbicacionSchema.partial().safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('ubicaciones')
            .update(parsed.data)
            .eq('id', id)
            .select()
            .single()
        if (error) throw error
        return { data: data as Ubicacion, error: null }
    } catch (err) {
        console.error('[updateUbicacion]', err)
        return { data: null, error: 'Error al actualizar la ubicación.' }
    }
}

export async function toggleActivaUbicacion(id: string): Promise<ActionResult<boolean>> {
    try {
        const supabase = createClient()
        const { data: current, error: fetchErr } = await supabase.from('ubicaciones').select('activa').eq('id', id).single()
        if (fetchErr) throw fetchErr

        const { error: updateErr } = await supabase.from('ubicaciones').update({ activa: !current.activa }).eq('id', id)
        if (updateErr) throw updateErr

        return { data: !current.activa, error: null }
    } catch (err) {
        return { data: null, error: 'Error al cambiar estado de la ubicación.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVIDADES CHECKLIST
// ─────────────────────────────────────────────────────────────────────────────

export async function getActividadesByCategoria(
    categoriaId: string
): Promise<ActionResult<ActividadChecklist[]>> {
    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('actividades_checklist')
            .select('*')
            .eq('categoria_id', categoriaId)
            .order('orden', { ascending: true })
        if (error) throw error
        return { data: data as ActividadChecklist[], error: null }
    } catch (err) {
        console.error('[getActividadesByCategoria]', err)
        return { data: null, error: 'Error al cargar actividades.' }
    }
}

export async function createActividad(raw: unknown): Promise<ActionResult<ActividadChecklist>> {
    const parsed = ActividadSchema.safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('actividades_checklist')
            .insert(parsed.data)
            .select()
            .single()
        if (error) throw error
        return { data: data as ActividadChecklist, error: null }
    } catch (err) {
        console.error('[createActividad]', err)
        return { data: null, error: 'Error al crear la actividad.' }
    }
}

export async function updateActividad(id: string, raw: unknown): Promise<ActionResult<ActividadChecklist>> {
    const parsed = ActividadSchema.partial().safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('actividades_checklist')
            .update(parsed.data)
            .eq('id', id)
            .select()
            .single()
        if (error) throw error
        return { data: data as ActividadChecklist, error: null }
    } catch (err) {
        console.error('[updateActividad]', err)
        return { data: null, error: 'Error al actualizar la actividad.' }
    }
}

export async function toggleActivaActividad(id: string): Promise<ActionResult<boolean>> {
    try {
        const supabase = createClient()
        const { data: current, error: fetchErr } = await supabase.from('actividades_checklist').select('activa').eq('id', id).single()
        if (fetchErr) throw fetchErr

        const { error: updateErr } = await supabase.from('actividades_checklist').update({ activa: !current.activa }).eq('id', id)
        if (updateErr) throw updateErr

        return { data: !current.activa, error: null }
    } catch (err) {
        return { data: null, error: 'Error al cambiar estado de la actividad.' }
    }
}

export async function reordenarActividades(items: { id: string, orden: number }[]): Promise<ActionResult<boolean>> {
    try {
        if (!items || items.length === 0) return { data: true, error: null }

        const supabase = createClient()

        // Loop simple porque Upsert bulk en supabase js sin usar RPC a veces es estricto en los campos faltantes,
        // Al ser pocos (< 50) un `for` es adecuado.
        for (const item of items) {
            const { error } = await supabase
                .from('actividades_checklist')
                .update({ orden: item.orden })
                .eq('id', item.id)
            if (error) throw error
        }

        return { data: true, error: null }
    } catch (err) {
        console.error('[reordenarActividades]', err)
        return { data: null, error: 'Error al reordenar las actividades.' }
    }
}
