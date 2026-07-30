'use server'

/**
 * src/app/actions/tecnicos.ts
 * Server Actions para el módulo de Técnicos.
 * BLOQUE 2 — Conectado a Supabase real.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generarPasswordTemporal } from '@/lib/seguridad/password'
import { requireAdmin, ACCESO_DENEGADO } from '@/lib/seguridad/guard'
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

        // El estado de MFA vive en 'usuarios' desde la migración 015; las
        // columnas mfa_* de 'tecnicos' quedaron obsoletas y ya no se escriben.
        // Se sobrescriben aquí para que la ficha del técnico no muestre datos
        // congelados en el momento de la migración.
        const admin = createAdminClient()
        const { data: identidad } = await admin
            .from('usuarios')
            .select('mfa_configurado, mfa_metodo, mfa_configurado_en')
            .eq('user_id', (tecnicoRes.data as Tecnico).user_id)
            .maybeSingle()

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
                mfa_configurado: identidad?.mfa_configurado ?? false,
                mfa_metodo: (identidad?.mfa_metodo as 'totp' | null) ?? null,
                mfa_configurado_en: identidad?.mfa_configurado_en ?? null,
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

    // Aleatoria, no derivada del nombre: ver src/lib/seguridad/password.ts
    const passwordTemporal = generarPasswordTemporal()

    // ── Paso 1: crear usuario en Auth con contraseña temporal ─────────────────
    const { data: createData, error: createErr } = await admin.auth.admin.createUser({
        email: parsed.data.email,
        password: passwordTemporal,
        email_confirm: true,           // confirmar email automáticamente
        // Solo datos descriptivos. El rol NUNCA va aquí: user_metadata es
        // escribible por el propio usuario (ver 014_seguridad_hardening.sql).
        user_metadata: {
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
                cedula: parsed.data.cedula || null,
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
    const actor = await requireAdmin()
    if (!actor) return { data: null, error: ACCESO_DENEGADO }

    const parsed = TecnicoSchema.partial().safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    try {
        // Cliente service_role, igual que el resto de escrituras del módulo.
        // Con el cliente sujeto a RLS este UPDATE afectaba 0 filas y fallaba
        // con PGRST116; la autorización se hace arriba, no vía policy.
        const admin = createAdminClient()
        const { data, error } = await admin
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

        // Propagar los datos personales a la identidad. Sin esto, editar a un
        // técnico dejaba desactualizadas las pantallas de Seguridad: cada tabla
        // guardaba su propia versión del nombre, email o teléfono.
        await sincronizarIdentidadDesdeTecnico(createAdminClient(), id, parsed.data)

        revalidatePath('/admin/tecnicos')
        revalidatePath('/admin/seguridad/usuarios')
        return { data: data as Tecnico, error: null }
    } catch (err) {
        console.error('[updateTecnico]', err)
        return { data: null, error: 'Error al actualizar el técnico.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// sincronizarAccesoUsuario — mantiene usuarios.activo alineado con tecnicos.activo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Propaga el estado del técnico a su identidad en la tabla `usuarios`.
 *
 * Son dos flags con significados distintos:
 *   tecnicos.activo → disponible para asignarle reportes (negocio)
 *   usuarios.activo → puede entrar al sistema (identidad, lo lee el middleware)
 *
 * Dar de baja a un técnico debe revocarle el acceso: sin esta sincronización,
 * un técnico desactivado seguía pudiendo iniciar sesión.
 *
 * Para suspender el acceso SIN dar de baja al técnico, usar el toggle de
 * /admin/seguridad/usuarios, que escribe solo usuarios.activo.
 *
 * No lanza: si la identidad no existe, no hay nada que sincronizar.
 */
