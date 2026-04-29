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

/**
 * Obtiene el técnico actual basado en la sesión del usuario autenticado.
 * Usa el servidor (cookies) para obtener el user_id, luego busca en tecnicos.
 * Fallback: si no encuentra por user_id, intenta por email del usuario Auth.
 */
export async function getTecnicoActual(): Promise<ActionResult<{ id: string; nombre: string; apellido: string; user_id: string | null }>> {
    try {
        const supabase = createClient()
        const { data: { session }, error: authErr } = await supabase.auth.getSession()

        if (authErr || !session?.user) {
            console.error('[getTecnicoActual] No hay sesión:', authErr?.message)
            return { data: null, error: 'No se detectó sesión de usuario.' }
        }

        const user = session.user

        // Usar adminClient para evitar problemas de RLS en producción
        const admin = createAdminClient()

        const { data: tecnico, error: tecError } = await admin
            .from('tecnicos')
            .select('id, nombre, apellido, user_id')
            .eq('user_id', user.id)
            .eq('activo', true)
            .single()

        if (tecnico) {
            return { data: tecnico, error: null }
        }

        // Fallback por email
        if (user.email) {
            const { data: tecByEmail } = await admin
                .from('tecnicos')
                .select('id, nombre, apellido, user_id')
                .eq('email', user.email)
                .eq('activo', true)
                .single()

            if (tecByEmail) {
                if (!tecByEmail.user_id) {
                    await admin
                        .from('tecnicos')
                        .update({ user_id: user.id })
                        .eq('id', tecByEmail.id)
                    tecByEmail.user_id = user.id
                }
                return { data: tecByEmail, error: null }
            }
        }

        console.error('[getTecnicoActual] tecError:', tecError?.message)
        return { data: null, error: 'No se encontró un técnico vinculado a esta cuenta.' }
    } catch (err) {
        console.error('[getTecnicoActual] excepción:', err)
        return { data: null, error: 'Error al detectar identidad del técnico.' }
    }
}

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

    // ── Generar contraseña temporal: 3 letras nombre + 3 apellido + 123 ──────
    // Ej: "Yadira Vera" → "yadver123"
    function generarPasswordTemporal(nombre: string, apellido: string): string {
        const n = nombre.trim().toLowerCase().replace(/\s+/g, '').slice(0, 3).padEnd(3, 'x')
        const a = apellido.trim().toLowerCase().replace(/\s+/g, '').slice(0, 3).padEnd(3, 'x')
        return `${n}${a}123`
    }

    const passwordTemporal = generarPasswordTemporal(parsed.data.nombre, parsed.data.apellido)

    // ── Paso 1: crear usuario en Auth con contraseña temporal ─────────────────
    const { data: createData, error: createErr } = await admin.auth.admin.createUser({
        email: parsed.data.email,
        password: passwordTemporal,
        email_confirm: true,           // confirmar email automáticamente
        user_metadata: {
            rol: 'tecnico',
            debe_cambiar_password: true,
            nombre: parsed.data.nombre,
            apellido: parsed.data.apellido,
        },
    })

    if (createErr) {
        if (createErr.message?.toLowerCase().includes('already been registered') ||
            createErr.message?.toLowerCase().includes('already exists')) {
            return { data: null, error: 'Este email ya tiene una cuenta en el sistema.' }
        }
        console.error('[createTecnico] createUser', createErr)
        return { data: null, error: 'No se pudo crear el usuario. Intenta de nuevo.' }
    }

    const userId = createData.user.id

    // ── Paso 2: insertar fila en tecnicos ─────────────────────────────────────
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
            await admin.auth.admin.deleteUser(userId)
            if (error.code === '23505') return { data: null, error: 'Ya existe un técnico con ese email o cédula.' }
            throw error
        }

        return {
            data: {
                ...(data as Tecnico),
                // @ts-expect-error campo extra solo para mostrar al admin
                passwordTemporal,
            },
            error: null
        }
    } catch (err) {
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

/**
 * Desactiva un técnico (soft delete).
 * Verifica que no tenga reportes de mantenimiento activos (no cerrados) asignados como técnico principal.
 * NUNCA elimina físicamente — solo cambia activo = false.
 */
export async function desactivarTecnico(id: string): Promise<ActionResult<boolean>> {
    try {
        const supabase = createClient()

        // 1. Verificar reportes activos donde este técnico es el principal
        const { count, error: countErr } = await supabase
            .from('reportes_mantenimiento')
            .select('*', { count: 'exact', head: true })
            .eq('tecnico_principal_id', id)
            .neq('estado_reporte', 'cerrado')

        if (countErr) throw countErr

        if ((count ?? 0) > 0) {
            return {
                data: null,
                error: `No se puede desactivar: el técnico tiene ${count} reporte(s) de mantenimiento en curso asignados. Reasígnalos o ciérralos primero.`,
            }
        }

        // 2. Soft delete
        const { error } = await supabase
            .from('tecnicos')
            .update({ activo: false })
            .eq('id', id)

        if (error) throw error
        return { data: true, error: null }
    } catch (err) {
        console.error('[desactivarTecnico]', err)
        return { data: null, error: 'Error al desactivar el técnico.' }
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
    } catch {
        return { data: null, error: 'Error al cambiar estado del técnico.' }
    }
}
