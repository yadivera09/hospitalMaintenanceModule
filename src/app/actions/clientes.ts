'use server'

/**
 * src/app/actions/clientes.ts
 * Server Actions para el módulo de Clientes.
 * BLOQUE 2 — Conectado a Supabase real.
 */

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { Cliente, Contrato } from '@/types'

// ── Esquema de validación ─────────────────────────────────────────────────────

const ClienteSchema = z.object({
    razon_social: z.string().min(2, 'La razón social debe tener al menos 2 caracteres'),
    ruc: z.string().nullable().optional(),
    email: z.union([z.string().email('Email inválido'), z.literal(''), z.null()]).optional(),
    telefono: z.string().nullable().optional(),
    direccion: z.string().nullable().optional(),
    activo: z.boolean().default(true),
})

export type ClienteInput = z.infer<typeof ClienteSchema>

// ── Tipos de respuesta ────────────────────────────────────────────────────────

type ActionResult<T> = { data: T | null; error: string | null }

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Lista todos los clientes, opcionalmente filtrados por estado.
 */
export async function getClientes(
    filtros?: { activo?: boolean; search?: string }
): Promise<ActionResult<Cliente[]>> {
    try {
        const supabase = createClient()
        let query = supabase
            .from('clientes')
            .select('*')
            .order('razon_social', { ascending: true })

        if (filtros?.activo !== undefined) {
            query = query.eq('activo', filtros.activo)
        }
        if (filtros?.search) {
            query = query.or(`razon_social.ilike.%${filtros.search}%,ruc.ilike.%${filtros.search}%`)
        }

        const { data, error } = await query
        if (error) throw error
        return { data: data as Cliente[], error: null }
    } catch (err) {
        console.error('[getClientes]', err)
        return { data: null, error: 'Error al cargar clientes.' }
    }
}

/**
 * Obtiene un cliente por ID junto con sus contratos asociados.
 */
export async function getClienteById(
    id: string
): Promise<ActionResult<Cliente & { contratos: Contrato[] }>> {
    try {
        const supabase = createClient()
        const [clienteRes, contratosRes] = await Promise.all([
            supabase.from('clientes').select('*').eq('id', id).single(),
            supabase
                .from('contratos')
                .select('*')
                .eq('cliente_id', id)
                .order('fecha_inicio', { ascending: false }),
        ])

        if (clienteRes.error) throw clienteRes.error

        return {
            data: {
                ...(clienteRes.data as Cliente),
                contratos: (contratosRes.data as Contrato[]) ?? [],
            },
            error: null,
        }
    } catch (err) {
        console.error('[getClienteById]', err)
        return { data: null, error: 'Cliente no encontrado.' }
    }
}

/**
 * Crea un nuevo cliente. Valida con zod antes de insertar.
 */
export async function createCliente(raw: unknown): Promise<ActionResult<Cliente>> {
    const parsed = ClienteSchema.safeParse(raw)
    if (!parsed.success) {
        return { data: null, error: parsed.error.issues[0].message }
    }

    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('clientes')
            .insert({
                razon_social: parsed.data.razon_social,
                ruc: parsed.data.ruc || null,
                email: parsed.data.email || null,
                telefono: parsed.data.telefono || null,
                direccion: parsed.data.direccion || null,
                activo: parsed.data.activo,
            })
            .select()
            .single()

        if (error) {
            if (error.code === '23505') return { data: null, error: 'Ya existe un cliente con ese RUC.' }
            throw error
        }
        return { data: data as Cliente, error: null }
    } catch (err) {
        console.error('[createCliente]', err)
        return { data: null, error: 'Error al crear el cliente.' }
    }
}

/**
 * Actualiza un cliente existente. Valida con zod antes de actualizar.
 */
export async function updateCliente(
    id: string,
    raw: unknown
): Promise<ActionResult<Cliente>> {
    const parsed = ClienteSchema.partial().safeParse(raw)
    if (!parsed.success) {
        return { data: null, error: parsed.error.issues[0].message }
    }

    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('clientes')
            .update({
                ...parsed.data,
                ruc: parsed.data.ruc || null,
                email: parsed.data.email || null,
                telefono: parsed.data.telefono || null,
                direccion: parsed.data.direccion || null,
            })
            .eq('id', id)
            .select()
            .single()

        if (error) {
            if (error.code === '23505') return { data: null, error: 'Ya existe un cliente con ese RUC.' }
            throw error
        }
        return { data: data as Cliente, error: null }
    } catch (err) {
        console.error('[updateCliente]', err)
        return { data: null, error: 'Error al actualizar el cliente.' }
    }
}


/**
 * Activa o desactiva un cliente.
 */
export async function toggleActivoCliente(
    id: string
): Promise<ActionResult<Cliente>> {
    try {
        const supabase = createClient()
        // Primero obtener el estado actual
        const { data: current, error: currentError } = await supabase
            .from('clientes')
            .select('activo')
            .eq('id', id)
            .single()

        if (currentError) throw currentError

        const { data, error } = await supabase
            .from('clientes')
            .update({ activo: !current.activo })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return { data: data as Cliente, error: null }
    } catch (err) {
        console.error('[toggleActivoCliente]', err)
        return { data: null, error: 'Error al cambiar el estado del cliente.' }
    }
}
