'use server'

/**
 * src/app/actions/seguridad/usuarios.ts
 * Server Actions para gestión de usuarios del sistema.
 * Incluye asignación de roles y lectura del estado MFA desde tecnicos.
 * Todas las operaciones de escritura requieren rol 'administrador'.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, ACCESO_DENEGADO } from '@/lib/seguridad/guard'
import { registrarAuditoria } from '@/lib/seguridad/auditoria'
import { revalidatePath } from 'next/cache'
import { generarPasswordTemporal } from '@/lib/seguridad/password'
import { sincronizarPerfilTecnico, ROL_TECNICO } from '@/lib/seguridad/perfiles'
import { z } from 'zod'

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
    /** true si la persona ya enroló su app autenticadora */
    mfa_configurado: boolean
    created_at: string
    updated_at: string
    roles: { id: string; nombre: string }[]
}

export interface UsuarioDetalle extends UsuarioConRoles {
    /** Estado MFA de la identidad. Único método soportado: TOTP. */
    mfa_metodo: 'totp' | null
    mfa_configurado_en: string | null
}

/** Resultado del alta: la contraseña temporal solo se devuelve aquí, una vez. */
export interface UsuarioCreado {
    id: string
    email: string
    passwordTemporal: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema de validación del alta
// ─────────────────────────────────────────────────────────────────────────────

const NuevoUsuarioSchema = z.object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
    apellido: z.string().trim().min(1, 'El apellido es obligatorio').max(100),
    email: z.string().trim().toLowerCase().email('Email inválido'),
    telefono: z.string().trim().max(30).nullable().optional(),
    cedula: z.string().trim().max(20).nullable().optional(),
    rolIds: z.array(z.string().uuid()).min(1, 'Asigna al menos un rol'),
})

// ─────────────────────────────────────────────────────────────────────────────
// crearUsuario — alta de identidad con roles, sin perfil de negocio
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea un usuario del sistema: cuenta en Auth + fila en `usuarios` + roles.
 *
 * A diferencia de createTecnico, NO crea fila en `tecnicos`: sirve para dar de
 * alta administradores o cualquier perfil que no opere equipos. Es posible
 * desde la Fase 2, que sacó el estado de MFA de `tecnicos` — antes un usuario
 * sin perfil técnico no podía completar el segundo factor.
 *
 * La contraseña temporal se devuelve UNA sola vez, en el resultado de esta
 * llamada. No se guarda en claro ni vuelve a mostrarse.
 *
 * Si algo falla después de crear la cuenta en Auth, se borra para no dejar
 * cuentas huérfanas que bloqueen el email.
 */
