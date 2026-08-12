'use server'

/**
 * src/app/actions/reportes.ts
 * BLOQUE 3 — PROCESO 2: Creación de reportes con transacciones.
 *
 * Flujo de estados:
 *   borrador → pendiente_firma_tecnico → pendiente_firma_cliente → cerrado
 *
 * PASO 1: createBorradorReporte       — INSERT en reportes_mantenimiento
 * PASO 2: guardarDetalleReporte       — UPDATE + reporte_actividades batch
 * PASO 3: guardarInsumosTecnicos      — DELETE+INSERT en 4 tablas de apoyo
 * PASO 4: firmarComoTecnico           — Hash SHA-256 + Storage + UPDATE estado
 * PASO 5: firmarComoCliente           — Hash SHA-256 + Storage + UPDATE cerrado
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '../../lib/supabase/admin'
import { requirePermiso, SIN_PERMISO } from '@/lib/seguridad/guard'
import { MODULO, PERMISO } from '@/lib/seguridad/modulos'
import { z } from 'zod'
import crypto from 'crypto'
import type { ReporteResumen, EstadoReporte } from '@/types'

// ─── Requisitos de permiso ────────────────────────────────────────────────────
//
// El ciclo de vida de un reporte lo comparten los dos paneles: el técnico lo
// levanta desde /tecnico/nuevo-reporte y el administrador lo gestiona desde
// /admin/reportes. Ninguno tiene permiso sobre el módulo del otro, así que
// cada operación acepta cualquiera de los dos orígenes (evaluación OR).

/** Consultar reportes: propios del técnico o el listado de administración. */
const VER_REPORTES = [
    [MODULO.REPORTES, PERMISO.VER],
    [MODULO.TEC_MIS_REPORTES, PERMISO.VER],
    [MODULO.TEC_NUEVO_REPORTE, PERMISO.VER],
] as const

/** Levantar un reporte nuevo. */
const CREAR_REPORTES = [
    [MODULO.REPORTES, PERMISO.CREAR],
    [MODULO.TEC_NUEVO_REPORTE, PERMISO.CREAR],
] as const

/**
 * Modificar un reporte en curso: detalle, insumos, borrador y firmas.
 *
 * El técnico usa 'editar' sobre su módulo — no 'eliminar' ni 'anular', que son
 * operaciones de administración que él no tiene y no debe tener.
 */
const EDITAR_REPORTES = [
    [MODULO.REPORTES, PERMISO.EDITAR],
    [MODULO.TEC_NUEVO_REPORTE, PERMISO.EDITAR],
] as const

// ─── Tipos de respuesta ────────────────────────────────────────────────────────

