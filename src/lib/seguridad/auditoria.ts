/**
 * src/lib/seguridad/auditoria.ts
 *
 * Helpers de auditoría del módulo de seguridad.
 *
 * Diseño deliberado:
 *   - No usa triggers de PostgreSQL. El registro es responsabilidad de la
 *     capa de aplicación (server actions) para mayor visibilidad y control.
 *   - withAudit() envuelve una server action y registra automáticamente.
 *   - Si la action falla → no se audita (coherencia: solo se auditan éxitos).
 *   - Si la auditoría falla → NO rompe la action (solo console.error).
 *
 * Todas las escrituras van via createAdminClient() (service_role) porque
 * la tabla auditoria no tiene policies INSERT para 'authenticated'.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

/** Acciones auditables del sistema — coincide con el ENUM accion_auditoria en DB */
export type AccionAuditoria = 'ADICION' | 'MODIFICACION' | 'ELIMINACION'

/** Parámetros requeridos para registrar un evento de auditoría */
export interface AuditoriaParams {
    /** usuarios.id (genérico) del usuario que realizó la acción. NO auth.users.id. */
    usuario_id: string | null
    /** Nombre exacto de la tabla afectada. Ej: 'reportes_mantenimiento' */
    tabla: string
    /** UUID del registro afectado */
    registro_id: string
    /** Tipo de acción realizada */
    accion: AccionAuditoria
    /**
     * Snapshot del cambio en formato libre. Convención recomendada:
     *   { antes: { campo: valorAnterior }, despues: { campo: valorNuevo } }
     * Para ADICION: { datos: { ...camposInsertados } }
     * Para ELIMINACION: { datos: { ...camposBorrados } }
     */
    detalle?: Record<string, unknown>
}

/** Configuración del wrapper withAudit */
export interface AuditConfig<TArgs extends unknown[], TResult> {
    /** Nombre de la tabla que se está auditando */
    tabla: string
    /** Tipo de acción que realiza la action envuelta */
    accion: AccionAuditoria
    /**
     * Función que extrae el UUID del registro afectado desde el resultado
     * de la action. Necesario para registrar registro_id en auditoría.
     */
    obtenerRegistroId: (resultado: TResult) => string
    /**
     * Función opcional que construye el detalle del cambio (snapshot).
     * Recibe el resultado de la action y los args originales.
     */
    obtenerDetalle?: (resultado: TResult, args: TArgs) => Record<string, unknown>
    /**
     * Función opcional que resuelve el usuario_id (usuarios.id) del actor.
     * Si no se provee, se registra usuario_id = null.
     */
    obtenerUsuarioId?: (args: TArgs) => string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// registrarAuditoria
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inserta un registro en la tabla `auditoria` usando service_role.
 *
 * Captura automáticamente ip y user_agent desde los headers del request
 * actual de Next.js (disponibles en server actions y route handlers).
 * Si los headers no están disponibles (ej: llamada fuera de un request),
 * los campos ip y user_agent quedan como null sin lanzar error.
 *
 * Esta función nunca lanza — ante cualquier error, solo loggea en consola.
 * Usar así dentro de server actions:
 *
 * @example
 *   await registrarAuditoria({
 *     usuario_id: usuarioActual.id,
 *     tabla: 'equipos',
 *     registro_id: nuevoEquipo.id,
 *     accion: 'ADICION',
 *     detalle: { datos: nuevoEquipo },
 *   })
 *
 * @param params - Datos del evento a registrar.
 */
export async function registrarAuditoria(params: AuditoriaParams): Promise<void> {
    let ip: string | null = null
    let userAgent: string | null = null

    // Intentar capturar headers del request actual (Next.js server context)
    try {
        const headersList = headers()
        ip =
            headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
            headersList.get('x-real-ip') ??
            null
        userAgent = headersList.get('user-agent') ?? null
    } catch {
        // Fuera del contexto de un request (ej: script de seed, test unitario).
        // No es un error — simplemente no hay headers disponibles.
    }

    try {
        const admin = createAdminClient()

        const { error } = await admin.from('auditoria').insert({
            usuario_id: params.usuario_id,
            tabla: params.tabla,
            registro_id: params.registro_id,
            accion: params.accion,
            detalle: params.detalle ?? null,
            ip,
            user_agent: userAgent,
        })

        if (error) {
            console.error(
                `[Auditoría] Error al insertar registro (tabla=${params.tabla}, ` +
                `accion=${params.accion}, registro=${params.registro_id}):`,
                error.message
            )
        }
    } catch (err) {
        // La auditoría nunca debe romper el flujo de la aplicación
        console.error('[Auditoría] Error inesperado al registrar:', err)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// withAudit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Envuelve una server action para que registre auditoría automáticamente
 * al completarse con éxito.
 *
 * Comportamiento:
 *   - Si la action lanza o rechaza → NO se registra auditoría.
 *   - Si la auditoría falla → NO se relanza el error; la action ya tuvo éxito.
 *   - El tipo de retorno de la action envuelta es preservado exactamente.
 *
 * @example
 *   // En /app/actions/equipos.ts
 *   export const crearEquipo = withAudit(
 *     {
 *       tabla: 'equipos',
 *       accion: 'ADICION',
 *       obtenerRegistroId: (equipo) => equipo.id,
 *       obtenerDetalle: (equipo, [datos]) => ({ datos }),
 *       obtenerUsuarioId: ([datos]) => datos.usuarioActualId ?? null,
 *     },
 *     async (datos: CrearEquipoInput) => {
 *       // ... lógica de inserción ...
 *       return equipoCreado
 *     }
 *   )
 *
 * @param config - Configuración de auditoría: tabla, acción, extractores de ID y detalle.
 * @param action - La server action original a envolver.
 * @returns Una nueva función con la misma firma que action, con auditoría incluida.
 */
export function withAudit<TArgs extends unknown[], TResult>(
    config: AuditConfig<TArgs, TResult>,
    action: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
    return async (...args: TArgs): Promise<TResult> => {
        // 1. Ejecutar la action original — si lanza, el error se propaga
        //    sin registrar auditoría (coherencia: solo se auditan operaciones exitosas)
        const resultado = await action(...args)

        // 2. Registrar auditoría en background — nunca bloquea la respuesta
        //    y nunca lanza (registrarAuditoria captura todos sus errores internamente)
        try {
            const registroId = config.obtenerRegistroId(resultado)
            const detalle = config.obtenerDetalle?.(resultado, args)
            const usuarioId = config.obtenerUsuarioId?.(args) ?? null

            await registrarAuditoria({
                usuario_id: usuarioId,
                tabla: config.tabla,
                registro_id: registroId,
                accion: config.accion,
                detalle,
            })
        } catch (err) {
            // Si obtenerRegistroId o obtenerDetalle lanzan, no romper la action
            console.error('[withAudit] Error al preparar datos de auditoría:', err)
        }

        return resultado
    }
}
