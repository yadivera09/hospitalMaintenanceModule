'use server'

/**
 * src/app/actions/seguridad/usuarios.ts
 * Server Actions para gestión de usuarios del sistema.
 * Incluye asignación de roles y lectura del estado MFA desde tecnicos.
 * Todas las operaciones de escritura requieren rol 'administrador'.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getRolesUsuario } from '@/lib/seguridad/permisos'
import { registrarAuditoria } from '@/lib/seguridad/auditoria'
import { revalidatePath } from 'next/cache'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type ActionResult<T> = { data: T | null; error: string | null }

export interface UsuarioConRoles {
    id: string
    user_id: string
    nombre: string
    apellido: string
    email: string
    telefono: string | null
    imagen_url: string | null
    activo: boolean
    created_at: string
    updated_at: string
    roles: { id: string; nombre: string }[]
}

export interface UsuarioDetalle extends UsuarioConRoles {
    /** Estado MFA leído desde la tabla tecnicos (si el usuario tiene perfil técnico) */
    mfa_configurado: boolean | null
    mfa_metodo: 'totp' | 'email' | null
    mfa_configurado_en: string | null
}

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
// getUsuarios — lista todos con sus roles
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lista todos los usuarios del sistema con sus roles activos.
 * Solo administradores.
 */
