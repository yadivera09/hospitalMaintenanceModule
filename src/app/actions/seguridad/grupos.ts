'use server'

/**
 * src/app/actions/seguridad/grupos.ts
 * Server Actions para gestión de grupos de trabajo del sistema.
 * Todas las operaciones de escritura requieren rol 'administrador'.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getRolesUsuario } from '@/lib/seguridad/permisos'
import { registrarAuditoria } from '@/lib/seguridad/auditoria'
import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type ActionResult<T> = { data: T | null; error: string | null }

export interface GrupoResumen {
    id: string
    nombre: string
    descripcion: string | null
    responsable_id: string | null
    responsable_nombre: string | null
    activo: boolean
    total_miembros: number
    created_at: string
    updated_at: string
}

export interface GrupoDetalle extends GrupoResumen {
    miembros: {
        usuario_id: string
        nombre: string
        apellido: string
        email: string
        imagen_url: string | null
    }[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

const GrupoSchema = z.object({
    nombre: z.string().min(1, 'El nombre es obligatorio').max(150),
    descripcion: z.string().max(400).nullable().optional(),
    responsable_id: z.string().uuid('responsable_id debe ser un UUID válido').nullable().optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// Helper: verificar que el usuario actual es administrador
// ─────────────────────────────────────────────────────────────────────────────

async function verificarAdmin(): Promise<{ userId: string; usuarioId: string } | null> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return null

    const roles = await getRolesUsuario(session.user.id)
    if (!roles.includes('administrador')) return null

    const admin = createAdminClient()
    const { data: usuario } = await admin
        .from('usuarios')
        .select('id')
        .eq('user_id', session.user.id)
        .single()

    return { userId: session.user.id, usuarioId: usuario?.id ?? '' }
}

// ─────────────────────────────────────────────────────────────────────────────
// getGrupos — lista con responsable y cantidad de miembros
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lista todos los grupos de trabajo con el nombre del responsable y
 * la cantidad total de miembros.
 */