async function sincronizarAccesoUsuario(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admin: any,
    tecnicoId: string,
    activo: boolean
): Promise<void> {
    const { data: tecnico } = await admin
        .from('tecnicos')
        .select('usuario_id, user_id')
        .eq('id', tecnicoId)
        .maybeSingle()

    if (!tecnico) return

    const query = admin.from('usuarios').update({ activo })

    // usuario_id es la FK canónica; user_id es el fallback para filas antiguas
    // que aún no fueron vinculadas por la migración 008.
    const { error } = tecnico.usuario_id
        ? await query.eq('id', tecnico.usuario_id)
        : await query.eq('user_id', tecnico.user_id)

    if (error) {
        console.error('[sincronizarAccesoUsuario]', error.message)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// sincronizarIdentidadDesdeTecnico — propaga los datos personales a `usuarios`
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Copia a `usuarios` los datos personales editados en la ficha del técnico.
 *
 * Nombre, apellido, email, teléfono y cédula pertenecen a la identidad; las
 * columnas equivalentes en `tecnicos` son copias que aún leen 14 consultas de
 * reportes, dashboard y caché offline. Mientras esa deuda exista, ambas caras
 * deben escribirse juntas o los datos divergen.
 *
 * No lanza: un fallo aquí no debe invalidar la edición ya guardada.
 */
async function sincronizarIdentidadDesdeTecnico(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admin: any,
    tecnicoId: string,
    cambios: Record<string, unknown>
): Promise<void> {
    const CAMPOS_DE_IDENTIDAD = ['nombre', 'apellido', 'email', 'telefono', 'cedula', 'activo'] as const

    const actualizacion: Record<string, unknown> = {}
    for (const campo of CAMPOS_DE_IDENTIDAD) {
        if (campo in cambios && cambios[campo] !== undefined) {
            actualizacion[campo] = cambios[campo] || null
        }
    }

    if (Object.keys(actualizacion).length === 0) return

    try {
        const { data: tecnico } = await admin
            .from('tecnicos')
            .select('usuario_id, user_id')
            .eq('id', tecnicoId)
            .maybeSingle()

        if (!tecnico) return

        const query = admin.from('usuarios').update(actualizacion)

        const { error } = tecnico.usuario_id
            ? await query.eq('id', tecnico.usuario_id)
            : await query.eq('user_id', tecnico.user_id)

        if (error) console.error('[sincronizarIdentidadDesdeTecnico]', error.message)
    } catch (err) {
        console.error('[sincronizarIdentidadDesdeTecnico]', err)
    }
}

/**
 * Desactiva un técnico (soft delete) y le revoca el acceso al sistema.
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

        // 3. Revocar el acceso al sistema
        await sincronizarAccesoUsuario(admin, id, false)

        revalidatePath('/admin/tecnicos')
        revalidatePath('/admin/seguridad/usuarios')
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

        // 3. Revocar el acceso ANTES de borrar — después ya no se puede
        //    resolver a qué identidad pertenecía este técnico.
        //    Sin esto quedaría una cuenta que puede autenticarse pero cuyo
        //    estado MFA vive en una fila de 'tecnicos' que ya no existe.
        await sincronizarAccesoUsuario(admin, id, false)

        // 4. Proceder con el hard delete en la tabla tecnicos
        const { error } = await admin
            .from('tecnicos')
            .delete()
            .eq('id', id)

        if (error) throw error

        revalidatePath('/admin/tecnicos')
        revalidatePath('/admin/seguridad/usuarios')
        return { data: true, error: null }
    } catch (err) {
        console.error('[eliminarTecnicoDefinitivo]', err)
        return { data: null, error: 'Error al eliminar el registro permanentemente.' }
    }
}

/**
 * Alterna el estado del técnico y su acceso al sistema en bloque:
 * reactivar a un técnico le devuelve el acceso, desactivarlo se lo quita.
 */
export async function toggleActivoTecnico(id: string): Promise<ActionResult<boolean>> {
    try {
        const admin = createAdminClient()
        const { data: current, error: fetchErr } = await admin.from('tecnicos').select('activo').eq('id', id).single()
        if (fetchErr) throw fetchErr

        const nuevoEstado = !current.activo

        const { error: updateErr } = await admin.from('tecnicos').update({ activo: nuevoEstado }).eq('id', id)
        if (updateErr) throw updateErr

        await sincronizarAccesoUsuario(admin, id, nuevoEstado)

        revalidatePath('/admin/tecnicos')
        revalidatePath('/admin/seguridad/usuarios')
        return { data: nuevoEstado, error: null }
    } catch {
        return { data: null, error: 'Error al cambiar estado del técnico.' }
    }
}
