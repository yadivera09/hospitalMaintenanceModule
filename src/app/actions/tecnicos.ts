'use server'

/**
 * src/app/actions/tecnicos.ts
 * Server Actions para el módulo de Técnicos.
 * BLOQUE 2 — Conectado a Supabase real.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
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

type ActionResult<T> = { data: T | null; error: string | null; meta?: any }

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene el técnico actual basado en la sesión del usuario autenticado.
 * Usa el servidor (cookies) para obtener el user_id, luego busca en tecnicos.
 * Fallback: si no encuentra por user_id, intenta por email del usuario Auth.
 */
export async function getTecnicoActual(): Promise<ActionResult<{ id: string; nombre: string; apellido: string; user_id: string | null }>> {
    try {
        const supabase = createClient()

        // getUser() hace una llamada HTTP al servidor de Auth que falla en Vercel (TypeError: fetch failed).
        // El middleware ya validó el JWT en cada request, por lo que getSession() es seguro aquí.
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user

        console.error('[getTecnicoActual] user (from session):', user?.id ?? 'NULL')

        if (!user) {
            return { data: null, error: 'No se detectó sesión de usuario.' }
        }

        const admin = createAdminClient()

        const { data: tecnico } = await admin
            .from('tecnicos')
            .select('id, nombre, apellido, user_id')
            .eq('user_id', user.id)
            .eq('activo', true)
            .maybeSingle()

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
                .maybeSingle()

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

        return { data: null, error: 'No se encontró un técnico vinculado a esta cuenta.' }
    } catch (err) {
        return { data: null, error: 'Error al detectar identidad del técnico.' }
    }
}

