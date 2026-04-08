'use server'

/**
 * src/app/actions/contratos.ts
 * Server Actions para el módulo de Contratos.
 * BLOQUE 2 — Conectado a Supabase real.
 */

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { Contrato, Cliente } from '@/types'

// ── Esquema de validación ─────────────────────────────────────────────────────

const ContratoSchema = z.object({
    cliente_id: z.string().uuid('Debes seleccionar un cliente válido'),
    numero_contrato: z.string()
        .min(1, 'El código del contrato es obligatorio')
        .regex(/^\S+$/, 'El código no debe contener espacios')
        .transform(val => val.toUpperCase()),
    fecha_inicio: z.string().min(1, 'La fecha de inicio es obligatoria'),
    fecha_fin: z.string().nullable().optional(),
    tipo_contrato: z.string().min(1, 'Selecciona el tipo de contrato'),
    observaciones: z.string().nullable().optional(),
    activo: z.boolean().default(true),
}).superRefine((d, ctx) => {
    if (d.fecha_fin && d.fecha_inicio > d.fecha_fin) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'La fecha de fin debe ser mayor o igual a la fecha de inicio',
            path: ['fecha_fin']
        })
    }
})

export type ContratoInput = z.infer<typeof ContratoSchema>

type ActionResult<T> = { data: T | null; error: string | null }

// ── ContratoConCliente — shape con join ───────────────────────────────────────

export type ContratoConCliente = Contrato & { cliente: Pick<Cliente, 'id' | 'razon_social'> | null }

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Lista contratos con join a clientes para mostrar razon_social.
 */
export async function getContratos(filtros?: {
    activo?: boolean
    cliente_id?: string
    search?: string
}): Promise<ActionResult<ContratoConCliente[]>> {
    try {
        const supabase = createClient()
        let query = supabase
            .from('contratos')
            .select(`*, cliente:clientes!inner(id, razon_social)`)
            .order('created_at', { ascending: false })

        if (filtros?.activo !== undefined) query = query.eq('activo', filtros.activo)
        if (filtros?.cliente_id) query = query.eq('cliente_id', filtros.cliente_id)
        if (filtros?.search) {
            query = query.or(`numero_contrato.ilike.%${filtros.search}%,clientes.razon_social.ilike.%${filtros.search}%`)
        }

        const { data, error } = await query
        if (error) throw error
        return { data: data as ContratoConCliente[], error: null }
    } catch (err) {
        console.error('[getContratos]', err)
        return { data: null, error: 'Error al cargar contratos.' }
    }
}

/**
 * Detalle de un contrato con equipos asignados actualmente (desde v_equipo_contrato_vigente).
 */
export async function getContratoById(id: string): Promise<ActionResult<ContratoConCliente & { equipos: unknown[] }>> {
    try {
        const supabase = createClient()
        const [contratoRes, equiposRes] = await Promise.all([
            supabase
                .from('contratos')
                .select(`*, cliente:clientes(id, razon_social, ruc, email, telefono, direccion)`)
                .eq('id', id)
                .single(),
            supabase
                .from('v_equipo_contrato_vigente')
                .select('equipo_id, codigo_mh, equipo_nombre, numero_serie, categoria_nombre, ubicacion_nombre')
                .eq('contrato_id', id),
        ])

        if (contratoRes.error) throw contratoRes.error

        return {
            data: {
                ...(contratoRes.data as ContratoConCliente),
                equipos: equiposRes.data ?? [],
            },
            error: null,
        }
    } catch (err) {
        console.error('[getContratoById]', err)
        return { data: null, error: 'Contrato no encontrado.' }
    }
}

/**
 * Crea un nuevo contrato. Valida con zod antes de insertar.
 */
export async function createContrato(raw: unknown): Promise<ActionResult<Contrato>> {
    const parsed = ContratoSchema.safeParse(raw)
    if (!parsed.success) {
        return { data: null, error: parsed.error.issues[0].message }
    }

    try {
        const supabase = createClient()

        // Verificar que el cliente existe y está activo
        const { data: clienteReq, error: clienteErr } = await supabase
            .from('clientes')
            .select('id, activo')
            .eq('id', parsed.data.cliente_id)
            .single()

        if (clienteErr || !clienteReq) return { data: null, error: 'Cliente no encontrado.' }
        if (!clienteReq.activo) return { data: null, error: 'No se puede crear un contrato para un cliente inactivo.' }

        const { data, error } = await supabase
            .from('contratos')
            .insert({
                cliente_id: parsed.data.cliente_id,
                numero_contrato: parsed.data.numero_contrato,
                fecha_inicio: parsed.data.fecha_inicio,
                fecha_fin: parsed.data.fecha_fin || null,
                tipo_contrato: parsed.data.tipo_contrato,
                observaciones: parsed.data.observaciones || null,
                activo: parsed.data.activo,
            })
            .select()
            .single()

        if (error) {
            if (error.code === '23505') return { data: null, error: `Ya existe un contrato con el código "${parsed.data.numero_contrato}".` }
            throw error
        }
        return { data: data as Contrato, error: null }
    } catch (err) {
        console.error('[createContrato]', err)
        return { data: null, error: 'Error al crear el contrato.' }
    }
}

/**
 * Actualiza un contrato existente. Valida con zod.
 */
export async function updateContrato(
    id: string,
    raw: unknown
): Promise<ActionResult<Contrato>> {
    const parsed = ContratoSchema.partial().superRefine((d, ctx) => {
        if (d.fecha_inicio && d.fecha_fin && d.fecha_inicio > d.fecha_fin) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La fecha de fin debe ser mayor o igual a la de inicio', path: ['fecha_fin'] })
        }
    }).safeParse(raw)

    if (!parsed.success) {
        return { data: null, error: parsed.error.issues[0].message }
    }

    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('contratos')
            .update({
                ...parsed.data,
                fecha_fin: parsed.data.fecha_fin || null,
                observaciones: parsed.data.observaciones || null,
            })
            .eq('id', id)
            .select()
            .single()

        if (error) {
            if (error.code === '23505') return { data: null, error: 'Ya existe un contrato con ese código.' }
            throw error
        }
        return { data: data as Contrato, error: null }
    } catch (err) {
        console.error('[updateContrato]', err)
        return { data: null, error: 'Error al actualizar el contrato.' }
    }
}

/**
 * Alterna el estado activo de un contrato dado su ID.
 */
export async function toggleActivoContrato(id: string): Promise<ActionResult<boolean>> {
    try {
        const supabase = createClient()
        const { data: current, error: fetchErr } = await supabase
            .from('contratos')
            .select('activo')
            .eq('id', id)
            .single()

        if (fetchErr) throw fetchErr

        const { error: updateErr } = await supabase
            .from('contratos')
            .update({ activo: !current.activo })
            .eq('id', id)

        if (updateErr) throw updateErr

        return { data: !current.activo, error: null }
    } catch (err) {
        console.error('[toggleActivoContrato]', err)
        return { data: null, error: 'Error al cambiar estado del contrato.' }
    }
}