export async function getGrupos(): Promise<ActionResult<GrupoResumen[]>> {
    try {
        const admin = createAdminClient()

        const { data, error } = await admin
            .from('grupos')
            .select(`
                id, nombre, descripcion, responsable_id, activo, created_at, updated_at,
                responsable:usuarios!grupos_responsable_id_fkey ( nombre, apellido ),
                grupo_miembros ( usuario_id )
            `)
            .order('nombre', { ascending: true })

        if (error) throw error

        const grupos: GrupoResumen[] = (data ?? []).map((g) => {
            const resp = g.responsable as { nombre: string; apellido: string } | null
            return {
                id: g.id,
                nombre: g.nombre,
                descripcion: g.descripcion,
                responsable_id: g.responsable_id,
                responsable_nombre: resp ? `${resp.nombre} ${resp.apellido}` : null,
                activo: g.activo,
                total_miembros: (g.grupo_miembros ?? []).length,
                created_at: g.created_at,
                updated_at: g.updated_at,
            }
        })

        return { data: grupos, error: null }
    } catch (err) {
        console.error('[getGrupos]', err)
        return { data: null, error: 'Error al cargar los grupos.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// getGrupoById — detalle con lista de miembros
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene el detalle de un grupo con la lista completa de miembros.
 */
export async function getGrupoById(id: string): Promise<ActionResult<GrupoDetalle>> {
    try {
        const admin = createAdminClient()

        const { data, error } = await admin
            .from('grupos')
            .select(`
                id, nombre, descripcion, responsable_id, activo, created_at, updated_at,
                responsable:usuarios!grupos_responsable_id_fkey ( nombre, apellido ),
                grupo_miembros (
                    usuario_id,
                    usuarios ( nombre, apellido, email, imagen_url )
                )
            `)
            .eq('id', id)
            .single()

        if (error) throw error

        const resp = data.responsable as { nombre: string; apellido: string } | null
        const miembros = (data.grupo_miembros ?? []).map((m: any) => ({
            usuario_id: m.usuario_id,
            nombre: m.usuarios?.nombre ?? '',
            apellido: m.usuarios?.apellido ?? '',
            email: m.usuarios?.email ?? '',
            imagen_url: m.usuarios?.imagen_url ?? null,
        }))

        return {
            data: {
                id: data.id,
                nombre: data.nombre,
                descripcion: data.descripcion,
                responsable_id: data.responsable_id,
                responsable_nombre: resp ? `${resp.nombre} ${resp.apellido}` : null,
                activo: data.activo,
                total_miembros: miembros.length,
                created_at: data.created_at,
                updated_at: data.updated_at,
                miembros,
            },
            error: null,
        }
    } catch (err) {
        console.error('[getGrupoById]', err)
        return { data: null, error: 'Grupo no encontrado.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// crearGrupo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea un nuevo grupo de trabajo. Solo administradores.
 */
export async function crearGrupo(raw: unknown): Promise<ActionResult<{ id: string; nombre: string }>> {
    const actor = await verificarAdmin()
    if (!actor) return { data: null, error: 'Acceso denegado. Se requiere rol administrador.' }

    const parsed = GrupoSchema.safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    try {
        const admin = createAdminClient()
        const { data, error } = await admin
            .from('grupos')
            .insert({
                nombre: parsed.data.nombre,
                descripcion: parsed.data.descripcion ?? null,
                responsable_id: parsed.data.responsable_id ?? null,
            })
            .select('id, nombre')
            .single()

        if (error) {
            if (error.code === '23505') return { data: null, error: 'Ya existe un grupo con ese nombre.' }
            throw error
        }

        await registrarAuditoria({
            usuario_id: actor.usuarioId || null,
            tabla: 'grupos',
            registro_id: data.id,
            accion: 'ADICION',
            detalle: { datos: parsed.data },
        })

        return { data, error: null }
    } catch (err) {
        console.error('[crearGrupo]', err)
        return { data: null, error: 'Error al crear el grupo.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// editarGrupo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Edita un grupo existente. Solo administradores.
 */
export async function editarGrupo(
    id: string,
    raw: unknown
): Promise<ActionResult<{ id: string; nombre: string }>> {
    const actor = await verificarAdmin()
    if (!actor) return { data: null, error: 'Acceso denegado. Se requiere rol administrador.' }

    const parsed = GrupoSchema.partial().safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    try {
        const admin = createAdminClient()
        const { data, error } = await admin
            .from('grupos')
            .update({
                ...(parsed.data.nombre ? { nombre: parsed.data.nombre } : {}),
                ...(parsed.data.descripcion !== undefined ? { descripcion: parsed.data.descripcion } : {}),
                ...(parsed.data.responsable_id !== undefined ? { responsable_id: parsed.data.responsable_id } : {}),
            })
            .eq('id', id)
            .select('id, nombre')
            .single()

        if (error) {
            if (error.code === '23505') return { data: null, error: 'Ya existe un grupo con ese nombre.' }
            throw error
        }

        await registrarAuditoria({
            usuario_id: actor.usuarioId || null,
            tabla: 'grupos',
            registro_id: id,
            accion: 'MODIFICACION',
            detalle: { cambios: parsed.data },
        })

        return { data, error: null }
    } catch (err) {
        console.error('[editarGrupo]', err)
        return { data: null, error: 'Error al editar el grupo.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// eliminarGrupo — solo si no tiene miembros
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Elimina un grupo. Solo administradores.
 * Bloqueado si el grupo tiene miembros activos.
 */
export async function eliminarGrupo(id: string): Promise<ActionResult<boolean>> {
    const actor = await verificarAdmin()
    if (!actor) return { data: null, error: 'Acceso denegado. Se requiere rol administrador.' }

    try {
        const admin = createAdminClient()

        // Verificar si tiene miembros
        const { count, error: countErr } = await admin
            .from('grupo_miembros')
            .select('*', { count: 'exact', head: true })
            .eq('grupo_id', id)

        if (countErr) throw countErr

        if ((count ?? 0) > 0) {
            return {
                data: null,
                error: `No se puede eliminar: el grupo tiene ${count} miembro(s). Retíralos primero.`,
            }
        }

        const { data: grupo } = await admin
            .from('grupos')
            .select('nombre')
            .eq('id', id)
            .single()

        const { error } = await admin.from('grupos').delete().eq('id', id)
        if (error) throw error

        await registrarAuditoria({
            usuario_id: actor.usuarioId || null,
            tabla: 'grupos',
            registro_id: id,
            accion: 'ELIMINACION',
            detalle: { nombre: grupo?.nombre },
        })

        return { data: true, error: null }
    } catch (err) {
        console.error('[eliminarGrupo]', err)
        return { data: null, error: 'Error al eliminar el grupo.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// agregarMiembro
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Agrega un usuario a un grupo. Solo administradores.
 * Idempotente: si el usuario ya es miembro, retorna éxito sin duplicar.
 */
export async function agregarMiembro(
    grupoId: string,
    usuarioId: string
): Promise<ActionResult<boolean>> {
    const actor = await verificarAdmin()
    if (!actor) return { data: null, error: 'Acceso denegado. Se requiere rol administrador.' }

    try {
        const admin = createAdminClient()

        const { error } = await admin
            .from('grupo_miembros')
            .upsert(
                { grupo_id: grupoId, usuario_id: usuarioId },
                { onConflict: 'grupo_id,usuario_id', ignoreDuplicates: true }
            )

        if (error) throw error

        await registrarAuditoria({
            usuario_id: actor.usuarioId || null,
            tabla: 'grupo_miembros',
            registro_id: grupoId,
            accion: 'ADICION',
            detalle: { grupo_id: grupoId, usuario_id: usuarioId },
        })

        return { data: true, error: null }
    } catch (err) {
        console.error('[agregarMiembro]', err)
        return { data: null, error: 'Error al agregar el miembro al grupo.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// removerMiembro
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retira un usuario de un grupo. Solo administradores.
 */
export async function removerMiembro(
    grupoId: string,
    usuarioId: string
): Promise<ActionResult<boolean>> {
    const actor = await verificarAdmin()
    if (!actor) return { data: null, error: 'Acceso denegado. Se requiere rol administrador.' }

    try {
        const admin = createAdminClient()

        const { error } = await admin
            .from('grupo_miembros')
            .delete()
            .eq('grupo_id', grupoId)
            .eq('usuario_id', usuarioId)

        if (error) throw error

        await registrarAuditoria({
            usuario_id: actor.usuarioId || null,
            tabla: 'grupo_miembros',
            registro_id: grupoId,
            accion: 'ELIMINACION',
            detalle: { grupo_id: grupoId, usuario_id: usuarioId },
        })

        return { data: true, error: null }
    } catch (err) {
        console.error('[removerMiembro]', err)
        return { data: null, error: 'Error al retirar el miembro del grupo.' }
    }
}
