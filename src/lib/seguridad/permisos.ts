/**
 * src/lib/seguridad/permisos.ts
 *
 * Helpers de permisos del módulo de seguridad.
 * Todas las queries usan createAdminClient() (service_role) para evitar
 * que las políticas RLS bloqueen lecturas del sistema de roles.
 *
 * Arquitectura de transición:
 *   1. Lee roles desde usuario_roles → roles (nueva tabla).
 *   2. Si no hay resultados, hace fallback a user_metadata.rol (compatibilidad
 *      con usuarios que aún no fueron migrados a la nueva tabla).
 *
 * El cálculo de permisos hace OR entre todos los roles activos del usuario:
 *   Si tiene rol 'tecnico' (sin exportar) Y rol 'supervisor' (con exportar),
 *   puede exportar.
 */

import { createAdminClient } from '@/lib/supabase/admin'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos
// ─────────────────────────────────────────────────────────────────────────────

/** Estructura de un registro en usuario_roles con join a roles */
interface UsuarioRolRow {
    activo: boolean
    roles: {
        nombre: string
    } | null
}

/** Estructura de un registro en rol_permisos_modulo con joins */
interface PermisoModuloRow {
    activo: boolean
    modulos: { url: string } | null
    permisos: { codigo: string } | null
}

// ─────────────────────────────────────────────────────────────────────────────
// getRolesUsuario
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene los nombres de los roles activos asignados a un usuario.
 *
 * Estrategia de lectura:
 *   1. Busca en usuario_roles → roles (nueva tabla RBAC).
 *   2. Si la tabla no retorna resultados (usuario no migrado), hace fallback
 *      a auth.users.user_metadata.rol para compatibilidad hacia atrás.
 *
 * @param userId - El auth.users.id del usuario (NO el usuarios.id).
 * @returns Array de nombres de rol, ej: ['administrador'] o ['tecnico', 'supervisor'].
 *          Retorna [] si el usuario no tiene roles ni metadata.
 *
 * @example
 *   const roles = await getRolesUsuario(user.id)
 *   if (roles.includes('administrador')) { ... }
 */
export async function getRolesUsuario(userId: string): Promise<string[]> {
    const admin = createAdminClient()

    // ── Nueva forma: usuarios → usuario_roles → roles ─────────────────────────
    const { data: filas, error } = await admin
        .from('usuario_roles')
        .select(`
            activo,
            roles ( nombre )
        `)
        .eq('activo', true)
        .filter('usuarios.user_id', 'eq', userId)

    // Si hay error de query, loggear y continuar al fallback
    if (error) {
        console.error('[getRolesUsuario] Error al leer usuario_roles:', error.message)
    }

    // Intentar extraer roles desde la query con join via usuarios
    // La query de arriba puede no retornar datos si el JOIN no está disponible
    // en la versión actual del cliente. Hacemos la query en dos pasos para mayor robustez.
    const { data: usuarioRow } = await admin
        .from('usuarios')
        .select('id')
        .eq('user_id', userId)
        .single()

    if (usuarioRow?.id) {
        const { data: rolRows, error: rolError } = await admin
            .from('usuario_roles')
            .select(`
                activo,
                roles ( nombre )
            `)
            .eq('usuario_id', usuarioRow.id)
            .eq('activo', true)

        if (rolError) {
            console.error('[getRolesUsuario] Error al leer roles del usuario:', rolError.message)
        }

        if (rolRows && rolRows.length > 0) {
            const nombres = (rolRows as unknown as UsuarioRolRow[])
                .map((r) => r.roles?.nombre)
                .filter((n): n is string => typeof n === 'string' && n.length > 0)

            if (nombres.length > 0) return nombres
        }
    }

    // ── Fallback: user_metadata.rol (mientras se migra) ───────────────────────
    // Cubre usuarios cuyo registro en 'usuarios' aún no existe o no tiene roles.
    const { data: authUser } = await admin.auth.admin.getUserById(userId)
    const rolLegacy = authUser?.user?.user_metadata?.rol as string | undefined

    if (rolLegacy) {
        console.warn(
            `[getRolesUsuario] Usuario ${userId} no tiene roles en usuario_roles. ` +
            `Usando fallback user_metadata.rol="${rolLegacy}".`
        )
        return [rolLegacy]
    }

    return []
}