interface ActionResult<T = null> {
    data: T | null
    error: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sha256(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex')
}

/** Convierte base64 del canvas a Buffer para subir a Storage */
function base64ToBuffer(base64: string): Buffer {
    const data = base64.replace(/^data:image\/\w+;base64,/, '')
    return Buffer.from(data, 'base64')
}

/** 
 * Crea un insumo en el catálogo maestro de forma inmediata.
 * BLOQUE 4 — Optimización de flujo de insumos.
 * Bug-fix: normaliza espacios y usa ilike para evitar duplicados por casing/espacios.
 */
export async function crearInsumoRapido(nombre: string): Promise<ActionResult<any>> {
    // Escribe en el catálogo maestro, pero se invoca desde el formulario de
    // reporte: se acepta también el permiso de crear reportes.
    const autorizado = await requirePermiso(
        [MODULO.CATALOGOS, PERMISO.CREAR],
        ...CREAR_REPORTES,
    )
    if (!autorizado) return { data: null, error: SIN_PERMISO }

    try {
        const adminSupabase = createAdminClient()
        // Normalizar: quitar espacios extremos y colapsar espacios internos múltiples
        const nombreLimpio = nombre.trim().replace(/\s+/g, ' ')

        if (!nombreLimpio) {
            return { data: null, error: 'El nombre del insumo no puede estar vacío' }
        }

        // 1. Verificar si ya existe (case-insensitive) para evitar duplicados
        const { data: existing } = await adminSupabase
            .from('insumos')
            .select('id, nombre, unidad_medida, activo')
            .ilike('nombre', nombreLimpio.trim())
            .maybeSingle()

        if (existing) {
            return { data: existing, error: null }
        }

        // 2. Insertar si no existe
        const { data: newIns, error } = await adminSupabase
            .from('insumos')
            .insert({
                nombre: nombreLimpio,
                unidad_medida: 'Unidad',
                activo: true
            })
            .select('id, nombre, unidad_medida, activo')
            .single()

        if (error) {
            console.error('[crearInsumoRapido] error:', error)
            // Si hay violación de unicidad, intentar recuperar el registro existente
            if (error.code === '23505') {
                const { data: fallback } = await adminSupabase
                    .from('insumos')
                    .select('id, nombre, unidad_medida, activo')
                    .ilike('nombre', nombreLimpio)
                    .maybeSingle()
                if (fallback) return { data: fallback, error: null }
            }
            return { data: null, error: 'Error al crear el insumo: ' + error.message }
        }

        return { data: newIns, error: null }
    } catch (err) {
        console.error('[crearInsumoRapido] catch:', err)
        return { data: null, error: 'Error inesperado al crear el insumo' }
    }
}


// =============================================================================
// PASO 1 — Crear borrador de reporte
// =============================================================================

const CreateBorradorSchema = z.object({
    equipo_id: z.string().uuid('equipo_id debe ser UUID'),
    tecnico_principal_id: z.string().uuid('tecnico_principal_id debe ser UUID'),
    tipo_mantenimiento_id: z.string().uuid('tipo_mantenimiento_id debe ser UUID'),
    fecha_inicio: z.string().min(1, 'fecha_inicio requerida'),
    hora_entrada: z.string().optional().nullable(),
    ciudad: z.string().optional().nullable(),
    solicitado_por: z.string().optional().nullable(),
    motivo_visita: z.string().optional().nullable(),
    numero_reporte_fisico: z.string().optional().nullable(),
    ubicacion_id: z.string().uuid().optional().nullable(),
    ubicacion_detalle: z.string().optional().nullable(),
    dispositivo_origen: z.string().optional().nullable(),
    // Id del borrador en el dispositivo que lo creó sin conexión. Es lo que
    // hace idempotente el reintento: ver migración 024.
    id_local: z.string().optional().nullable(),
})

export async function createBorradorReporte(
    input: z.infer<typeof CreateBorradorSchema>
): Promise<ActionResult<{ id: string }>> {
    if (!await requirePermiso(...CREAR_REPORTES)) return { data: null, error: SIN_PERMISO }

    try {
        const parsed = CreateBorradorSchema.safeParse(input)
        if (!parsed.success) {
            return { data: null, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
        }
        const data = parsed.data

        const supabase = createClient()

        // Auto-fill snapshots del equipo
        const { data: equipo, error: eqErr } = await supabase
            .from('equipos')
            .select('marca, modelo, numero_serie')
            .eq('id', data.equipo_id)
            .single()

        if (eqErr || !equipo) {
            return { data: null, error: 'Equipo no encontrado' }
        }

        // INSERT borrador
        const { data: reporte, error: insErr } = await supabase
            .from('reportes_mantenimiento')
            .insert({
                equipo_id: data.equipo_id,
                tecnico_principal_id: data.tecnico_principal_id,
                tipo_mantenimiento_id: data.tipo_mantenimiento_id,
                fecha_inicio: data.fecha_inicio,
                hora_entrada: data.hora_entrada ?? null,
                ciudad: data.ciudad ?? null,
                solicitado_por: data.solicitado_por ?? null,
                motivo_visita: data.motivo_visita ?? null,
                numero_reporte_fisico: data.numero_reporte_fisico ?? null,
                ubicacion_id: data.ubicacion_id ?? null,
                ubicacion_detalle: data.ubicacion_detalle ?? null,
                dispositivo_origen: data.dispositivo_origen ?? 'web',
                id_local: data.id_local ?? null,
                estado_reporte: 'en_progreso',
                // Snapshots del equipo
                equipo_marca_snapshot: equipo.marca ?? null,
                equipo_modelo_snapshot: equipo.modelo ?? null,
                equipo_serie_snapshot: equipo.numero_serie ?? null,
            })
            .select('id')
            .single()

        if (insErr) {
            // 23505 sobre ux_reportes_id_local significa que este mismo borrador
            // ya se subió: un intento anterior llegó al servidor y la respuesta
            // se perdió por el camino. No es un error, es la segunda mitad de un
            // envío que ya había funcionado — se devuelve el reporte existente y
            // el reintento continúa sobre él en vez de crear un duplicado.
            //
            // Es la razón de ser de la migración 024. Sin este bloque el índice
            // solo convertiría el duplicado silencioso en un fallo ruidoso.
            if (insErr.code === '23505' && data.id_local) {
                const { data: previo } = await supabase
                    .from('reportes_mantenimiento')
                    .select('id')
                    .eq('id_local', data.id_local)
                    .maybeSingle()

                if (previo) return { data: { id: previo.id }, error: null }
            }

            console.error('[createBorradorReporte]', insErr)
            return { data: null, error: 'Error al crear el borrador del reporte' }
        }

        return { data: { id: reporte.id }, error: null }
    } catch (err) {
        console.error('[createBorradorReporte]', err)
        return { data: null, error: 'Error inesperado al crear el reporte' }
    }
}

export async function actualizarBorradorReporte(
    reporte_id: string,
    input: z.infer<typeof CreateBorradorSchema>
): Promise<ActionResult<{ id: string }>> {
    if (!await requirePermiso(...EDITAR_REPORTES)) return { data: null, error: SIN_PERMISO }

    try {
        const parsed = CreateBorradorSchema.safeParse(input)
        if (!parsed.success) {
            return { data: null, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
        }
        const data = parsed.data

        const supabase = createClient()

        // UPDATE borrador
        const { error: updErr } = await supabase
            .from('reportes_mantenimiento')
            .update({
                tipo_mantenimiento_id: data.tipo_mantenimiento_id,
                fecha_inicio: data.fecha_inicio,
                hora_entrada: data.hora_entrada ?? null,
                ciudad: data.ciudad ?? null,
                solicitado_por: data.solicitado_por ?? null,
                motivo_visita: data.motivo_visita ?? null,
                numero_reporte_fisico: data.numero_reporte_fisico ?? null,
                ubicacion_id: data.ubicacion_id ?? null,
                ubicacion_detalle: data.ubicacion_detalle ?? null,
                dispositivo_origen: data.dispositivo_origen ?? 'web',
            })
            .eq('id', reporte_id)
            .eq('estado_reporte', 'en_progreso')

        if (updErr) {
            console.error('[actualizarBorradorReporte]', updErr)
            return { data: null, error: 'Error al actualizar el borrador del reporte' }
        }

        return { data: { id: reporte_id }, error: null }
    } catch (err) {
        console.error('[actualizarBorradorReporte]', err)
        return { data: null, error: 'Error inesperado al actualizar el reporte' }
    }
}

// =============================================================================
// PASO 1.5 — Consultar borrador existente
// =============================================================================

export async function getBorradorReporte(
    equipo_id: string
): Promise<ActionResult<{ id: string; fecha_inicio: string } | null>> {
    if (!await requirePermiso(...VER_REPORTES)) return { data: null, error: SIN_PERMISO }

    try {
        const { unstable_noStore: noStore } = await import('next/cache')
        noStore()

        const supabase = createClient()

        // Obtener el usuario actual desde la sesión JWT (sin consultar auth.users)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
            return { data: null, error: 'Usuario no autenticado' }
        }

        // Obtener el tecnico_id desde la tabla tecnicos
        const { data: tecnico } = await supabase
            .from('tecnicos')
            .select('id')
            .eq('user_id', session.user.id)
            .single()

        if (!tecnico) {
            return { data: null, error: 'No se encontró el técnico asociado' }
        }

        const { data: reporte, error } = await supabase
            .from('reportes_mantenimiento')
            .select('id, fecha_inicio')
            .eq('equipo_id', equipo_id)
            .eq('tecnico_principal_id', tecnico.id)
            .eq('estado_reporte', 'en_progreso')
            .eq('activo', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (error) {
            console.error('[getBorradorReporte]', error)
            return { data: null, error: 'Error al consultar borrador' }
        }

        return { data: reporte ? { id: reporte.id, fecha_inicio: reporte.fecha_inicio } : null, error: null }
    } catch (err) {
        console.error('[getBorradorReporte]', err)
        return { data: null, error: 'Error inesperado al consultar borrador' }
    }
}

/**
 * Obtiene la fecha del último mantenimiento preventivo realizado a un equipo.
 * Según REFACTOR-PARTE1: 
 * - Misma equipo_id
 * - Tipo mantenimiento de tipo preventivo (es_planificado = true)
 * - Estado = 'cerrado'
 * - Retorna MAX(fecha_inicio)
 */
export async function getUltimoMantenimientoPreventivo(
    equipo_id: string
): Promise<ActionResult<string | null>> {
    if (!await requirePermiso(...VER_REPORTES)) return { data: null, error: SIN_PERMISO }

    try {
        const supabase = createClient()

        const { data, error } = await supabase
            .from('reportes_mantenimiento')
            .select(`
                fecha_inicio,
                tipo:tipos_mantenimiento!inner(es_planificado)
            `)
            .eq('equipo_id', equipo_id)
            .eq('tipo.es_planificado', true)
            .eq('estado_reporte', 'cerrado')
            .order('fecha_inicio', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (error) {
            console.error('[getUltimoMantenimientoPreventivo]', error)
            return { data: null, error: 'Error al consultar último preventivo' }
        }

        return { data: data?.fecha_inicio ?? null, error: null }
    } catch (err) {
        console.error('[getUltimoMantenimientoPreventivo]', err)
        return { data: null, error: 'Error inesperado al consultar último preventivo' }
    }
}

export async function getReporteBorradorData(reporte_id: string): Promise<ActionResult<any>> {
    if (!await requirePermiso(...VER_REPORTES)) return { data: null, error: SIN_PERMISO }

    try {
        const supabase = createClient()
        const [reporteRes, checklistRes] = await Promise.all([
            supabase
                .from('reportes_mantenimiento')
                .select('*')
                .eq('id', reporte_id)
                .single(),
            supabase
                .from('reporte_actividades')
                .select(`
                    actividad_id,
                    completada,
                    observacion,
                    actividad:actividades_checklist(descripcion, obligatoria)
                `)
                .eq('reporte_id', reporte_id)
        ])

        if (reporteRes.error || !reporteRes.data) {
            return { data: null, error: 'Reporte borrador no encontrado' }
        }

        const reporte = reporteRes.data
        const checklist = (checklistRes.data || []).map((c: any) => ({
            actividad_id: c.actividad_id,
            completada: c.completada,
            observacion: c.observacion,
            nombre: c.actividad?.descripcion || '',
            es_obligatoria: c.actividad?.obligatoria || false,
        }))

        return { data: { ...reporte, checklist }, error: null }
    } catch (err) {
        console.error('[getReporteBorradorData]', err)
        return { data: null, error: 'Error al cargar datos del borrador' }
    }
}

export async function eliminarBorradorReporte(reporte_id: string): Promise<ActionResult> {
    // Se exige 'editar' y no 'eliminar': descartar el propio borrador es parte
    // del trabajo del técnico, que no tiene —ni debe tener— permiso de borrado
    // sobre el módulo de reportes.
    if (!await requirePermiso(...EDITAR_REPORTES)) return { data: null, error: SIN_PERMISO }

    try {
        const supabase = createClient()

        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return { data: null, error: 'Usuario no autenticado' }

        // Primero verificamos que el reporte esté en borrador
        const { data: reporte, error: checkErr } = await supabase
            .from('reportes_mantenimiento')
            .select('estado_reporte')
            .eq('id', reporte_id)
            .single()

        if (checkErr || !reporte) return { data: null, error: 'Reporte no encontrado' }
        if (reporte.estado_reporte !== 'en_progreso') {
            return { data: null, error: 'Solo se pueden eliminar reportes en estado en_progreso' }
        }

        // Eliminación lógica (soft delete) en lugar de física
        const { error: delErr } = await supabase
            .from('reportes_mantenimiento')
            .update({ activo: false })
            .eq('id', reporte_id)

        if (delErr) {
            console.error('[eliminarBorradorReporte] delete', delErr)
            return { data: null, error: 'Error al eliminar el borrador' }
        }

        const { revalidatePath } = await import('next/cache')
        revalidatePath('/tecnico/nuevo-reporte', 'page')

        return { data: null, error: null }
    } catch (err) {
        console.error('[eliminarBorradorReporte]', err)
        return { data: null, error: 'Error inesperado al eliminar borrador' }
    }
}

// =============================================================================
// PASO 2 — Guardar detalle + checklist → estado: pendiente_firma_tecnico
// =============================================================================

const ActividadSchema = z.object({
    actividad_id: z.string().uuid(),
    completada: z.boolean(),
    observacion: z.string().optional().nullable(),
})

const GuardarDetalleSchema = z.object({
    reporte_id: z.string().uuid(),
    diagnostico: z.string().optional().nullable(),
    trabajo_realizado: z.string().optional().nullable(),
    observaciones: z.string().optional().nullable(),
    hora_salida: z.string().optional().nullable(),
    estado_equipo_post: z.enum(['operativo', 'restringido', 'no_operativo', 'almacenado', 'dado_de_baja']),
    actividades: z.array(ActividadSchema),
})

export async function guardarDetalleReporte(
    input: z.infer<typeof GuardarDetalleSchema>
): Promise<ActionResult> {
    if (!await requirePermiso(...EDITAR_REPORTES)) return { data: null, error: SIN_PERMISO }

    try {
        const parsed = GuardarDetalleSchema.safeParse(input)
        if (!parsed.success) {
            return { data: null, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
        }
        const data = parsed.data
        const supabase = createClient()

        // Verificar que el reporte existe y no haya sido borrado
        const { data: reporte, error: checkErr } = await supabase
            .from('reportes_mantenimiento')
            .select('id, estado_reporte')
            .eq('id', data.reporte_id)
            .eq('activo', true)
            .single()

        if (checkErr || !reporte) {
            return { data: null, error: 'Reporte no encontrado' }
        }
        if (reporte.estado_reporte !== 'en_progreso') {
            return { data: null, error: `El reporte no está en progreso (estado actual: ${reporte.estado_reporte})` }
        }

        // UPDATE datos del reporte
        const { error: updErr } = await supabase
            .from('reportes_mantenimiento')
            .update({
                diagnostico: data.diagnostico ?? null,
                trabajo_realizado: data.trabajo_realizado ?? null,
                observaciones: data.observaciones ?? null,
                hora_salida: data.hora_salida ?? null,
                estado_equipo_post: data.estado_equipo_post,
                // Mantener estado_reporte en 'en_progreso', la firma es el Paso 4
            })
            .eq('id', data.reporte_id)
            .eq('estado_reporte', 'en_progreso')

        if (updErr) {
            console.error('[guardarDetalleReporte] update', updErr)
            return { data: null, error: 'Error al guardar el detalle del reporte' }
        }

        // DELETE checklist anterior + INSERT batch nuevo
        if (data.actividades.length > 0) {
            const { error: delErr } = await supabase
                .from('reporte_actividades')
                .delete()
                .eq('reporte_id', data.reporte_id)

            if (delErr) {
                // Revertir estado a en_progreso
                await supabase
                    .from('reportes_mantenimiento')
                    .update({ estado_reporte: 'en_progreso' })
                    .eq('id', data.reporte_id)
                return { data: null, error: 'Error al limpiar actividades previas' }
            }

            const actividadesInsert = data.actividades.map((a) => ({
                reporte_id: data.reporte_id,
                actividad_id: a.actividad_id,
                completada: a.completada,
                observacion: a.observacion ?? null,
            }))

            const { error: insErr } = await supabase
                .from('reporte_actividades')
                .insert(actividadesInsert)

            if (insErr) {
                // Revertir estado a en_progreso
                await supabase
                    .from('reportes_mantenimiento')
                    .update({ estado_reporte: 'en_progreso' })
                    .eq('id', data.reporte_id)
                console.error('[guardarDetalleReporte] insert actividades', insErr)
                return { data: null, error: 'Error al guardar el checklist. El reporte volvió a en_progreso.' }
            }
        }

        return { data: null, error: null }
    } catch (err) {
        console.error('[guardarDetalleReporte]', err)
        return { data: null, error: 'Error inesperado al guardar el detalle' }
    }
}

// =============================================================================
// PASO 3 — Guardar insumos, accesorios y técnicos de apoyo
// =============================================================================

const InsumoUsadoSchema = z.object({
    insumo_id: z.string().uuid().optional(),
    nombre: z.string().optional(),
    cantidad: z.number().positive(),
    observacion: z.string().optional().nullable(),
    es_nuevo: z.boolean().optional(),
})

const InsumoReqSchema = z.object({
    insumo_id: z.string().uuid().optional(),
    nombre: z.string().optional(),
    cantidad: z.number().positive(),
    urgente: z.boolean().default(false),
    observacion: z.string().optional().nullable(),
    es_nuevo: z.boolean().optional(),
})

const AccesorioSchema = z.object({
    descripcion: z.string().min(1),
    cantidad: z.number().positive().default(1),
    estado_equipo_contexto: z.string().optional().nullable(),
})

const GuardarInsumosSchema = z.object({
    reporte_id: z.string().uuid(),
    insumos_usados: z.array(InsumoUsadoSchema),
    insumos_requeridos: z.array(InsumoReqSchema),
    accesorios: z.array(AccesorioSchema),
    tecnicos_apoyo: z.array(z.object({ tecnico_id: z.string().uuid() })),
})

export async function guardarInsumosTecnicos(
    input: z.infer<typeof GuardarInsumosSchema>
): Promise<ActionResult> {
    if (!await requirePermiso(...EDITAR_REPORTES)) return { data: null, error: SIN_PERMISO }

    try {
        const parsed = GuardarInsumosSchema.safeParse(input)
        if (!parsed.success) {
            return { data: null, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
        }
        const data = parsed.data
        console.log('[guardarInsumosTecnicos] tecnicos_apoyo:', data.tecnicos_apoyo)
        const supabase = createClient()

        // Verificar estado válido (borrador o pendiente_firma_tecnico)
        const { data: reporte } = await supabase
            .from('reportes_mantenimiento')
            .select('id, estado_reporte')
            .eq('id', data.reporte_id)
            .single()

        if (!reporte) return { data: null, error: 'Reporte no encontrado' }
        if (!['en_progreso'].includes(reporte.estado_reporte)) {
            return { data: null, error: 'El reporte ya no puede modificarse' }
        }

        // ── Insumos usados
        await supabase.from('reporte_insumos_usados').delete().eq('reporte_id', data.reporte_id)
        if (data.insumos_usados.length > 0) {
            const itemsToInsert = []
            for (const i of data.insumos_usados) {
                if (i.insumo_id) {
                    itemsToInsert.push({
                        reporte_id: data.reporte_id,
                        insumo_id: i.insumo_id,
                        cantidad: i.cantidad,
                        observacion: i.observacion ?? null,
                    })
                }
            }
            if (itemsToInsert.length > 0) {
                const { error } = await supabase.from('reporte_insumos_usados').insert(itemsToInsert)
                if (error) return { data: null, error: 'Error al guardar insumos usados' }
            }
        }

        // ── Insumos requeridos
        await supabase.from('reporte_insumos_requeridos').delete().eq('reporte_id', data.reporte_id)
        if (data.insumos_requeridos.length > 0) {
            const itemsToInsert = []
            for (const i of data.insumos_requeridos) {
                if (i.insumo_id) {
                    itemsToInsert.push({
                        reporte_id: data.reporte_id,
                        insumo_id: i.insumo_id,
                        cantidad: i.cantidad,
                        urgente: i.urgente,
                        observacion: i.observacion ?? null,
                    })
                }
            }
            if (itemsToInsert.length > 0) {
                const { error } = await supabase.from('reporte_insumos_requeridos').insert(itemsToInsert)
                if (error) return { data: null, error: 'Error al guardar insumos requeridos' }
            }
        }

        // ── Accesorios
        await supabase.from('reporte_accesorios').delete().eq('reporte_id', data.reporte_id)
        if (data.accesorios.length > 0) {
            const { error } = await supabase.from('reporte_accesorios').insert(
                data.accesorios.map((a) => ({
                    reporte_id: data.reporte_id,
                    descripcion: a.descripcion,
                    cantidad: a.cantidad,
                    estado_equipo_contexto: a.estado_equipo_contexto ?? null,
                }))
            )
            if (error) return { data: null, error: 'Error al guardar accesorios' }
        }

        // ── Técnicos de apoyo (rol='apoyo', NO el principal)
        await supabase
            .from('reporte_tecnicos')
            .delete()
            .eq('reporte_id', data.reporte_id)
            .eq('rol', 'apoyo')

        if (data.tecnicos_apoyo.length > 0) {
            const { error } = await supabase.from('reporte_tecnicos').insert(
                data.tecnicos_apoyo.map((t) => ({
                    reporte_id: data.reporte_id,
                    tecnico_id: t.tecnico_id,
                    rol: 'apoyo',
                }))
            )
            if (error) return { data: null, error: 'Error al guardar técnicos de apoyo' }
        }

        // 5) UPDATE al reporte principal (Paso 3 no cambia estado, permanece en_progreso)
        const { error: updErr } = await supabase
            .from('reportes_mantenimiento')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', data.reporte_id)

        if (updErr) throw new Error('Error final update: ' + updErr.message)

        return { data: null, error: null }
    } catch (err: any) {
        console.error('[guardarInsumosTecnicos] trx error', err)
        // Revertir todo borrando actividades o insumos (simple cascade rollback al fallar no soportado
        // en Supabase sin RPC functions, asumiendo best-effort o success completo)
        return { data: null, error: err.message || 'Fallo guardado Insumos/Tecnicos' }
    }
}

// =============================================================================
// PASO EXTRA — Guardado global explícito del borrador
// =============================================================================

const GuardadoGlobalBorradorSchema = z.object({
    reporte_id: z.string().uuid(),
    tipo_mantenimiento_id: z.string().uuid().optional(),
    fecha_inicio: z.string().optional(),
    diagnostico: z.string().optional().nullable(),
    trabajo_realizado: z.string().optional().nullable(),
    estado_equipo_post: z.enum(['operativo', 'restringido', 'no_operativo', 'almacenado', 'dado_de_baja']).optional(),
    hora_entrada: z.string().optional().nullable(),
    hora_salida: z.string().optional().nullable(),
    ciudad: z.string().optional().nullable(),
    solicitado_por: z.string().optional().nullable(),
    motivo_visita: z.string().optional().nullable(),
    numero_reporte_fisico: z.string().optional().nullable(),
    ubicacion_id: z.string().uuid().optional().nullable(),
    ubicacion_detalle: z.string().optional().nullable(),
    tecnicos_apoyo: z.array(z.string()).optional(),
})

export async function guardarBorradorGlobal(
    input: z.infer<typeof GuardadoGlobalBorradorSchema>
): Promise<ActionResult> {
    if (!await requirePermiso(...EDITAR_REPORTES)) return { data: null, error: SIN_PERMISO }

    try {
        const parsed = GuardadoGlobalBorradorSchema.safeParse(input)
        if (!parsed.success) {
            return { data: null, error: 'Datos de guardado global inválidos' }
        }
        const data = parsed.data
        const supabase = createClient()

        const { data: reporte, error: checkErr } = await supabase
            .from('reportes_mantenimiento')
            .select('id, estado_reporte')
            .eq('id', data.reporte_id)
            .eq('activo', true)
            .single()

        if (checkErr || !reporte) {
            return { data: null, error: 'Reporte borrador no encontrado' }
        }

        // Permitimos forzar a borrador o actualizar si ya lo es. Pendientes de firma 
        // seran revertidos a borrador si el tecnico editó algo (reset de ciclo de firmas)
        const updateData: any = {
            estado_reporte: 'en_progreso', // Forzamos siempre a en_progreso al guardar
            updated_at: new Date().toISOString()
        }

        if (data.tipo_mantenimiento_id) updateData.tipo_mantenimiento_id = data.tipo_mantenimiento_id
        if (data.fecha_inicio) updateData.fecha_inicio = data.fecha_inicio
        if (data.diagnostico !== undefined) updateData.diagnostico = data.diagnostico || null
        if (data.trabajo_realizado !== undefined) updateData.trabajo_realizado = data.trabajo_realizado || null
        if (data.estado_equipo_post) updateData.estado_equipo_post = data.estado_equipo_post
        if (data.hora_entrada !== undefined) updateData.hora_entrada = data.hora_entrada || null
        if (data.hora_salida !== undefined) updateData.hora_salida = data.hora_salida || null
        if (data.ciudad !== undefined) updateData.ciudad = data.ciudad || null
        if (data.solicitado_por !== undefined) updateData.solicitado_por = data.solicitado_por || null
        if (data.motivo_visita !== undefined) updateData.motivo_visita = data.motivo_visita || null
        if (data.numero_reporte_fisico !== undefined) updateData.numero_reporte_fisico = data.numero_reporte_fisico || null
        if (data.ubicacion_id !== undefined) updateData.ubicacion_id = data.ubicacion_id || null
        if (data.ubicacion_detalle !== undefined) updateData.ubicacion_detalle = data.ubicacion_detalle || null

        const { error: updErr } = await supabase
            .from('reportes_mantenimiento')
            .update(updateData)
            .eq('id', data.reporte_id)

        if (updErr) {
            console.error('[guardarBorradorGlobal] upd:', updErr)
            return { data: null, error: 'Error al forzar guardado borrador maestro' }
        }

        // ── Técnicos de apoyo (opcional en guardado global)
        if (data.tecnicos_apoyo !== undefined) {
            await supabase
                .from('reporte_tecnicos')
                .delete()
                .eq('reporte_id', data.reporte_id)
                .eq('rol', 'apoyo')

            if (data.tecnicos_apoyo.length > 0) {
                const { error: tecErr } = await supabase.from('reporte_tecnicos').insert(
                    data.tecnicos_apoyo.map((tid) => ({
                        reporte_id: data.reporte_id,
                        tecnico_id: tid,
                        rol: 'apoyo',
                    }))
                )
                if (tecErr) {
                    console.error('[guardarBorradorGlobal] tecs:', tecErr)
                    return { data: null, error: 'Error al guardar técnicos de apoyo' }
                }
            }
        }

        return { data: null, error: null }
    } catch (err) {
        console.error('[guardarBorradorGlobal] err:', err)
        return { data: null, error: 'Error inesperado al grabar borrador maestro' }
    }
}

// =============================================================================
// PASO 4 — Firma del técnico → estado: cerrado
// =============================================================================

const FirmarTecnicoSchema = z.object({
    reporte_id: z.string().uuid(),
    firma_base64: z.string().min(100, 'La firma está vacía'),
    /**
     * Hora en que el técnico terminó, en HH:MM.
     *
     * Se acepta desde fuera porque el servidor no siempre puede saberla. Un
     * reporte hecho sin conexión se sincroniza cuando hay red — puede ser horas
     * o días después—, y sellar aquí la hora del reloj del servidor le ponía al
     * reporte la hora de la sincronización en lugar de la del trabajo. Quien
     * sabe cuándo terminó la visita es el dispositivo que estaba allí.
     *
     * Si no llega, se sella la hora actual: es el caso con conexión, donde
     * firmar y terminar ocurren en el mismo instante.
     */
    hora_salida: z.string().optional().nullable(),
})

/**
 * Invalida las pantallas que muestran el estado de un reporte.
 *
 * Hace falta aunque esas páginas sean 'force-dynamic': eso solo obliga al
 * SERVIDOR a volver a consultar. El router de Next guarda además en el cliente
 * la respuesta de cada ruta visitada, y al volver a ella por navegación interna
 * la sirve de ahí sin preguntar. El síntoma es exactamente el que se ve al
 * firmar: el reporte ya está en 'cerrado' en la base, pero el
 * dashboard lo sigue pintando 'en progreso' hasta que esa copia caduca sola.
 *
 * revalidatePath dentro de una server action limpia las dos cosas, así que la
 * siguiente navegación ya trae el estado nuevo.
 */
async function revalidarVistasDeReporte(reporteId: string) {
    const { revalidatePath } = await import('next/cache')

    revalidatePath('/tecnico/dashboard')
    revalidatePath('/tecnico/mis-reportes')
    revalidatePath(`/tecnico/mis-reportes/${reporteId}`)
    revalidatePath('/admin/reportes')
    revalidatePath(`/admin/reportes/${reporteId}`)
    revalidatePath('/admin/dashboard')
}

export async function firmarComoTecnico(
    input: z.infer<typeof FirmarTecnicoSchema>
): Promise<ActionResult<{ serial: string }>> {
    if (!await requirePermiso(...EDITAR_REPORTES)) return { data: null, error: SIN_PERMISO }

    try {
        const parsed = FirmarTecnicoSchema.safeParse(input)
        if (!parsed.success) {
            return { data: null, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
        }
        const data = parsed.data

        console.log('reporte_id recibido:', data.reporte_id)

        const supabase = createClient()
        const adminSupabase = createAdminClient()

        // Verificar estado correcto
        const { data: reporte } = await supabase
            .from('reportes_mantenimiento')
            .select('id, estado_reporte')
            .eq('id', data.reporte_id)
            .single()

        console.log('estado actual del reporte:', reporte?.estado_reporte)

        if (!reporte) return { data: null, error: 'Reporte no encontrado' }
        if (reporte.estado_reporte !== 'en_progreso') {
            return { data: null, error: 'El reporte no está en estado correcto para firma del técnico' }
        }

        // Generar hash SHA-256 en servidor
        const hashFirma = sha256(data.firma_base64)

        // Subir firma a Supabase Storage
        const firmaBuffer = base64ToBuffer(data.firma_base64)
        const storagePath = `firmas/tecnicos/${data.reporte_id}.png`

        const { error: storageErr } = await adminSupabase.storage
            .from('firmas')
            .upload(storagePath, firmaBuffer, {
                contentType: 'image/png',
                upsert: true,
            })

        if (storageErr) {
            console.error('[firmarComoTecnico] storage', storageErr)
            return { data: null, error: 'Error al subir la firma del técnico' }
        }

        const ahora = new Date()
        // La que trae el dispositivo manda; la del servidor es el respaldo.
        const horaSalida = data.hora_salida || ahora.toTimeString().slice(0, 5) // HH:MM

        // ── ORDEN: primero la firma, después el cierre ──────────────────────
        //
        // Desde la migración 023 el reporte queda 'cerrado' en el mismo UPDATE
        // que hace el RPC, y hay un constraint que prohíbe un cerrado sin firma
        // del técnico. Las dos operaciones son sentencias distintas y cada una
        // se confirma por su cuenta, así que cerrar primero deja un instante con
        // estado 'cerrado' y firma_tecnico NULL — y el constraint lo rechaza:
        //   new row ... violates check constraint
        //   "ck_reporte_cerrado_requiere_firma_tecnico"
        //
        // Escribiendo la firma mientras el reporte sigue 'en_progreso' el
        // constraint ni se evalúa, y cuando el RPC lo cierra ya la encuentra.
        const { data: updatedReportes, error: updErr } = await supabase
            .from('reportes_mantenimiento')
            .update({
                firma_tecnico: storagePath,
                hash_firma_tecnico: hashFirma,
                fecha_firma_tecnico: ahora.toISOString(),
                hora_salida: horaSalida,
            })
            .eq('id', data.reporte_id)
            .eq('estado_reporte', 'en_progreso')
            .select('id')

        if (updErr) {
            console.error('[firmarComoTecnico] update', updErr)
            return { data: null, error: 'Error al registrar la firma del técnico' }
        }

        if (!updatedReportes || updatedReportes.length === 0) {
            return { data: null, error: 'El reporte no está en estado correcto para firma' }
        }

        // Asignar serial y cerrar, de forma atómica, via RPC
        const { data: serial, error: rpcErr } = await supabase.rpc('cerrar_borrador_reporte', {
            p_reporte_id: data.reporte_id
        })

        if (rpcErr) {
            console.error('[firmarComoTecnico] RPC error:', rpcErr)
            return { data: null, error: 'Error al asignar serial del reporte: ' + rpcErr.message }
        }

        await revalidarVistasDeReporte(data.reporte_id)

        return { data: { serial: serial as string }, error: null }
    } catch (err) {
        console.error('[firmarComoTecnico]', err)
        return { data: null, error: 'Error inesperado al procesar la firma del técnico' }
    }
}

// =============================================================================
// PASO 5 — Firma del cliente → estado: cerrado
// =============================================================================

const FirmarClienteSchema = z.object({
    reporte_id: z.string().uuid(),
    firma_base64: z.string().min(100, 'La firma está vacía'),
    nombre_firmante: z.string().min(1, 'El nombre del firmante es requerido'),
})

export async function firmarComoCliente(
    input: z.infer<typeof FirmarClienteSchema>
): Promise<ActionResult> {
    // La firma la traza el cliente, pero siempre en el dispositivo del técnico
    // que llevó el reporte: el permiso exigido es el de quien opera la sesión.
    if (!await requirePermiso(...EDITAR_REPORTES)) return { data: null, error: SIN_PERMISO }

    try {
        const parsed = FirmarClienteSchema.safeParse(input)
        if (!parsed.success) {
            return { data: null, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
        }
        const data = parsed.data

        const supabase = createClient()
        const adminSupabase = createAdminClient()

        // Verificar estado correcto y obtener equipo_id
        const { data: reporte } = await supabase
            .from('reportes_mantenimiento')
            .select('id, estado_reporte, equipo_id')
            .eq('id', data.reporte_id)
            .single()

        if (!reporte) return { data: null, error: 'Reporte no encontrado' }

        // Desde la migración 023 el reporte ya está cerrado cuando el cliente
        // firma: la firma deja constancia de su conformidad, no dispara el
        // cierre. Un reporte anulado o todavía en progreso no admite firma.
        if (reporte.estado_reporte !== 'cerrado') {
            return { data: null, error: 'El reporte no está en estado correcto para firma del cliente' }
        }

        // Generar hash SHA-256 en servidor
        const hashFirma = sha256(data.firma_base64)

        // Subir firma a Supabase Storage
        const firmaBuffer = base64ToBuffer(data.firma_base64)
        const storagePath = `firmas/clientes/${data.reporte_id}.png`

        const { error: storageErr } = await adminSupabase.storage
            .from('firmas')
            .upload(storagePath, firmaBuffer, {
                contentType: 'image/png',
                upsert: true,
            })

        if (storageErr) {
            console.error('[firmarComoCliente] storage', storageErr)
            return { data: null, error: 'Error al subir la firma del cliente' }
        }

        const ahora = new Date().toISOString()

        // Solo se registra la firma. fecha_fin NO se toca: la marcó el cierre,
        // que ya ocurrió al firmar el técnico, y sobrescribirla aquí movería la
        // fecha del trabajo al día en que el cliente pasó a firmar.
        const { data: updatedReportes, error: updErr } = await supabase
            .from('reportes_mantenimiento')
            .update({
                firma_cliente: storagePath,
                hash_firma_cliente: hashFirma,
                fecha_firma_cliente: ahora,
                nombre_cliente_firma: data.nombre_firmante,
                sincronizado: true,
                fecha_sincronizacion: ahora,
            })
            .eq('id', data.reporte_id)
            .eq('estado_reporte', 'cerrado')
            .select('id')

        if (updErr) {
            console.error('[firmarComoCliente] update reporte', updErr)
            return { data: null, error: 'Error al cerrar el reporte' }
        }

        if (!updatedReportes || updatedReportes.length === 0) {
            return { data: null, error: 'El reporte no está en estado correcto para firma del cliente' }
        }

        // UPDATE equipo → fecha_ultimo_mantenimiento
        const { error: eqUpdErr } = await supabase
            .from('equipos')
            .update({ fecha_ultimo_mantenimiento: ahora })
            .eq('id', reporte.equipo_id)

        if (eqUpdErr) {
            // No es crítico — loguear pero no fallar el cierre del reporte
            console.error('[firmarComoCliente] update equipo fecha_ultimo_mantenimiento', eqUpdErr)
        }

        await revalidarVistasDeReporte(data.reporte_id)

        return { data: null, error: null }
    } catch (err) {
        console.error('[firmarComoCliente]', err)
        return { data: null, error: 'Error inesperado al procesar la firma del cliente' }
    }
}

// =============================================================================
// UTILIDAD — Obtener reportes del técnico actual
// =============================================================================

export async function getMisReportes(filtros?: {
    estado?: string
    limit?: number
}): Promise<ActionResult<unknown[]>> {
    if (!await requirePermiso(...VER_REPORTES)) return { data: [], error: SIN_PERMISO }

    try {
        const supabase = createClient()

        // Obtener usuario desde sesión JWT sin consultar auth.users
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return { data: [], error: 'No autenticado' }

        // Obtener tecnico_id del usuario actual
        const { data: tecnico } = await supabase
            .from('tecnicos')
            .select('id')
            .eq('user_id', session.user.id)
            .single()

        if (!tecnico) return { data: [], error: 'Técnico no encontrado' }

        let query = supabase
            .from('reportes_mantenimiento')
            .select(`
                id, estado_reporte, fecha_inicio, fecha_fin,
                numero_reporte_fisico, equipo_id,
                equipo:equipos(codigo_mh, nombre, marca),
                tecnico_principal:tecnicos(nombre, apellido)
            `)
            .eq('tecnico_principal_id', tecnico.id)
            .eq('activo', true)
            .order('created_at', { ascending: false })
            .limit(filtros?.limit ?? 50)

        if (filtros?.estado) {
            query = query.eq('estado_reporte', filtros.estado)
        }

        const { data, error } = await query
        if (error) throw error
        return { data: data ?? [], error: null }
    } catch (err) {
        console.error('[getMisReportes]', err)
        return { data: [], error: 'Error al cargar reportes' }
    }
}

// =============================================================================
// UTILIDAD — Obtener todos los reportes para el panel admin
// =============================================================================

// src/app/actions/reportes.ts

export async function getReportesAdmin(): Promise<ActionResult<ReporteResumen[]>> {
    // Devuelve TODOS los reportes con service_role, saltando RLS: aquí sí se
    // exige el módulo de administración, no vale el permiso del técnico.
    if (!await requirePermiso([MODULO.REPORTES, PERMISO.VER])) {
        return { data: null, error: SIN_PERMISO }
    }

    try {
        const supabase = createAdminClient()

        // ✅ REMOVER el filtro .eq('activo', true)
        const { data, error } = await supabase
            .from('reportes_mantenimiento')
            .select(`
                id, estado_reporte, fecha_inicio, numero_reporte_fisico, 
                equipo_id, tipo_mantenimiento_id, tecnico_principal_id, activo,
                equipo:equipos(codigo_mh, nombre),
                tipo:tipos_mantenimiento(nombre),
                tecnico_principal:tecnicos(id, nombre, apellido)
            `)
            // ❌ ELIMINA o comenta esta línea si existe:
            // .eq('activo', true)
            .order('created_at', { ascending: false })

        if (error) throw error

        // Obtener clientes
        const equipoIds = Array.from(new Set((data ?? []).map((r: any) => r.equipo_id)))
        let clienteMap: Record<string, string> = {}
        if (equipoIds.length > 0) {
            const { data: contratos } = await supabase
                .from('v_equipo_contrato_vigente')
                .select('equipo_id, cliente_nombre')
                .in('equipo_id', equipoIds)
            clienteMap = Object.fromEntries(
                (contratos ?? []).map((c: any) => [c.equipo_id, c.cliente_nombre])
            )
        }

        const reportes: ReporteResumen[] = (data ?? []).map((r: any) => ({
            id: r.id,
            estado_reporte: r.estado_reporte as EstadoReporte,
            fecha_inicio: r.fecha_inicio,
            numero_reporte_fisico: r.numero_reporte_fisico,
            equipo_id: r.equipo_id,
            tipo_mantenimiento_id: r.tipo_mantenimiento_id,
            tecnico_principal_id: r.tecnico_principal_id || (r.tecnico_principal as any)?.id,
            equipo_codigo_mh: r.equipo?.codigo_mh ?? '—',
            equipo_nombre: r.equipo?.nombre ?? '—',
            cliente_nombre: clienteMap[r.equipo_id] ?? '—',
            tipo_nombre: r.tipo?.nombre ?? '—',
            tecnico_nombre: r.tecnico_principal
                ? `${r.tecnico_principal.nombre} ${r.tecnico_principal.apellido}`
                : '—',
            activo: r.activo,  // ← Agregar este campo
        }))

        return { data: reportes, error: null }
    } catch (err) {
        console.error('[getReportesAdmin]', err)
        return { data: [], error: 'Error al cargar reportes' }
    }
}

// =============================================================================
// ANULAR REPORTE — Solo admin, estados en_progreso o cerrado
// =============================================================================

const AnularReporteSchema = z.object({
    reporte_id: z.string().uuid(),
    motivo: z.string().min(10, 'El motivo debe tener al menos 10 caracteres'),
})

export async function anularReporte(
    input: z.infer<typeof AnularReporteSchema>
): Promise<ActionResult> {
    // 'anular' es un permiso propio, distinto de editar: invalida un reporte
    // ya levantado y es competencia de administración, no del técnico.
    if (!await requirePermiso([MODULO.REPORTES, PERMISO.ANULAR])) {
        return { data: null, error: SIN_PERMISO }
    }

    try {
        const parsed = AnularReporteSchema.safeParse(input)
        if (!parsed.success) {
            return { data: null, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
        }
        const { reporte_id, motivo } = parsed.data

        const supabase = createClient()

        const { data: reporte } = await supabase
            .from('reportes_mantenimiento')
            .select('id, estado_reporte, observaciones')
            .eq('id', reporte_id)
            .single()

        if (!reporte) return { data: null, error: 'Reporte no encontrado' }

        // Se admite anular un reporte cerrado. Antes 'cerrado' era el final del
        // recorrido y no se tocaba, pero desde la migración 023 el cierre ocurre
        // en cuanto firma el técnico: dejar fuera ese estado equivaldría a que
        // ningún reporte firmado pudiera corregirse nunca.
        if (reporte.estado_reporte !== 'en_progreso' && reporte.estado_reporte !== 'cerrado') {
            return { data: null, error: 'Solo se pueden anular reportes en progreso o cerrados' }
        }

        const observacionesActualizadas = reporte.observaciones
            ? `[Motivo de anulación]: ${motivo}\n\n---\n${reporte.observaciones}`
            : `[Motivo de anulación]: ${motivo}`

        const { error: updErr } = await supabase
            .from('reportes_mantenimiento')
            .update({
                estado_reporte: 'anulado',
                observaciones: observacionesActualizadas,
            })
            .eq('id', reporte_id)

        if (updErr) {
            console.error('[anularReporte]', updErr)
            return { data: null, error: 'Error al anular el reporte' }
        }

        return { data: null, error: null }
    } catch (err) {
        console.error('[anularReporte]', err)
        return { data: null, error: 'Error inesperado al anular el reporte' }
    }
}

// =============================================================================
// UTILIDAD — Obtener reporte por ID para Vista Técnica / Admin
// =============================================================================

export async function getReporteById(id: string): Promise<ActionResult<any>> {
    if (!await requirePermiso(...VER_REPORTES)) return { data: null, error: SIN_PERMISO }

    try {
        console.log('--- DIAGNOSTICO getReporteById ---')
        console.log('Buscando ID:', id)
        const supabase = createClient()

        const { data: reporte, error } = await supabase
            .from('reportes_mantenimiento')
            .select(`
                *,
                equipo:equipos(id, codigo_mh, nombre, marca, modelo, numero_serie, categoria:categorias_equipo(nombre)),
                tipo:tipos_mantenimiento(nombre),
                tecnico_principal:tecnicos(nombre, apellido, id),
                ubicacion:ubicaciones(nombre)
            `)
            .eq('id', id)
            .eq('activo', true)
            .single()

        console.log('Resultado query principal:', {
            encontrado: !!reporte,
            estado: reporte?.estado_reporte,
            error: error?.message
        })

        if (error || !reporte) {
            console.error('[getReporteById]', error)
            return { data: null, error: 'Error al obtener reporte' }
        }

        // Checklist - Usando nombre real actividades_checklist
        const { data: actividades } = await supabase
            .from('reporte_actividades')
            .select(`
                actividad_id,
                completada,
                observacion,
                catalogo_actividades:actividades_checklist (nombre:descripcion)
            `)
            .eq('reporte_id', id)
            .order('created_at', { ascending: true })

        // Insumos usados - Usando nombre real insumos
        const { data: insumosUsados } = await supabase
            .from('reporte_insumos_usados')
            .select(`
                cantidad,
                observacion,
                insumo: insumos (nombre, codigo_interno:codigo)
            `)
            .eq('reporte_id', id)

        // Insumos requeridos
        const { data: insumosRequeridos } = await supabase
            .from('reporte_insumos_requeridos')
            .select(`
                cantidad,
                urgente,
                observacion,
                insumo: insumos (nombre, codigo_interno:codigo)
            `)
            .eq('reporte_id', id)

        // Cliente vigente: equipo_contratos → contratos → clientes
        const { data: contratoVigente } = await supabase
            .from('equipo_contratos')
            .select(`
                contrato:contratos(
                    cliente:clientes(razon_social)
                )
            `)
            .eq('equipo_id', reporte.equipo_id)
            .is('fecha_retiro', null)
            .maybeSingle()

        // Firmas y Hashs desde la tabla fuente real reportes_mantenimiento
        const { data: srcInfo } = await supabase
            .from('reportes_mantenimiento')
            .select(`
                hash_firma_cliente,
                hash_firma_tecnico,
                nombre_cliente_firma,
                estado_equipo_post
            `)
            .eq('id', id)
            .single()

        console.log('[getReporteById] objeto final estado_equipo_post:', {
            del_reporte: reporte.estado_equipo_post,
            del_srcInfo: (srcInfo as any)?.estado_equipo_post,
        })

        return {
            data: {
                ...reporte,
                // Aplanado para compatibilidad con ReporteDetalleClient.tsx
                equipo_codigo_mh: reporte.equipo?.codigo_mh || '—',
                equipo_nombre: reporte.equipo?.nombre || 'Equipo no definido',
                equipo_marca_snapshot: reporte.equipo_marca_snapshot || reporte.equipo?.marca,
                equipo_modelo_snapshot: reporte.equipo_modelo_snapshot || reporte.equipo?.modelo,
                equipo_serie_snapshot: reporte.equipo_serie_snapshot || reporte.equipo?.numero_serie,
                equipo_categoria: (reporte.equipo as any)?.categoria?.nombre ?? null,
                cliente_nombre: (contratoVigente?.contrato as any)?.cliente?.razon_social ?? null,

                tipo_mantenimiento_nombre: reporte.tipo?.nombre || '(Por definir)',
                ubicacion_nombre: reporte.ubicacion?.nombre || 'No asignada',

                // Mapeo de cliente para firma
                cliente_firma_nombre: reporte.nombre_cliente_firma,

                actividades: actividades || [],
                insumos_usados: insumosUsados || [],
                insumos_requeridos: insumosRequeridos || []
            },
            error: null
        }
    } catch (err) {
        console.error('[getReporteById] unexpected', err)
        return { data: null, error: 'Error inesperado' }
    }
}

/** 
 * Duplicar reporte (Cambio 9)
 * Usa el RPC duplicar_reporte para crear un nuevo borrador en_progreso
 */
export async function duplicarReporteAction(
    reporte_id_original: string,
    nuevo_equipo_id: string
): Promise<ActionResult<{ nuevo_id: string }>> {
    if (!await requirePermiso(...CREAR_REPORTES)) return { data: null, error: SIN_PERMISO }

    try {
        const supabase = createClient()

        // 1. Obtener técnico actual
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { data: null, error: 'Usuario no autenticado' }

        const { data: tecnico } = await supabase
            .from('tecnicos')
            .select('id')
            .eq('user_id', user.id)
            .single()

        if (!tecnico) return { data: null, error: 'Técnico no identificado' }

        // 2. Llamar RPC
        const { data: nuevoId, error } = await supabase.rpc('duplicar_reporte', {
            p_reporte_id_original: reporte_id_original,
            p_nuevo_equipo_id: nuevo_equipo_id,
            p_tecnico_id: tecnico.id
        })

        if (error) {
            console.error('[duplicarReporteAction] RPC error:', error)
            return { data: null, error: 'No se pudo duplicar el reporte: ' + error.message }
        }

        return { data: { nuevo_id: nuevoId }, error: null }
    } catch (err) {
        console.error('[duplicarReporteAction] error:', err)
        return { data: null, error: 'Error inesperado al duplicar el reporte' }
    }
}

// AQUÍ HABÍA UNA SEGUNDA duplicarReporte(). Se eliminó: no la llamaba nadie y
// no podía funcionar. Invocaba la RPC con los parámetros p_reporte_id /
// p_nuevo_equipo_id, que corresponden a otra versión de la función —creada a
// mano, fuera de db/migrations— y no a la que usa la aplicación. La migración
// 025 deja una sola definición de duplicar_reporte, así que esta habría fallado
// siempre. Quien duplica es duplicarReporteAction(), aquí arriba.

/**
 * Reasigna un reporte a un nuevo técnico principal.
 * Solo permitido si el reporte no está cerrado.
 */
export async function reasignarReporte(reporteId: string, nuevoTecnicoId: string): Promise<ActionResult<boolean>> {
    // Cambiar de responsable es una decisión de administración: un técnico no
    // debe poder quitarse un reporte de encima ni asignárselo a otro.
    if (!await requirePermiso([MODULO.REPORTES, PERMISO.EDITAR])) {
        return { data: null, error: SIN_PERMISO }
    }

    try {
        const admin = createAdminClient()

        const { error } = await admin
            .from('reportes_mantenimiento')
            .update({ tecnico_principal_id: nuevoTecnicoId })
            .eq('id', reporteId)
            .neq('estado_reporte', 'cerrado')

        if (error) {
            console.error('[reasignarReporte] error:', error)
            return { data: null, error: 'Error al reasignar el reporte.' }
        }

        return { data: true, error: null }
    } catch (err) {
        console.error('[reasignarReporte]', err)
        return { data: null, error: 'Error inesperado al reasignar.' }
    }
}