export async function getUsuarios(): Promise<ActionResult<UsuarioConRoles[]>> {
    try {
        const admin = createAdminClient()
        const { data, error } = await admin
            .from('usuarios')
            .select(`
                id, user_id, nombre, apellido, email, telefono, imagen_url,
                activo, created_at, updated_at,
                usuario_roles (
                    activo,
                    roles ( id, nombre )
                )
            `)
            .order('apellido', { ascending: true })

        if (error) throw error

        const usuarios: UsuarioConRoles[] = (data ?? []).map((u) => ({
            id: u.id,
            user_id: u.user_id,
            nombre: u.nombre,
            apellido: u.apellido,
            email: u.email,
            telefono: u.telefono,
            imagen_url: u.imagen_url,
            activo: u.activo,
            created_at: u.created_at,
            updated_at: u.updated_at,
            roles: (u.usuario_roles ?? [])
                .filter((ur: any) => ur.activo && ur.roles)
                .map((ur: any) => ({ id: ur.roles.id, nombre: ur.roles.nombre })),
        }))

        return { data: usuarios, error: null }
    } catch (err) {
        console.error('[getUsuarios]', err)
        return { data: null, error: 'Error al cargar los usuarios.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// getUsuarioById — detalle con roles y estado MFA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene el detalle de un usuario (usuarios.id) con sus roles y
 * el estado MFA leído desde la tabla tecnicos (si existe perfil técnico).
 * Solo administradores.
 */
export async function getUsuarioById(id: string): Promise<ActionResult<UsuarioDetalle>> {
    try {
        const admin = createAdminClient()

        const { data, error } = await admin
            .from('usuarios')
            .select(`
                id, user_id, nombre, apellido, email, telefono, imagen_url,
                activo, created_at, updated_at,
                usuario_roles (
                    activo,
                    roles ( id, nombre )
                )
            `)
            .eq('id', id)
            .single()

        if (error) throw error

        // Leer estado MFA desde tecnicos (puede no existir si el usuario no es técnico)
        const { data: tecnico } = await admin
            .from('tecnicos')
            .select('mfa_configurado, mfa_metodo, mfa_configurado_en')
            .eq('user_id', data.user_id)
            .maybeSingle()

        const usuario: UsuarioDetalle = {
            id: data.id,
            user_id: data.user_id,
            nombre: data.nombre,
            apellido: data.apellido,
            email: data.email,
            telefono: data.telefono,
            imagen_url: data.imagen_url,
            activo: data.activo,
            created_at: data.created_at,
            updated_at: data.updated_at,
            roles: (data.usuario_roles ?? [])
                .filter((ur: any) => ur.activo && ur.roles)
                .map((ur: any) => ({ id: ur.roles.id, nombre: ur.roles.nombre })),
            mfa_configurado: tecnico?.mfa_configurado ?? null,
            mfa_metodo: (tecnico?.mfa_metodo as 'totp' | 'email' | null) ?? null,
            mfa_configurado_en: tecnico?.mfa_configurado_en ?? null,
        }

        return { data: usuario, error: null }
    } catch (err) {
        console.error('[getUsuarioById]', err)
        return { data: null, error: 'Usuario no encontrado.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// asignarRolesUsuario — reemplaza todos los roles del usuario
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reemplaza todos los roles de un usuario de forma atómica.
 * Elimina las asignaciones existentes e inserta las nuevas.
 * Solo administradores.
 *
 * @param usuarioId - usuarios.id (NO auth.users.id)
 * @param rolIds    - Array de roles.id a asignar. Vacío = quitar todos los roles.
 */
export async function asignarRolesUsuario(
    usuarioId: string,
    rolIds: string[]
): Promise<ActionResult<boolean>> {
    const actor = await verificarAdmin()
    if (!actor) return { data: null, error: 'Acceso denegado. Se requiere rol administrador.' }

    try {
        const admin = createAdminClient()

        // Verificar que el usuario existe
        const { data: usuario, error: fetchErr } = await admin
            .from('usuarios')
            .select('id, nombre, apellido')
            .eq('id', usuarioId)
            .single()

        if (fetchErr) throw fetchErr

        // 1. Desactivar roles actuales (soft delete)
        const { error: deactivateErr } = await admin
            .from('usuario_roles')
            .update({ activo: false })
            .eq('usuario_id', usuarioId)

        if (deactivateErr) throw deactivateErr

        // 2. Insertar nuevos roles o reactivar los existentes
        if (rolIds.length > 0) {
            for (const rolId of rolIds) {
                // Upsert: si ya existe (inactivo), reactivar; si no, crear
                const { error: upsertErr } = await admin
                    .from('usuario_roles')
                    .upsert(
                        { usuario_id: usuarioId, rol_id: rolId, activo: true },
                        { onConflict: 'usuario_id,rol_id' }
                    )

                if (upsertErr) throw upsertErr
            }
        }

        await registrarAuditoria({
            usuario_id: actor.usuarioId || null,
            tabla: 'usuario_roles',
            registro_id: usuarioId,
            accion: 'MODIFICACION',
            detalle: {
                usuario: `${usuario.nombre} ${usuario.apellido}`,
                roles_asignados: rolIds,
            },
        })

        revalidatePath('/admin/seguridad/usuarios')
        revalidatePath(`/admin/seguridad/usuarios/${usuarioId}`)
        return { data: true, error: null }
    } catch (err) {
        console.error('[asignarRolesUsuario]', err)
        return { data: null, error: 'Error al asignar roles al usuario.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// toggleUsuarioActivo — activa o desactiva un usuario
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Alterna el estado activo/inactivo de un usuario.
 * Solo administradores. Un administrador no puede desactivarse a sí mismo.
 *
 * @param id - usuarios.id del usuario a modificar.
 * @returns El nuevo estado del campo activo.
 */
export async function toggleUsuarioActivo(id: string): Promise<ActionResult<boolean>> {
    const actor = await verificarAdmin()
    if (!actor) return { data: null, error: 'Acceso denegado. Se requiere rol administrador.' }

    try {
        const admin = createAdminClient()

        const { data: usuario, error: fetchErr } = await admin
            .from('usuarios')
            .select('id, user_id, activo, nombre, apellido')
            .eq('id', id)
            .single()

        if (fetchErr) throw fetchErr

        // Prevenir que un admin se desactive a sí mismo
        if (usuario.user_id === actor.userId) {
            return { data: null, error: 'No puedes desactivar tu propia cuenta.' }
        }

        const nuevoEstado = !usuario.activo
        const { error: updateErr } = await admin
            .from('usuarios')
            .update({ activo: nuevoEstado })
            .eq('id', id)

        if (updateErr) throw updateErr

        await registrarAuditoria({
            usuario_id: actor.usuarioId || null,
            tabla: 'usuarios',
            registro_id: id,
            accion: 'MODIFICACION',
            detalle: {
                usuario: `${usuario.nombre} ${usuario.apellido}`,
                activo: { antes: usuario.activo, despues: nuevoEstado },
            },
        })

        revalidatePath('/admin/seguridad/usuarios')
        revalidatePath(`/admin/seguridad/usuarios/${id}`)
        return { data: nuevoEstado, error: null }
    } catch (err) {
        console.error('[toggleUsuarioActivo]', err)
        return { data: null, error: 'Error al cambiar el estado del usuario.' }
    }
}