// ─────────────────────────────────────────────────────────────────────────────
// tienePermiso
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica si un usuario tiene un permiso específico sobre un módulo.
 *
 * El cálculo hace OR entre todos los roles activos del usuario:
 * basta con que cualquiera de sus roles tenga el permiso para que retorne true.
 *
 * Ejemplo:
 *   - Rol 'tecnico' NO tiene permiso 'exportar' en '/admin/reportes'.
 *   - Rol 'supervisor' SÍ tiene permiso 'exportar' en '/admin/reportes'.
 *   - Un usuario con ambos roles → puede exportar (OR).
 *
 * @param userId     - El auth.users.id del usuario.
 * @param moduloUrl  - La URL del módulo tal como está en la tabla 'modulos'.
 *                     Ejemplo: '/admin/reportes', '/tecnico/dashboard'.
 * @param permisoCodigo - El código del permiso. Valores válidos:
 *                        'ver' | 'crear' | 'editar' | 'eliminar' | 'exportar' | 'anular'.
 * @returns true si alguno de los roles activos del usuario tiene ese permiso.
 *          false si no tiene el permiso o si ocurre algún error (fail-closed).
 */
export async function tienePermiso(
    userId: string,
    moduloUrl: string,
    permisoCodigo: string
): Promise<boolean> {
    const admin = createAdminClient()

    // 1. Obtener roles activos del usuario
    const roles = await getRolesUsuario(userId)
    if (roles.length === 0) return false

    // 2. Verificar si algún rol tiene el permiso sobre el módulo
    //    Join: rol_permisos_modulo → roles (nombre) → modulos (url) → permisos (codigo)
    const { data, error } = await admin
        .from('rol_permisos_modulo')
        .select(`
            activo,
            roles ( nombre ),
            modulos ( url ),
            permisos ( codigo )
        `)
        .eq('activo', true)
        .in('roles.nombre', roles)

    if (error) {
        console.error('[tienePermiso] Error al consultar permisos:', error.message)
        return false // Fail-closed: ante error, denegar acceso
    }

    if (!data || data.length === 0) return false

    // 3. Filtrar por módulo y permiso específicos en memoria
    //    (más simple y predecible que múltiples filtros anidados en Supabase)
    return (data as unknown as PermisoModuloRow[]).some(
        (row) =>
            row.activo &&
            row.modulos?.url === moduloUrl &&
            row.permisos?.codigo === permisoCodigo
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// permisosUsuario
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna el mapa completo de permisos de un usuario, agrupado por módulo.
 *
 * Útil para renderizar la UI condicionalmente: saber de un solo fetch
 * qué puede ver/crear/editar el usuario sin hacer múltiples llamadas a
 * tienePermiso().
 *
 * El cálculo hace OR entre todos los roles activos del usuario (igual que
 * tienePermiso). Si cualquier rol da acceso a una acción, aparece en el mapa.
 *
 * @param userId - El auth.users.id del usuario.
 * @returns Objeto con URLs de módulos como claves y arrays de códigos de
 *          permiso como valores.
 *
 * @example
 *   const permisos = await permisosUsuario(user.id)
 *   // { '/admin/reportes': ['ver', 'crear', 'anular'], '/admin/equipos': ['ver'] }
 *
 *   if (permisos['/admin/reportes']?.includes('crear')) {
 *       // mostrar botón de crear reporte
 *   }
 */
export async function permisosUsuario(
    userId: string
): Promise<Record<string, string[]>> {
    const admin = createAdminClient()

    // 1. Obtener roles activos del usuario
    const roles = await getRolesUsuario(userId)
    if (roles.length === 0) return {}

    // 2. Obtener IDs de los roles para filtrar en rol_permisos_modulo
    const { data: rolData, error: rolError } = await admin
        .from('roles')
        .select('id, nombre')
        .in('nombre', roles)
        .eq('activo', true)

    if (rolError || !rolData || rolData.length === 0) {
        console.error('[permisosUsuario] Error al obtener IDs de roles:', rolError?.message)
        return {}
    }

    const rolIds = rolData.map((r) => r.id)

    // 3. Obtener todos los permisos activos de esos roles con join a módulos y permisos
    const { data, error } = await admin
        .from('rol_permisos_modulo')
        .select(`
            activo,
            modulos ( url ),
            permisos ( codigo )
        `)
        .in('rol_id', rolIds)
        .eq('activo', true)

    if (error) {
        console.error('[permisosUsuario] Error al consultar permisos:', error.message)
        return {}
    }

    if (!data || data.length === 0) return {}

    // 4. Agrupar por URL de módulo, acumulando códigos de permiso (OR entre roles)
    const mapa: Record<string, string[]> = {}

    for (const row of data as unknown as PermisoModuloRow[]) {
        const url = row.modulos?.url
        const codigo = row.permisos?.codigo

        if (!url || !codigo || !row.activo) continue

        if (!mapa[url]) {
            mapa[url] = []
        }

        // Evitar duplicados (puede haber dos roles con el mismo permiso)
        if (!mapa[url].includes(codigo)) {
            mapa[url].push(codigo)
        }
    }

    return mapa
}
