'use server'

/**
 * src/app/actions/tecnicos.ts
 * Server Actions para el módulo de Técnicos.
 * BLOQUE 2 — Conectado a Supabase real.
 */

import { createClient }      from '@/lib/supabase/server'
import { createAdminClient }  from '@/lib/supabase/admin'
import { z } from 'zod'
import type { Tecnico } from '@/types'

const TecnicoSchema = z.object({
    nombre: z.string().min(1, 'El nombre es obligatorio'),
    apellido: z.string().min(1, 'El apellido es obligatorio'),
    cedula: z
        .string()
        .regex(/^\d{10,}$/, 'La cédula debe tener al menos 10 dígitos numéricos')
        .nullable()
        .optional(),
    email: z.string().email('Email inválido'),
    telefono: z.string().nullable().optional(),
    activo: z.boolean().default(true),
})

type ActionResult<T> = { data: T | null; error: string | null }

// ─────────────────────────────────────────────────────────────────────────────

export async function getTecnicos(filtros?: { activo?: boolean, search?: string }): Promise<ActionResult<Tecnico[]>> {
    try {
        const supabase = createClient()
        let query = supabase
            .from('tecnicos')
            .select('*')
            .order('nombre', { ascending: true })

        if (filtros?.activo !== undefined) query = query.eq('activo', filtros.activo)

        if (filtros?.search) {
            query = query.or(`nombre.ilike.%${filtros.search}%,apellido.ilike.%${filtros.search}%,cedula.ilike.%${filtros.search}%`)
        }

        const { data, error } = await query
        if (error) throw error
        return { data: data as Tecnico[], error: null }
    } catch (err) {
        console.error('[getTecnicos]', err)
        return { data: null, error: 'Error al cargar técnicos.' }
    }
}

export async function getTecnicoById(
    id: string
): Promise<ActionResult<Tecnico & { intervenciones: unknown[] }>> {
    try {
        const supabase = createClient()
        const [tecnicoRes, principalRes, asistenteRes] = await Promise.all([
            supabase.from('tecnicos').select('*').eq('id', id).single(),
            supabase
                .from('reportes_mantenimiento')
                .select(`
                    id, estado_reporte, fecha_inicio, fecha_fin,
                    tipo:tipos_mantenimiento(nombre),
                    equipo:equipos(codigo_mh, nombre, marca, modelo)
                `)
                .eq('tecnico_principal_id', id),
            supabase
                .from('reporte_tecnicos')
                .select(`
                    reporte:reportes_mantenimiento(
                        id, estado_reporte, fecha_inicio, fecha_fin,
                        tipo:tipos_mantenimiento(nombre),
                        equipo:equipos(codigo_mh, nombre, marca, modelo)
                    )
                `)
                .eq('tecnico_id', id)
        ])

        if (tecnicoRes.error) throw tecnicoRes.error

        // Extraer y combinar los reportes de ambas fuentes
        const reportes: any[] = []
        if (principalRes.data) {
            reportes.push(...principalRes.data)
        }
        if (asistenteRes.data) {
            asistenteRes.data.forEach((r) => {
                if (r.reporte && !Array.isArray(r.reporte)) reportes.push(r.reporte)
            })
        }

        // Deduplicar por id, ordenar por fecha_inicio DESC, tomar 5
        const unicosMap = new Map()
        reportes.forEach((r) => unicosMap.set(r.id, r))

        const combinados = Array.from(unicosMap.values())
            .sort((a, b) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime())
            .slice(0, 5)

        return {
            data: {
                ...(tecnicoRes.data as Tecnico),
                intervenciones: combinados,
            },
            error: null,
        }
    } catch (err) {
        console.error('[getTecnicoById]', err)
        return { data: null, error: 'Técnico no encontrado.' }
    }
}

export async function createTecnico(raw: unknown): Promise<ActionResult<Tecnico>> {
    const parsed = TecnicoSchema.safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    const admin = createAdminClient()

    // ── Paso 1: crear usuario en Supabase Auth vía invitación ─────────────────
    // inviteUserByEmail envía el correo de bienvenida automáticamente.
    // El campo `rol` en user_metadata es leído por el middleware para el routing.
    // redirectTo apunta al callback que intercambia el token y redirige a /configurar-mfa.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
        parsed.data.email,
        {
            data: { rol: 'tecnico' },
            redirectTo: `${siteUrl}/auth/callback?next=/configurar-mfa`,
        }
    )

    if (inviteErr) {
        // Supabase devuelve este mensaje cuando el email ya tiene cuenta en Auth.
        // El técnico existe en Auth pero puede que no tenga fila en tecnicos —
        // el admin debe usar el panel de detalle para gestionar ese caso.
        if (inviteErr.message?.toLowerCase().includes('already been registered')) {
            return { data: null, error: 'Este email ya tiene una cuenta en el sistema.' }
        }
        console.error('[createTecnico] inviteUserByEmail', inviteErr)
        return { data: null, error: 'No se pudo enviar la invitación. Intenta de nuevo.' }
    }

    const userId = inviteData.user.id

    // ── Paso 2: insertar fila en tecnicos con el user_id recién creado ─────────
    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('tecnicos')
            .insert({
                user_id:  userId,
                nombre:   parsed.data.nombre,
                apellido: parsed.data.apellido,
                cedula:   parsed.data.cedula || null,
                email:    parsed.data.email,
                telefono: parsed.data.telefono || null,
                activo:   parsed.data.activo,
            })
            .select()
            .single()

        if (error) {
            // Rollback: eliminar el usuario de Auth para no dejar un huérfano.
            await admin.auth.admin.deleteUser(userId)

            if (error.code === '23505') return { data: null, error: 'Ya existe un técnico con ese email o cédula.' }
            throw error
        }

        return { data: data as Tecnico, error: null }
    } catch (err) {
        // Rollback defensivo por si el catch llega después de un error no 23505.
        await admin.auth.admin.deleteUser(userId).catch(() => {})
        console.error('[createTecnico] insert tecnicos', err)
        return { data: null, error: 'Error al registrar el técnico.' }
    }
}

export async function updateTecnico(id: string, raw: unknown): Promise<ActionResult<Tecnico>> {
    const parsed = TecnicoSchema.partial().safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('tecnicos')
            .update({
                ...parsed.data,
                cedula: parsed.data.cedula || null,
                telefono: parsed.data.telefono || null,
            })
            .eq('id', id)
            .select()
            .single()

        if (error) {
            if (error.code === '23505') return { data: null, error: 'Ya existe un técnico con ese email o cédula.' }
            throw error
        }
        return { data: data as Tecnico, error: null }
    } catch (err) {
        console.error('[updateTecnico]', err)
        return { data: null, error: 'Error al actualizar el técnico.' }
    }
}

export async function toggleActivoTecnico(id: string): Promise<ActionResult<boolean>> {
    try {
        const supabase = createClient()
        const { data: current, error: fetchErr } = await supabase.from('tecnicos').select('activo').eq('id', id).single()
        if (fetchErr) throw fetchErr

        const { error: updateErr } = await supabase.from('tecnicos').update({ activo: !current.activo }).eq('id', id)
        if (updateErr) throw updateErr

        return { data: !current.activo, error: null }
    } catch (err) {
        return { data: null, error: 'Error al cambiar estado del técnico.' }
    }
}
