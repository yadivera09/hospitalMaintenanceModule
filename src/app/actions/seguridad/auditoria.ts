'use server'

/**
 * src/app/actions/seguridad/auditoria.ts
 * Server Actions para consulta del registro de auditoría.
 * Solo lectura — las escrituras van a través de registrarAuditoria() en los helpers.
 * Solo administradores pueden consultar la auditoría.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getRolesUsuario } from '@/lib/seguridad/permisos'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type ActionResult<T> = { data: T | null; error: string | null }

/** Acciones auditables — debe coincidir con el ENUM accion_auditoria en DB */
export type AccionAuditoria = 'ADICION' | 'MODIFICACION' | 'ELIMINACION'

export interface RegistroAuditoria {
    id: string
    usuario_id: string | null
    usuario_nombre: string | null  // nombre completo del usuario, si existe
    tabla: string
    registro_id: string
    accion: AccionAuditoria
    detalle: Record<string, unknown> | null
    ip: string | null
    user_agent: string | null
    created_at: string
}

export interface FiltrosAuditoria {
    /** usuarios.id del actor — filtra por quién hizo la acción */
    usuario_id?: string
    /** Nombre exacto de la tabla afectada */
    tabla?: string
    /** Tipo de acción */
    accion?: AccionAuditoria
    /** Inicio del rango de fechas (ISO 8601) */
    fecha_desde?: string
    /** Fin del rango de fechas (ISO 8601) */
    fecha_hasta?: string
    /** Número de página (base 1) */
    pagina?: number
}

const PAGE_SIZE = 50

// ─────────────────────────────────────────────────────────────────────────────
// getAuditoria — lista paginada con filtros
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene el registro de auditoría paginado (50 registros por página),
 * con filtros opcionales por usuario, tabla, acción y rango de fechas.
 * Solo administradores.
 *
 * @param filtros - Filtros opcionales para acotar resultados.
 * @returns Lista de registros + total de registros que coinciden con el filtro.
 */
export async function getAuditoria(filtros: FiltrosAuditoria = {}): Promise<
    ActionResult<{ registros: RegistroAuditoria[]; total: number; pagina: number; totalPaginas: number }>
> {
    // Verificar que el usuario actual es administrador
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
        return { data: null, error: 'No hay sesión activa.' }
    }

    const roles = await getRolesUsuario(session.user.id)
    if (!roles.includes('administrador')) {
        return { data: null, error: 'Acceso denegado. Se requiere rol administrador.' }
    }

    try {
        const admin = createAdminClient()
        const pagina = Math.max(1, filtros.pagina ?? 1)
        const from = (pagina - 1) * PAGE_SIZE
        const to = from + PAGE_SIZE - 1

        // Construir query base con join a usuarios para el nombre del actor
        let query = admin
            .from('auditoria')
            .select(
                `
                id, usuario_id, tabla, registro_id, accion,
                detalle, ip, user_agent, created_at,
                usuarios ( nombre, apellido )
                `,
                { count: 'exact' }
            )
            .order('created_at', { ascending: false })
            .range(from, to)

        // Aplicar filtros opcionales
        if (filtros.usuario_id) {
            query = query.eq('usuario_id', filtros.usuario_id)
        }
        if (filtros.tabla) {
            query = query.eq('tabla', filtros.tabla)
        }
        if (filtros.accion) {
            query = query.eq('accion', filtros.accion)
        }
        if (filtros.fecha_desde) {
            query = query.gte('created_at', filtros.fecha_desde)
        }
        if (filtros.fecha_hasta) {
            // Incluir todo el día final: agregar 1 día al límite superior
            query = query.lte('created_at', filtros.fecha_hasta)
        }

        const { data, error, count } = await query

        if (error) throw error

        const total = count ?? 0
        const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE))

        const registros: RegistroAuditoria[] = (data ?? []).map((r) => {
            const usuario = r.usuarios as { nombre: string; apellido: string } | null
            return {
                id: r.id,
                usuario_id: r.usuario_id,
                usuario_nombre: usuario ? `${usuario.nombre} ${usuario.apellido}` : null,
                tabla: r.tabla,
                registro_id: r.registro_id,
                accion: r.accion as AccionAuditoria,
                detalle: r.detalle as Record<string, unknown> | null,
                ip: r.ip,
                user_agent: r.user_agent,
                created_at: r.created_at,
            }
        })

        return {
            data: { registros, total, pagina, totalPaginas },
            error: null,
        }
    } catch (err) {
        console.error('[getAuditoria]', err)
        return { data: null, error: 'Error al cargar el registro de auditoría.' }
    }
}
