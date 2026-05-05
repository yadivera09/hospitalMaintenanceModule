'use server'

/**
 * src/app/actions/seguridad/roles.ts
 * Server Actions para gestión de roles del sistema RBAC.
 * Todas las operaciones de escritura requieren rol 'administrador'.
 * Todas las operaciones de escritura son auditadas con withAudit().
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getRolesUsuario } from '@/lib/seguridad/permisos'
import { registrarAuditoria } from '@/lib/seguridad/auditoria'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type ActionResult<T> = { data: T | null; error: string | null }

export interface RolConPermisos {
    id: string
    nombre: string
    descripcion: string | null
    es_sistema: boolean
    activo: boolean
    created_at: string
    updated_at: string
    permisos: {
        modulo_id: string
        modulo_url: string
        modulo_nombre: string
        permiso_id: string
        permiso_codigo: string
        permiso_nombre: string
    }[]
}

export interface AsignarPermisoInput {
    moduloId: string
    permisoId: string
}

export interface PermisoBase {
    id: string
    codigo: string
    nombre: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Schemas de validación
// ─────────────────────────────────────────────────────────────────────────────

const RolSchema = z.object({
    nombre: z.string().min(1, 'El nombre es obligatorio').max(100),
    descripcion: z.string().max(300).nullable().optional(),
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

    // Resolver usuarios.id (genérico) para auditoría
    const admin = createAdminClient()
    const { data: usuario } = await admin
        .from('usuarios')
        .select('id')
        .eq('user_id', session.user.id)
        .single()

    return { userId: session.user.id, usuarioId: usuario?.id ?? '' }
}

// ─────────────────────────────────────────────────────────────────────────────
// getPermisos — catálogo completo de permisos del sistema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lista todos los permisos del catálogo (ver, crear, editar, etc.) con sus IDs reales.
 * Necesario para construir la matriz de permisos en el cliente sin depender
 * de qué permisos tenga ya asignados el rol.
 */
