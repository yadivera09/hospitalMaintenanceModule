/**
 * src/lib/seguridad/permisos.ts
 *
 * Helpers de permisos del módulo de seguridad.
 * Todas las queries usan createAdminClient() (service_role) para evitar
 * que las políticas RLS bloqueen lecturas del sistema de roles.
 *
 * Fuente de verdad ÚNICA: usuario_roles → roles.
 *
 * IMPORTANTE — no reintroducir el fallback a user_metadata.rol:
 *   user_metadata es escribible por el propio usuario vía
 *   supabase.auth.updateUser({ data: { rol: 'administrador' } }). Usarlo para
 *   decidir autorización permite que cualquier usuario se auto-ascienda.
 *   Los roles solo se asignan desde /admin/seguridad/usuarios (tabla usuario_roles).
 *   Ver migración 014_seguridad_hardening.sql.
 *
 * El cálculo de permisos hace OR entre todos los roles activos del usuario:
 *   Si tiene rol 'tecnico' (sin exportar) Y rol 'supervisor' (con exportar),
 *   puede exportar.
 */

import { createAdminClient } from '@/lib/supabase/admin'

/** Rol con acceso total: no se filtra por la matriz de permisos. */
export const ROL_ADMINISTRADOR = 'administrador'

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
// getEstadoUsuario
// ─────────────────────────────────────────────────────────────────────────────

/** Identidad, estado y roles de un usuario — resuelto en una sola query. */
export interface EstadoUsuario {
    /** usuarios.id (genérico) — el que referencian usuario_roles y auditoria */
    usuarioId: string
    nombre: string
    apellido: string
    email: string
    /** false = cuenta desactivada; el middleware corta el acceso */
    activo: boolean
    /** Nombres de los roles activos, ej: ['administrador'] */
    roles: string[]
}

/**
 * Resuelve identidad, estado y roles de un usuario en una sola consulta.
 *
 * Reemplaza el par de queries que hacía getRolesUsuario (usuarios + usuario_roles)
 * y añade el flag `activo`, que antes no se verificaba en ningún punto del flujo
 * de acceso: desactivar un usuario no le impedía entrar.
 *
 * @param userId - El auth.users.id del usuario (NO el usuarios.id).
 * @returns null si el usuario no tiene fila en public.usuarios.
 */
export async function getEstadoUsuario(userId: string): Promise<EstadoUsuario | null> {
    const admin = createAdminClient()

    const { data, error } = await admin
        .from('usuarios')
        .select(`
            id, nombre, apellido, email, activo,
            usuario_roles (
                activo,
                roles ( nombre )
            )
        `)
        .eq('user_id', userId)
        .maybeSingle()

    if (error) {
        console.error('[getEstadoUsuario] Error al leer el usuario:', error.message)
        return null // Fail-closed: ante error, sin identidad ni roles
    }

    if (!data) return null

    const roles = (data.usuario_roles as unknown as UsuarioRolRow[] ?? [])
        .filter((ur) => ur.activo)
        .map((ur) => ur.roles?.nombre)
        .filter((n): n is string => typeof n === 'string' && n.length > 0)

    return {
        usuarioId: data.id,
        nombre: data.nombre,
        apellido: data.apellido,
        email: data.email,
        activo: data.activo,
        roles: Array.from(new Set(roles)),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// getRolesUsuario
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene los nombres de los roles activos asignados a un usuario.
 *
 * Fuente única: usuario_roles → roles. Un usuario sin fila en public.usuarios,
 * desactivado, o sin roles asignados obtiene [] — nunca se infiere un rol desde
 * user_metadata (ver nota de seguridad en la cabecera del archivo).
 *
 * @param userId - El auth.users.id del usuario (NO el usuarios.id).
 * @returns Array de nombres de rol, ej: ['administrador'] o ['tecnico', 'supervisor'].
 *
 * @example
 *   const roles = await getRolesUsuario(user.id)
 *   if (roles.includes('administrador')) { ... }
 */
export async function getRolesUsuario(userId: string): Promise<string[]> {
    const estado = await getEstadoUsuario(userId)
    if (!estado || !estado.activo) return []
    return estado.roles
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
 *
 * IMPORTANTE — no reintroducir la consulta propia que tenía esta función:
 *   filtraba con .in('roles.nombre', roles) sobre una relación EMBEBIDA sin
 *   !inner. PostgREST no descarta filas padre así: devuelve todas las filas de
 *   rol_permisos_modulo con roles: null para las que no coinciden. Y el filtro
 *   en memoria solo comparaba módulo y código, nunca el rol — de modo que
 *   cualquier usuario obtenía los permisos de CUALQUIER rol del sistema.
 *   Delegar en permisosUsuario(), que filtra por rol_id en la consulta, es lo
 *   que cierra ese agujero y deja una sola implementación del cálculo.
 */
export async function tienePermiso(
    userId: string,
    moduloUrl: string,
    permisoCodigo: string
): Promise<boolean> {
    const roles = await getRolesUsuario(userId)
    if (roles.length === 0) return false

    // Atajo de administrador: acceso total por definición, sin consultar la
    // matriz. Se mantiene aquí y no se delega en permisosUsuario() porque ese
    // mapa se construye solo con los módulos sembrados: un módulo que falte en
    // el catálogo dejaría al administrador fuera, incluida la pantalla desde la
    // que se arreglan los permisos.
    if (roles.includes(ROL_ADMINISTRADOR)) return true

    const permisos = await permisosUsuario(userId)

    return permisos[moduloUrl]?.includes(permisoCodigo) ?? false
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

    // Atajo de administrador: todos los permisos sobre todos los módulos
    // activos, sin depender de lo que haya en la matriz (ver tienePermiso).
    if (roles.includes(ROL_ADMINISTRADOR)) {
        const [{ data: modulos }, { data: permisos }] = await Promise.all([
            admin.from('modulos').select('url').eq('activo', true),
            admin.from('permisos').select('codigo'),
        ])

        const codigos = (permisos ?? []).map((p) => p.codigo)
        const mapa: Record<string, string[]> = {}

        for (const modulo of modulos ?? []) {
            mapa[modulo.url] = codigos
        }

        return mapa
    }

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