export async function getTecnicos(filtros?: { activo?: boolean, search?: string, role?: string }): Promise<ActionResult<Tecnico[]>> {
    try {
        const admin = createAdminClient()

        // Siempre incluimos la relación con usuarios (identidad) para saber quién tiene perfil y quién no
        // Usamos !inner solo si se requiere filtrar por rol de forma estricta
        let selectStr = `
            *,
            usuarios (
                id, user_id,
                usuario_roles (
                    activo,
                    roles (nombre)
                )
            )
        `
        if (filtros?.role) {
            selectStr = `
                *,
                usuarios!inner (
                    id, user_id,
                    usuario_roles!inner (
                        activo,
                        roles!inner(nombre)
                    )
                )
            `
        }

        let query = admin
            .from('tecnicos')
            .select(selectStr)
            .order('nombre', { ascending: true })

        if (filtros?.activo !== undefined) query = query.eq('activo', filtros.activo)

        if (filtros?.search) {
            query = query.or(`nombre.ilike.%${filtros.search}%,apellido.ilike.%${filtros.search}%,cedula.ilike.%${filtros.search}%`)
        }

        if (filtros?.role) {
            query = query.eq('usuarios.usuario_roles.roles.nombre', filtros.role)
            query = query.eq('usuarios.usuario_roles.activo', true)
        }

        const { data, error } = await query
        
        if (error) throw error

        let result = (data ?? []).map(t => {
            const { usuarios, ...tecnico } = t as any
            return tecnico as Tecnico
        })

        return { data: result, error: null }
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

    // ── Paso 2: insertar fila en usuarios (identidad genérica) ──────────────
    try {
        const { data: usuarioData, error: usuarioErr } = await admin
            .from('usuarios')
            .insert({
                user_id: userId,
                nombre: parsed.data.nombre,
                apellido: parsed.data.apellido,
                email: parsed.data.email,
                telefono: parsed.data.telefono || null,
                activo: parsed.data.activo,
            })
            .select()
            .single()

        if (usuarioErr) {
            await admin.auth.admin.deleteUser(userId)
            throw usuarioErr
        }

        // ── Paso 3: asignar rol 'tecnico' ─────────────────────────────────────
        const { data: rolData } = await admin
            .from('roles')
            .select('id')
            .eq('nombre', 'tecnico')
            .single()

        if (rolData) {
            await admin.from('usuario_roles').insert({
                usuario_id: usuarioData.id,
                rol_id: rolData.id,
                activo: true
            })
        }

        // ── Paso 4: insertar fila en tecnicos (perfil de negocio) ─────────────
        const { data, error } = await admin
            .from('tecnicos')
            .insert({
                user_id: userId,
                usuario_id: usuarioData.id,
                nombre: parsed.data.nombre,
                apellido: parsed.data.apellido,
                cedula: parsed.data.cedula || null,
                email: parsed.data.email,
                telefono: parsed.data.telefono || null,
                activo: parsed.data.activo,
            })
            .select()
            .single()

        if (error) {
            // Rollback manual de las tablas creadas
            await admin.from('usuario_roles').delete().eq('usuario_id', usuarioData.id)
            await admin.from('usuarios').delete().eq('id', usuarioData.id)
            await admin.auth.admin.deleteUser(userId)
            
            if (error.code === '23505') return { data: null, error: 'Ya existe un técnico con ese email o cédula.' }
            throw error
        }

        revalidatePath('/admin/tecnicos')
        return {
            data: {
                ...(data as Tecnico),
                // @ts-expect-error campo extra solo para mostrar al admin
                passwordTemporal,
            },
            error: null
        }
    } catch (err) {
        // En caso de error inesperado, intentar borrar el usuario de Auth para evitar huérfanos
        await admin.auth.admin.deleteUser(userId).catch(() => { })
        console.error('[createTecnico] proceso completo', err)
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
        revalidatePath('/admin/tecnicos')
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
        const admin = createAdminClient()

        // 1. Verificar reportes activos donde este técnico es el principal
        const { count, error: countErr } = await admin
            .from('reportes_mantenimiento')
            .select('*', { count: 'exact', head: true })
            .eq('tecnico_principal_id', id)
            .in('estado_reporte', ['en_progreso', 'pendiente_firma_cliente'])

        if (countErr) throw countErr

        if ((count ?? 0) > 0) {
            // Obtener detalle de los reportes bloqueantes
            const { data: reportes } = await admin
                .from('reportes_mantenimiento')
                .select(`
                    id, 
                    numero_reporte_fisico, 
                    estado_reporte,
                    equipos (codigo_mh, nombre)
                `)
                .eq('tecnico_principal_id', id)
                .in('estado_reporte', ['en_progreso', 'pendiente_firma_cliente'])
                .limit(5)

            return {
                data: null,
                error: `No se puede desactivar: el técnico tiene ${count} reporte(s) en progreso o pendientes de firma. Reasígnalos o espera a que finalicen.`,
                meta: {
                    reportes: reportes?.map(r => ({
                        id: r.id,
                        serial: r.numero_reporte_fisico || 'S/N',
                        equipo: (r.equipos as any)?.nombre || (r.equipos as any)?.codigo_mh || 'Equipo desconocido',
                        estado: r.estado_reporte
                    })),
                    total: count,
                    tecnicoId: id
                }
            }
        }

        // 2. Soft delete
        const { error } = await admin
            .from('tecnicos')
            .update({ activo: false })
            .eq('id', id)

        if (error) throw error
        revalidatePath('/admin/tecnicos')
        return { data: true, error: null }
    } catch (err) {
        console.error('[desactivarTecnico]', err)
        return { data: null, error: 'Error al desactivar el técnico.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// eliminarTecnicoDefinitivo — hard delete para limpieza de datos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Elimina permanentemente un técnico de la tabla tecnicos.
 * Solo si no tiene reportes asociados (FK constraint).
 * Útil para limpiar registros huérfanos o de prueba.
 */
export async function eliminarTecnicoDefinitivo(id: string): Promise<ActionResult<boolean>> {
    try {
        const admin = createAdminClient()

        // 1. Verificar si tiene reportes como principal
        const { count: countPrincipal } = await admin
            .from('reportes_mantenimiento')
            .select('*', { count: 'exact', head: true })
            .eq('tecnico_principal_id', id)

        if ((countPrincipal ?? 0) > 0) {
            return { data: null, error: 'HAS_DEPENDENCIES' }
        }

        // 2. Verificar si tiene participaciones como apoyo
        const { count: countApoyo } = await admin
            .from('reporte_tecnicos')
            .select('*', { count: 'exact', head: true })
            .eq('tecnico_id', id)

        if ((countApoyo ?? 0) > 0) {
            return { data: null, error: 'HAS_DEPENDENCIES' }
        }

        // 3. Proceder con el hard delete en la tabla tecnicos
        const { error } = await admin
            .from('tecnicos')
            .delete()
            .eq('id', id)

        if (error) throw error

        revalidatePath('/admin/tecnicos')
        return { data: true, error: null }
    } catch (err) {
        console.error('[eliminarTecnicoDefinitivo]', err)
        return { data: null, error: 'Error al eliminar el registro permanentemente.' }
    }
}

export async function toggleActivoTecnico(id: string): Promise<ActionResult<boolean>> {
    try {
        const admin = createAdminClient()
        const { data: current, error: fetchErr } = await admin.from('tecnicos').select('activo').eq('id', id).single()
        if (fetchErr) throw fetchErr

        const { error: updateErr } = await admin.from('tecnicos').update({ activo: !current.activo }).eq('id', id)
        if (updateErr) throw updateErr

        revalidatePath('/admin/tecnicos')
        return { data: !current.activo, error: null }
    } catch {
        return { data: null, error: 'Error al cambiar estado del técnico.' }
    }
}