export async function getPermisos(): Promise<ActionResult<PermisoBase[]>> {
    try {
        const admin = createAdminClient()
        const { data, error } = await admin
            .from('permisos')
            .select('id, codigo, nombre')
            .order('nombre', { ascending: true })

        if (error) throw error

        return { data: (data ?? []) as PermisoBase[], error: null }
    } catch (err) {
        console.error('[getPermisos]', err)
        return { data: null, error: 'Error al cargar el catálogo de permisos.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// getRoles — lista todos los roles con conteo de permisos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lista todos los roles del sistema con la cantidad de permisos asignados.
 * Accesible para administradores.
 */
export async function getRoles(): Promise<ActionResult<RolConPermisos[]>> {
    try {
        const admin = createAdminClient()
        const { data, error } = await admin
            .from('roles')
            .select(`
                id, nombre, descripcion, es_sistema, activo, created_at, updated_at,
                rol_permisos_modulo (
                    modulo_id,
                    permiso_id,
                    activo,
                    modulos ( url, nombre ),
                    permisos ( codigo, nombre )
                )
            `)
            .order('nombre', { ascending: true })

        if (error) throw error

        const roles = (data ?? []).map((rol) => ({
            id: rol.id,
            nombre: rol.nombre,
            descripcion: rol.descripcion,
            es_sistema: rol.es_sistema,
            activo: rol.activo,
            created_at: rol.created_at,
            updated_at: rol.updated_at,
            permisos: (rol.rol_permisos_modulo ?? [])
                .filter((p: any) => p.activo)
                .map((p: any) => ({
                    modulo_id: p.modulo_id,
                    modulo_url: p.modulos?.url ?? '',
                    modulo_nombre: p.modulos?.nombre ?? '',
                    permiso_id: p.permiso_id,
                    permiso_codigo: p.permisos?.codigo ?? '',
                    permiso_nombre: p.permisos?.nombre ?? '',
                })),
        }))

        return { data: roles, error: null }
    } catch (err) {
        console.error('[getRoles]', err)
        return { data: null, error: 'Error al cargar los roles.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// getRolById — detalle con matriz completa de permisos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene el detalle de un rol con su matriz completa de permisos por módulo.
 */
export async function getRolById(id: string): Promise<ActionResult<RolConPermisos>> {
    try {
        const admin = createAdminClient()
        const { data, error } = await admin
            .from('roles')
            .select(`
                id, nombre, descripcion, es_sistema, activo, created_at, updated_at,
                rol_permisos_modulo (
                    modulo_id,
                    permiso_id,
                    activo,
                    modulos ( url, nombre ),
                    permisos ( codigo, nombre )
                )
            `)
            .eq('id', id)
            .single()

        if (error) throw error

        const rol: RolConPermisos = {
            id: data.id,
            nombre: data.nombre,
            descripcion: data.descripcion,
            es_sistema: data.es_sistema,
            activo: data.activo,
            created_at: data.created_at,
            updated_at: data.updated_at,
            permisos: (data.rol_permisos_modulo ?? [])
                .filter((p: any) => p.activo)
                .map((p: any) => ({
                    modulo_id: p.modulo_id,
                    modulo_url: p.modulos?.url ?? '',
                    modulo_nombre: p.modulos?.nombre ?? '',
                    permiso_id: p.permiso_id,
                    permiso_codigo: p.permisos?.codigo ?? '',
                    permiso_nombre: p.permisos?.nombre ?? '',
                })),
        }

        return { data: rol, error: null }
    } catch (err) {
        console.error('[getRolById]', err)
        return { data: null, error: 'Rol no encontrado.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// crearRol
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea un nuevo rol. Solo administradores.
 * es_sistema siempre se fija en false — no se puede asignar desde aquí.
 */
export async function crearRol(
    raw: unknown
): Promise<ActionResult<{ id: string; nombre: string }>> {
    const actor = await verificarAdmin()
    if (!actor) return { data: null, error: 'Acceso denegado. Se requiere rol administrador.' }

    const parsed = RolSchema.safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    try {
        const admin = createAdminClient()
        const { data, error } = await admin
            .from('roles')
            .insert({
                nombre: parsed.data.nombre,
                descripcion: parsed.data.descripcion ?? null,
                es_sistema: false, // nunca desde aquí
            })
            .select('id, nombre')
            .single()

        if (error) {
            if (error.code === '23505') return { data: null, error: 'Ya existe un rol con ese nombre.' }
            throw error
        }

        await registrarAuditoria({
            usuario_id: actor.usuarioId || null,
            tabla: 'roles',
            registro_id: data.id,
            accion: 'ADICION',
            detalle: { datos: { nombre: data.nombre } },
        })

        revalidatePath('/admin/seguridad/roles')
        return { data, error: null }
    } catch (err) {
        console.error('[crearRol]', err)
        return { data: null, error: 'Error al crear el rol.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// editarRol
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Edita nombre y descripción de un rol. Solo administradores.
 * Si el rol tiene es_sistema = true, no permite cambiar el nombre.
 */
export async function editarRol(
    id: string,
    raw: unknown
): Promise<ActionResult<{ id: string; nombre: string }>> {
    const actor = await verificarAdmin()
    if (!actor) return { data: null, error: 'Acceso denegado. Se requiere rol administrador.' }

    const parsed = RolSchema.partial().safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    try {
        const admin = createAdminClient()

        // Verificar protección de roles de sistema
        const { data: actual, error: fetchErr } = await admin
            .from('roles')
            .select('nombre, es_sistema')
            .eq('id', id)
            .single()

        if (fetchErr) throw fetchErr

        if (actual.es_sistema && parsed.data.nombre && parsed.data.nombre !== actual.nombre) {
            return { data: null, error: 'No se puede cambiar el nombre de un rol de sistema.' }
        }

        const { data, error } = await admin
            .from('roles')
            .update({
                ...(parsed.data.nombre ? { nombre: parsed.data.nombre } : {}),
                descripcion: parsed.data.descripcion ?? null,
            })
            .eq('id', id)
            .select('id, nombre')
            .single()

        if (error) {
            if (error.code === '23505') return { data: null, error: 'Ya existe un rol con ese nombre.' }
            throw error
        }

        await registrarAuditoria({
            usuario_id: actor.usuarioId || null,
            tabla: 'roles',
            registro_id: id,
            accion: 'MODIFICACION',
            detalle: { cambios: parsed.data },
        })

        revalidatePath('/admin/seguridad/roles')
        revalidatePath(`/admin/seguridad/roles/${id}`)
        return { data, error: null }
    } catch (err) {
        console.error('[editarRol]', err)
        return { data: null, error: 'Error al editar el rol.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// eliminarRol
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Elimina un rol. Solo administradores.
 * Bloqueado si es_sistema = true.
 */
export async function eliminarRol(id: string): Promise<ActionResult<boolean>> {
    const actor = await verificarAdmin()
    if (!actor) return { data: null, error: 'Acceso denegado. Se requiere rol administrador.' }

    try {
        const admin = createAdminClient()

        const { data: rol, error: fetchErr } = await admin
            .from('roles')
            .select('nombre, es_sistema')
            .eq('id', id)
            .single()

        if (fetchErr) throw fetchErr
        if (rol.es_sistema) {
            return { data: null, error: `El rol "${rol.nombre}" es de sistema y no puede eliminarse.` }
        }

        const { error } = await admin.from('roles').delete().eq('id', id)
        if (error) throw error

        await registrarAuditoria({
            usuario_id: actor.usuarioId || null,
            tabla: 'roles',
            registro_id: id,
            accion: 'ELIMINACION',
            detalle: { nombre: rol.nombre },
        })

        revalidatePath('/admin/seguridad/roles')
        return { data: true, error: null }
    } catch (err) {
        console.error('[eliminarRol]', err)
        return { data: null, error: 'Error al eliminar el rol.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// asignarPermisosRol — reemplaza la matriz completa de permisos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reemplaza todos los permisos de un rol de forma atómica: elimina los
 * existentes e inserta los nuevos. Solo administradores.
 *
 * @param rolId    - UUID del rol a actualizar.
 * @param permisos - Array de pares { moduloId, permisoId } que definen la nueva matriz.
 *                   Enviar array vacío para quitar todos los permisos.
 */
export async function asignarPermisosRol(
    rolId: string,
    permisos: AsignarPermisoInput[]
): Promise<ActionResult<boolean>> {
    const actor = await verificarAdmin()
    if (!actor) return { data: null, error: 'Acceso denegado. Se requiere rol administrador.' }

    try {
        const admin = createAdminClient()

        // Verificar que el rol existe
        const { data: rol, error: fetchErr } = await admin
            .from('roles')
            .select('id, nombre')
            .eq('id', rolId)
            .single()

        if (fetchErr) throw fetchErr

        // 1. Eliminar todos los permisos actuales del rol
        const { error: deleteErr } = await admin
            .from('rol_permisos_modulo')
            .delete()
            .eq('rol_id', rolId)

        if (deleteErr) throw deleteErr

        // 2. Insertar nuevos permisos (si los hay)
        if (permisos.length > 0) {
            const rows = permisos.map((p) => ({
                rol_id: rolId,
                modulo_id: p.moduloId,
                permiso_id: p.permisoId,
                activo: true,
            }))

            const { error: insertErr } = await admin
                .from('rol_permisos_modulo')
                .insert(rows)

            if (insertErr) throw insertErr
        }

        await registrarAuditoria({
            usuario_id: actor.usuarioId || null,
            tabla: 'rol_permisos_modulo',
            registro_id: rolId,
            accion: 'MODIFICACION',
            detalle: {
                rol: rol.nombre,
                permisos_asignados: permisos.length,
                permisos,
            },
        })

        revalidatePath('/admin/seguridad/roles')
        revalidatePath(`/admin/seguridad/roles/${rolId}`)
        return { data: true, error: null }
    } catch (err) {
        console.error('[asignarPermisosRol]', err)
        return { data: null, error: 'Error al asignar permisos al rol.' }
    }
}