export async function crearUsuario(raw: unknown): Promise<ActionResult<UsuarioCreado>> {
    const actor = await requireAdmin()
    if (!actor) return { data: null, error: ACCESO_DENEGADO }

    const parsed = NuevoUsuarioSchema.safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    const { nombre, apellido, email, telefono, cedula, rolIds } = parsed.data
    const admin = createAdminClient()

    // ── Paso 0: verificar que los roles existen ──────────────────────────────
    // Evita crear la cuenta para después descubrir que el rol no era válido.
    const { data: rolesValidos, error: rolesErr } = await admin
        .from('roles')
        .select('id, nombre')
        .in('id', rolIds)
        .eq('activo', true)

    if (rolesErr) {
        console.error('[crearUsuario] roles', rolesErr)
        return { data: null, error: 'Error al validar los roles.' }
    }

    if (!rolesValidos || rolesValidos.length !== rolIds.length) {
        return { data: null, error: 'Alguno de los roles seleccionados no existe o está inactivo.' }
    }

    // ── Paso 1: cuenta en Auth ───────────────────────────────────────────────
    const passwordTemporal = generarPasswordTemporal()

    const { data: createData, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: passwordTemporal,
        email_confirm: true,
        // Solo datos descriptivos. El rol NUNCA va aquí: user_metadata es
        // escribible por el propio usuario (ver 014_seguridad_hardening.sql).
        user_metadata: { nombre, apellido },
    })

    if (createErr) {
        const mensaje = createErr.message?.toLowerCase() ?? ''
        if (mensaje.includes('already been registered') || mensaje.includes('already exists')) {
            return { data: null, error: 'Este email ya tiene una cuenta en el sistema.' }
        }
        console.error('[crearUsuario] createUser', createErr)
        return { data: null, error: 'No se pudo crear la cuenta. Intenta de nuevo.' }
    }

    const userId = createData.user.id

    try {
        // ── Paso 2: identidad ────────────────────────────────────────────────
        const { data: usuarioData, error: usuarioErr } = await admin
            .from('usuarios')
            .insert({
                user_id: userId,
                nombre,
                apellido,
                email,
                telefono: telefono || null,
                cedula: cedula || null,
                activo: true,
            })
            .select('id')
            .single()

        if (usuarioErr) throw usuarioErr

        // ── Paso 3: roles ────────────────────────────────────────────────────
        const { error: rolesInsertErr } = await admin
            .from('usuario_roles')
            .insert(rolIds.map((rolId) => ({
                usuario_id: usuarioData.id,
                rol_id: rolId,
                activo: true,
            })))

        if (rolesInsertErr) throw rolesInsertErr

        // ── Paso 4: perfil de negocio si le corresponde ──────────────────────
        // El rol 'tecnico' exige ficha en 'tecnicos': sin ella el usuario entra
        // a /tecnico/dashboard pero no se le puede asignar ningún reporte.
        const esTecnico = rolesValidos.some((r) => r.nombre === ROL_TECNICO)
        const perfilError = await sincronizarPerfilTecnico(admin, usuarioData.id, esTecnico)

        await registrarAuditoria({
            usuario_id: actor.usuarioId || null,
            tabla: 'usuarios',
            registro_id: usuarioData.id,
            accion: 'ADICION',
            detalle: {
                datos: { nombre, apellido, email },
                roles: rolesValidos.map((r) => r.nombre),
            },
        })

        revalidatePath('/admin/seguridad/usuarios')
        revalidatePath('/admin/tecnicos')

        // El usuario quedó creado; si falló solo la ficha, se informa sin
        // deshacer el alta — perfilError explica qué revisar.
        return {
            data: { id: usuarioData.id, email, passwordTemporal },
            error: perfilError,
        }
    } catch (err) {
        // Revertir la cuenta de Auth: sin esto el email queda ocupado por una
        // cuenta que no existe para el sistema y no se puede volver a dar de alta.
        await admin.auth.admin.deleteUser(userId)

        console.error('[crearUsuario]', err)
        return { data: null, error: 'No se pudo completar el alta. No se creó ningún usuario.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// getUsuarios — lista todos con sus roles
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lista todos los usuarios del sistema con sus roles activos.
 * Solo administradores.
 */
export async function getUsuarios(): Promise<ActionResult<UsuarioConRoles[]>> {
    const actor = await requireAdmin()
    if (!actor) return { data: null, error: ACCESO_DENEGADO }

    try {
        const admin = createAdminClient()
        const { data, error } = await admin
            .from('usuarios')
            .select(`
                id, user_id, nombre, apellido, email, telefono, imagen_url,
                activo, mfa_configurado, created_at, updated_at,
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
            mfa_configurado: u.mfa_configurado ?? false,
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
    const actor = await requireAdmin()
    if (!actor) return { data: null, error: ACCESO_DENEGADO }

    try {
        const admin = createAdminClient()

        const { data, error } = await admin
            .from('usuarios')
            .select(`
                id, user_id, nombre, apellido, email, telefono, imagen_url,
                activo, created_at, updated_at,
                mfa_configurado, mfa_metodo, mfa_configurado_en,
                usuario_roles (
                    activo,
                    roles ( id, nombre )
                )
            `)
            .eq('id', id)
            .single()

        if (error) throw error

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
            mfa_configurado: data.mfa_configurado ?? false,
            mfa_metodo: (data.mfa_metodo as 'totp' | null) ?? null,
            mfa_configurado_en: data.mfa_configurado_en ?? null,
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
    const actor = await requireAdmin()
    if (!actor) return { data: null, error: ACCESO_DENEGADO }

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

        // 3. Alinear el perfil de negocio con los roles resultantes.
        //    Dar el rol 'tecnico' crea o reactiva la ficha; quitarlo la da de
        //    baja. Sin esto se podía dejar a alguien con rol de técnico pero
        //    sin ficha: entraba a /tecnico/dashboard y no se le podía asignar
        //    ningún reporte.
        const { data: rolesAsignados } = await admin
            .from('roles')
            .select('nombre')
            .in('id', rolIds.length > 0 ? rolIds : ['00000000-0000-0000-0000-000000000000'])

        const esTecnico = (rolesAsignados ?? []).some((r: { nombre: string }) => r.nombre === ROL_TECNICO)
        const perfilError = await sincronizarPerfilTecnico(admin, usuarioId, esTecnico)

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
        revalidatePath('/admin/tecnicos')

        // Los roles quedaron guardados; perfilError solo advierte que la ficha
        // de técnico necesita revisión manual.
        return { data: true, error: perfilError }
    } catch (err) {
        console.error('[asignarRolesUsuario]', err)
        return { data: null, error: 'Error al asignar roles al usuario.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// resetPasswordUsuario — genera una nueva contraseña temporal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asigna al usuario una contraseña temporal nueva y la devuelve una sola vez.
 *
 * Para cuando alguien pierde su contraseña inicial o hay sospecha de que se
 * filtró. Antes esto obligaba a entrar al dashboard de Supabase.
 *
 * NO toca el segundo factor: si la persona conserva su app autenticadora,
 * seguirá necesitándola para entrar. Para el caso de pérdida del dispositivo
 * está resetMfaUsuario(), que es una operación distinta a propósito —
 * resetear ambas cosas a la vez deja la cuenta accesible solo con la
 * contraseña temporal, y conviene que sea una decisión consciente.
 *
 * @param userId - auth.users.id, igual que resetMfaUsuario()
 */
export async function resetPasswordUsuario(
    userId: string
): Promise<ActionResult<{ passwordTemporal: string }>> {
    const actor = await requireAdmin()
    if (!actor) return { data: null, error: ACCESO_DENEGADO }
    if (!userId) return { data: null, error: 'userId requerido.' }

    try {
        const admin = createAdminClient()

        const { data: usuario, error: fetchErr } = await admin
            .from('usuarios')
            .select('id, user_id, nombre, apellido, email')
            .eq('user_id', userId)
            .single()

        if (fetchErr) throw fetchErr

        const passwordTemporal = generarPasswordTemporal()

        // Solo la contraseña: enviar user_metadata aquí arriesga sobrescribir
        // el objeto completo, y nada del sistema depende ya de su contenido.
        const { error: updateErr } = await admin.auth.admin.updateUserById(usuario.user_id, {
            password: passwordTemporal,
        })

        if (updateErr) {
            console.error('[resetPasswordUsuario] updateUserById', updateErr)
            return { data: null, error: 'No se pudo generar la nueva contraseña.' }
        }

        await registrarAuditoria({
            usuario_id: actor.usuarioId || null,
            tabla: 'usuarios',
            registro_id: usuario.id,
            accion: 'MODIFICACION',
            // Nunca registrar la contraseña, ni siquiera en auditoría.
            detalle: {
                usuario: `${usuario.nombre} ${usuario.apellido}`,
                accion: 'reset de contraseña',
            },
        })

        return { data: { passwordTemporal }, error: null }
    } catch (err) {
        console.error('[resetPasswordUsuario]', err)
        return { data: null, error: 'Error al resetear la contraseña.' }
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
    const actor = await requireAdmin()
    if (!actor) return { data: null, error: ACCESO_DENEGADO }

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
