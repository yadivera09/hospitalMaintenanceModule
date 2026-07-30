/**
 * src/lib/seguridad/guard.ts
 *
 * Guard único de autorización para server actions.
 *
 * Reemplaza las cinco copias de verificarAdmin() que vivían duplicadas en
 * src/app/actions/seguridad/*.ts, y corrige dos problemas que tenían todas:
 *
 *   1. Usaban getSession(), que decodifica el JWT de la cookie SIN validarlo
 *      contra el servidor de Auth. getUser() sí lo valida — es la única forma
 *      segura de identificar al usuario en código de servidor.
 *   2. No verificaban usuarios.activo: una cuenta desactivada seguía operando.
 *
 * Las server actions son endpoints POST invocables por cualquier sesión
 * autenticada, así que TODA action de este módulo —incluidas las de solo
 * lectura— debe pasar por aquí antes de tocar createAdminClient(), que salta RLS.
 */

import { createClient } from '@/lib/supabase/server'
import { getEstadoUsuario, permisosUsuario, ROL_ADMINISTRADOR } from '@/lib/seguridad/permisos'

/** Mensaje único de denegación — no revela si el recurso existe. */
export const ACCESO_DENEGADO = 'Acceso denegado. Se requiere rol administrador.'

/** Denegación por permiso insuficiente sobre un módulo. */
export const SIN_PERMISO = 'No tienes permiso para realizar esta operación.'

/** Par módulo + acción exigido por una operación. Ej: ['/admin/equipos', 'crear'] */
export type Requisito = readonly [moduloUrl: string, permisoCodigo: string]

/** Actor autenticado y autorizado que ejecuta una action. */
export interface Actor {
    /** auth.users.id */
    userId: string
    /** usuarios.id (genérico) — el que se registra en auditoria */
    usuarioId: string
    roles: string[]
}

/**
 * Verifica que quien invoca la action es un usuario activo con rol 'administrador'.
 *
 * @returns El actor, o null si no hay sesión válida, la cuenta está desactivada
 *          o no tiene el rol. Nunca lanza.
 *
 * @example
 *   const actor = await requireAdmin()
 *   if (!actor) return { data: null, error: ACCESO_DENEGADO }
 */
export async function requireAdmin(): Promise<Actor | null> {
    return await requireRol('administrador')
}

/**
 * Variante genérica: exige que el usuario tenga uno de los roles indicados.
 * Hace OR entre ellos, igual que el resto del cálculo de permisos.
 *
 * @param roles - Nombres de rol aceptados, ej: 'administrador', 'supervisor'.
 */
export async function requireRol(...roles: string[]): Promise<Actor | null> {
    const actor = await getActor()
    if (!actor) return null
    if (!roles.some((r) => actor.roles.includes(r))) return null
    return actor
}

/**
 * Verifica que quien invoca la action tiene permiso para hacerlo.
 *
 * Los requisitos se evalúan con OR: basta cumplir uno. Es necesario porque
 * varias operaciones las comparten los dos paneles — guardar el detalle de un
 * reporte lo hace el técnico desde /tecnico/nuevo-reporte y el administrador
 * desde /admin/reportes, y ninguno de los dos tiene permiso sobre el módulo
 * del otro.
 *
 * El rol 'administrador' pasa siempre, igual que en el middleware: su acceso
 * es total por definición y no debe depender de que la matriz esté completa.
 *
 * @example
 *   const actor = await requirePermiso(['/admin/equipos', 'crear'])
 *   if (!actor) return { data: null, error: SIN_PERMISO }
 *
 * @example
 *   // Cualquiera de los dos basta
 *   const actor = await requirePermiso(
 *       ['/tecnico/nuevo-reporte', 'editar'],
 *       ['/admin/reportes', 'editar'],
 *   )
 */
export async function requirePermiso(...requisitos: Requisito[]): Promise<Actor | null> {
    const actor = await getActor()
    if (!actor) return null

    if (actor.roles.includes(ROL_ADMINISTRADOR)) return actor
    if (requisitos.length === 0) return actor

    const permisos = await permisosUsuario(actor.userId)

    const autorizado = requisitos.some(
        ([moduloUrl, codigo]) => permisos[moduloUrl]?.includes(codigo)
    )

    return autorizado ? actor : null
}

/**
 * Resuelve el actor autenticado sin exigir ningún rol concreto.
 * Útil para actions que solo necesitan saber quién llama (ej: auditoría propia).
 *
 * @returns null si no hay sesión válida o la cuenta está desactivada.
 */
export async function getActor(): Promise<Actor | null> {
    const supabase = createClient()

    // getUser() valida el JWT contra el servidor de Auth — no usar getSession()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const estado = await getEstadoUsuario(user.id)
    if (!estado || !estado.activo) return null

    return {
        userId: user.id,
        usuarioId: estado.usuarioId,
        roles: estado.roles,
    }
}
