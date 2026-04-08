'use server'

/**
 * src/app/actions/equipos.ts
 * Server Actions para el módulo de Equipos — solo lectura en BLOQUE 2.
 * Crear/asignar equipo a contrato → BLOQUE 3 (transacción crítica).
 */

import { createClient } from '@/lib/supabase/server'
import type { Equipo } from '@/types'

type ActionResult<T> = { data: T | null; error: string | null }

// ─────────────────────────────────────────────────────────────────────────────

export interface EquipoConCliente extends Equipo {
    categoria_nombre: string | null
    cliente_nombre: string | null
    cliente_id: string | null
    contrato_id: string | null
    numero_contrato: string | null
    ubicacion_nombre: string | null
    duplicado?: boolean
}

/**
 * Lista equipos con categoría y cliente actual desde v_equipo_contrato_vigente.
 * También incluye equipos sin contrato vigente (LEFT JOIN).
 */
export async function getEquipos(filtros?: {
    search?: string
    categoria_id?: string
    activo?: boolean
    soloConContrato?: boolean
}): Promise<ActionResult<EquipoConCliente[]>> {
    try {
        const supabase = createClient()

        let query = supabase
            .from('equipos')
            .select(`
                *,
                categoria:categorias_equipo(nombre),
                tipo_mantenimiento:tipos_mantenimiento(nombre)
            `)
            .order('codigo_mh', { ascending: true })

        if (filtros?.activo !== undefined) query = query.eq('activo', filtros.activo)
        if (filtros?.categoria_id && filtros.categoria_id !== 'todos') query = query.eq('categoria_id', filtros.categoria_id)

        if (filtros?.search) {
            query = query.or(`codigo_mh.ilike.%${filtros.search}%,numero_serie.ilike.%${filtros.search}%,activo_fijo.ilike.%${filtros.search}%`)
        }

        const { data: equipos, error: equiposError } = await query
        if (equiposError) throw equiposError

        // Obtener el contrato vigente de cada equipo desde la vista
        const { data: vigentes, error: vigentesError } = await supabase
            .from('v_equipo_contrato_vigente')
            .select('equipo_id, cliente_nombre, cliente_id, contrato_id, numero_contrato, ubicacion_nombre')

        if (vigentesError) throw vigentesError

        const vigentesMap = Object.fromEntries(
            (vigentes ?? []).map((v) => [v.equipo_id, v])
        )

        // Combinar datos de equipos con contrato vigente
        const equiposBase = equipos ?? []

        // Detección de duplicados de serie
        const conteoSeries: Record<string, number> = {}
        equiposBase.forEach(e => {
            if (e.numero_serie) {
                conteoSeries[e.numero_serie] = (conteoSeries[e.numero_serie] || 0) + 1
            }
        })

        let equiposConCliente: EquipoConCliente[] = equiposBase.map((e) => {
            const vigente = vigentesMap[e.id]
            const esDuplicado = e.numero_serie ? conteoSeries[e.numero_serie] > 1 : false

            return {
                ...e,
                categoria_nombre: e.categoria?.nombre ?? null,
                cliente_nombre: vigente?.cliente_nombre ?? null,
                cliente_id: vigente?.cliente_id ?? null,
                contrato_id: vigente?.contrato_id ?? null,
                numero_contrato: vigente?.numero_contrato ?? null,
                ubicacion_nombre: vigente?.ubicacion_nombre ?? null,
                duplicado: esDuplicado,
            }
        })

        // Si se pide solo con contrato, filtramos los que no lo tienen
        if (filtros?.soloConContrato) {
            equiposConCliente = equiposConCliente.filter(e => e.contrato_id !== null)
        }

        return { data: equiposConCliente, error: null }
    } catch (err) {
        console.error('[getEquipos]', err)
        return { data: null, error: 'Error al cargar equipos.' }
    }
}

/**
 * Obtiene el detalle de un equipo con:
 * - Categoría y tipo de mantenimiento
 * - Contrato vigente (desde v_equipo_contrato_vigente)
 * - Historial completo de contratos (desde v_historial_equipo)
 */
export async function getEquipoById(
    id: string
): Promise<ActionResult<EquipoConCliente & { historial_contratos: unknown[], mantenimientos: unknown[], historial_ubicaciones: any[] }>> {
    try {
        const supabase = createClient()

        // 1. Fetch equipo info first to get categoria_id
        const { data: equipoBase, error: eErr } = await supabase
            .from('equipos')
            .select(`
                *,
                categoria:categorias_equipo(id, nombre, descripcion),
                tipo_mantenimiento:tipos_mantenimiento(id, nombre, periodicidad_dias)
            `)
            .eq('id', id)
            .single()

        if (eErr || !equipoBase) throw new Error('Equipo no encontrado.')

        // 2. Fetch all other related data in parallel
        const [vigenteRes, historialRes, mantenimientosRes, resPreventivo, ubicacionesRes, checklistRes] = await Promise.all([
            supabase
                .from('v_equipo_contrato_vigente')
                .select('*')
                .eq('equipo_id', id)
                .maybeSingle(),
            supabase
                .from('equipo_contratos')
                .select(`
                    id,
                    fecha_asignacion,
                    fecha_retiro,
                    observaciones,
                    contrato:contratos(id, numero_contrato, activo),
                    ubicacion:ubicaciones(nombre)
                `)
                .eq('equipo_id', id)
                .order('fecha_asignacion', { ascending: false }),
            supabase
                .from('reportes_mantenimiento')
                .select(`
                    id, estado_reporte, fecha_inicio, fecha_fin, observaciones,
                    tipo:tipos_mantenimiento(nombre),
                    tecnico_principal:tecnicos(nombre, apellido)
                `)
                .eq('equipo_id', id)
                .order('fecha_inicio', { ascending: false })
                .limit(5),
            supabase
                .from('reportes_mantenimiento')
                .select(`fecha_inicio, tipos_mantenimiento!inner(es_planificado)`)
                .eq('equipo_id', id)
                .in('estado_reporte', ['pendiente_firma_cliente', 'cerrado'])
                .eq('tipos_mantenimiento.es_planificado', true)
                .order('fecha_inicio', { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase
                .from('v_historial_ubicaciones_equipo')
                .select('*')
                .eq('equipo_id', id),
            supabase
                .from('actividades_checklist')
                .select('id, descripcion, orden, obligatoria')
                .eq('categoria_id', equipoBase.categoria_id)
                .eq('activa', true)
                .order('orden', { ascending: true })
        ])

        const vigente = vigenteRes.data
        const ultimoPreventivo = resPreventivo.data?.fecha_inicio ?? null
        const historialUbicaciones = ubicacionesRes.data ?? []
        const checklistTemplate = checklistRes.data ?? []

        return {
            data: {
                ...equipoBase,
                categoria_nombre: (equipoBase as any).categoria?.nombre ?? null,
                cliente_nombre: vigente?.cliente_nombre ?? null,
                cliente_id: vigente?.cliente_id ?? null,
                contrato_id: vigente?.contrato_id ?? null,
                numero_contrato: vigente?.numero_contrato ?? null,
                ubicacion_nombre: vigente?.ubicacion_nombre ?? null,
                historial_contratos: historialRes.data ?? [],
                mantenimientos: mantenimientosRes.data ?? [],
                ultimo_preventivo: ultimoPreventivo,
                historial_ubicaciones: historialUbicaciones,
                checklist_template: checklistTemplate,
            },
            error: null,
        }
    } catch (err: any) {
        console.error('[getEquipoById]', err)
        return { data: null, error: err.message || 'Equipo no encontrado.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 3 — MUTACIONES CON VALIDACIÓN
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'

const createEquipoSchema = z.object({
    codigo_mh: z
        .string()
        .min(3, 'Mínimo 3 caracteres')
        .regex(/^MH-/, 'El código debe comenzar con "MH-"'),
    numero_serie: z.string().optional().nullable(),
    activo_fijo: z.string().optional().nullable(),
    nombre: z.string().min(3, 'Mínimo 3 caracteres'),
    marca: z.string().optional().nullable(),
    modelo: z.string().optional().nullable(),
    categoria_id: z.string().uuid('Categoría inválida'),
    tipo_mantenimiento_id: z.string().uuid('Tipo de mantenimiento inválido'),
    fecha_fabricacion: z.string().optional().nullable(),
    observaciones: z.string().optional().nullable(),
    estado_display: z.enum(['activo', 'almacenado', 'baja']).optional().default('activo'),
})

export type CreateEquipoInput = z.infer<typeof createEquipoSchema>

/**
 * Crea un equipo nuevo en la base de datos.
 * Verifica unicidad de codigo_mh y activo_fijo antes del INSERT.
 */
export async function createEquipo(
    raw: CreateEquipoInput
): Promise<ActionResult<Equipo>> {
    try {
        const parsed = createEquipoSchema.safeParse(raw)
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: { message: string }) => e.message).join(', ')
            return { data: null, error: msg }
        }

        const data = parsed.data
        const supabase = createClient()

        // Verificar unicidad de codigo_mh
        const { count: countCod } = await supabase
            .from('equipos')
            .select('id', { count: 'exact', head: true })
            .eq('codigo_mh', data.codigo_mh)
        if ((countCod ?? 0) > 0) {
            return { data: null, error: `El código ${data.codigo_mh} ya está registrado.` }
        }

        // Verificar unicidad de activo_fijo si se provee
        if (data.activo_fijo) {
            const { count: countAF } = await supabase
                .from('equipos')
                .select('id', { count: 'exact', head: true })
                .eq('activo_fijo', data.activo_fijo)
            if ((countAF ?? 0) > 0) {
                return { data: null, error: `El activo fijo ${data.activo_fijo} ya está registrado.` }
            }
        }

        const { data: equipo, error } = await supabase
            .from('equipos')
            .insert({
                codigo_mh: data.codigo_mh,
                numero_serie: data.numero_serie || null,
                activo_fijo: data.activo_fijo || null,
                nombre: data.nombre,
                marca: data.marca || null,
                modelo: data.modelo || null,
                categoria_id: data.categoria_id,
                tipo_mantenimiento_id: data.tipo_mantenimiento_id,
                fecha_fabricacion: data.fecha_fabricacion || null,
                observaciones: data.observaciones || null,
                activo: data.estado_display !== 'baja',
            })
            .select()
            .single()

        if (error) throw error
        return { data: equipo as unknown as Equipo, error: null }
    } catch (err: any) {
        console.error('[createEquipo]', err)
        return { data: null, error: err.message ?? 'Error al crear el equipo.' }
    }
}

const updateEquipoSchema = createEquipoSchema.partial()

/**
 * Actualiza un equipo existente.
 */
export async function updateEquipo(
    id: string,
    raw: Partial<CreateEquipoInput>
): Promise<ActionResult<Equipo>> {
    try {
        const parsed = updateEquipoSchema.safeParse(raw)
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: { message: string }) => e.message).join(', ')
            return { data: null, error: msg }
        }

        const data = parsed.data
        const supabase = createClient()

        const { data: equipo, error } = await supabase
            .from('equipos')
            .update({
                ...(data.codigo_mh && { codigo_mh: data.codigo_mh }),
                ...(data.nombre && { nombre: data.nombre }),
                ...(data.categoria_id && { categoria_id: data.categoria_id }),
                ...(data.tipo_mantenimiento_id && { tipo_mantenimiento_id: data.tipo_mantenimiento_id }),
                numero_serie: data.numero_serie ?? null,
                activo_fijo: data.activo_fijo ?? null,
                marca: data.marca ?? null,
                modelo: data.modelo ?? null,
                fecha_fabricacion: data.fecha_fabricacion ?? null,
                observaciones: data.observaciones ?? null,
                activo: data.estado_display !== 'baja',
            })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return { data: equipo as unknown as Equipo, error: null }
    } catch (err: any) {
        console.error('[updateEquipo]', err)
        return { data: null, error: err.message ?? 'Error al actualizar el equipo.' }
    }
}

const asignarSchema = z.object({
    equipo_id: z.string().uuid(),
    contrato_id: z.string().uuid('Contrato inválido'),
    ubicacion_id: z.string().uuid().optional().nullable(),
    fecha_asignacion: z.string().min(1, 'Fecha requerida'),
})

export type AsignarEquipoInput = z.infer<typeof asignarSchema>

/**
 * Asigna (o reasigna) un equipo a un contrato.
 * TRANSACCIÓN CRÍTICA — usa RPC reasignar_equipo_contrato para atomicidad.
 * Antes de asignar valida que el contrato exista y esté activo.
 */
export async function asignarEquipoAContrato(
    raw: AsignarEquipoInput
): Promise<ActionResult<{ equipo_id: string; contrato_id: string }>> {
    try {
        const parsed = asignarSchema.safeParse(raw)
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: { message: string }) => e.message).join(', ')
            return { data: null, error: msg }
        }

        const { equipo_id, contrato_id, ubicacion_id, fecha_asignacion } = parsed.data
        const supabase = createClient()

        // 1. Verificar que el contrato existe y está activo
        const { data: contrato, error: cError } = await supabase
            .from('contratos')
            .select('id, activo')
            .eq('id', contrato_id)
            .single()
        if (cError || !contrato) return { data: null, error: 'El contrato no existe.' }
        if (!contrato.activo) return { data: null, error: 'El contrato seleccionado no está activo.' }

        // 2. Verificar que el equipo existe
        const { data: equipo, error: eError } = await supabase
            .from('equipos')
            .select('id')
            .eq('id', equipo_id)
            .single()
        if (eError || !equipo) return { data: null, error: 'El equipo no existe.' }

        // 3. TRANSACCIÓN ATÓMICA vía RPC
        const { error: rpcError } = await supabase.rpc('reasignar_equipo_contrato', {
            p_equipo_id: equipo_id,
            p_contrato_id: contrato_id,
            p_ubicacion_id: ubicacion_id ?? null,
            p_fecha_asignacion: fecha_asignacion,
        })
        if (rpcError) throw rpcError

        return { data: { equipo_id, contrato_id }, error: null }
    } catch (err: any) {
        console.error('[asignarEquipoAContrato]', err)
        return { data: null, error: err.message ?? 'Error al asignar el equipo al contrato.' }
    }
}

/**
 * Importa equipos desde un CSV procesado.
 * BLOQUE 4 — Carga masiva con asignación automática a contrato.
 *
 * Cada fila se procesa mediante la RPC `importar_equipo_con_contrato` que
 * garantiza atomicidad: si la inserción del equipo o la asignación al contrato
 * fallan, se hace rollback completo (no quedan equipos huérfanos).
 *
 * @param rows  - Filas del CSV parseadas por PapaParse
 * @param modo  - 'insert': falla si codigo_mh ya existe (default)
 *               'upsert': actualiza equipo + reasigna contrato si ya existe
 */
export async function importarEquiposDesdeCSV(
    rows: any[],
    modo: 'insert' | 'upsert' = 'insert'
): Promise<{
    insertados: number
    fallidos: number
    detalles: { row: number; error: string; codigo_mh?: string }[]
}> {
    const supabase = createClient()
    let insertados = 0
    let fallidos = 0
    const detalles: { row: number; error: string; codigo_mh?: string }[] = []

    // Normaliza texto para comparaciones insensibles a mayúsculas/tildes
    const norm = (t: string) =>
        t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

    // 1. Precargar catálogos en paralelo para resolución de IDs
    const [catRes, tipoRes, contratoRes, ubicacionRes] = await Promise.all([
        supabase.from('categorias_equipo').select('id, nombre'),
        supabase.from('tipos_mantenimiento').select('id, nombre'),
        supabase.from('contratos').select('id, numero_contrato, cliente_id, activo'),
        supabase.from('ubicaciones').select('id, nombre, cliente_id'),
    ])

    // Mapas para resolución O(1)
    const catMap = Object.fromEntries(
        (catRes.data ?? []).map((c) => [norm(c.nombre), c.id])
    )
    const tipoMap = Object.fromEntries(
        (tipoRes.data ?? []).map((t) => [norm(t.nombre), t.id])
    )
    // Contrato: número_contrato → { id, cliente_id, activo }
    const contratoMap = Object.fromEntries(
        (contratoRes.data ?? []).map((c) => [
            norm(c.numero_contrato),
            { id: c.id, cliente_id: c.cliente_id, activo: c.activo },
        ])
    )
    // Ubicación: "cliente_id:nombre_normalizado" → id (garantiza pertenencia al cliente)
    const ubicacionMap = Object.fromEntries(
        (ubicacionRes.data ?? []).map((u) => [
            `${u.cliente_id}:${norm(u.nombre)}`,
            u.id,
        ])
    )

    // 2. Procesar fila a fila
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const codigoMh = (row.codigo_mh ?? '').trim()
        const nombre = (row.nombre ?? '').trim()
        const categoria = (row.categoria ?? '').trim()
        const tipoMant = (row.tipo_mantenimiento ?? '').trim()
        const numeroContrato = (row.numero_contrato ?? '').trim()
        const ubicacionNombre = (row.ubicacion ?? '').trim()

        // ── Validar campos obligatorios ───────────────────────────────────
        if (!codigoMh || !nombre || !categoria || !tipoMant) {
            fallidos++
            detalles.push({
                row: i + 1,
                error: 'Faltan campos obligatorios (codigo_mh, nombre, categoria, tipo_mantenimiento)',
                codigo_mh: codigoMh || undefined,
            })
            continue
        }

        if (!numeroContrato) {
            fallidos++
            detalles.push({
                row: i + 1,
                error: 'Todo equipo debe estar asociado a un contrato. Especifica numero_contrato.',
                codigo_mh: codigoMh,
            })
            continue
        }

        // ── Resolver IDs de catálogos ─────────────────────────────────────
        const catId = catMap[norm(categoria)]
        const tipoId = tipoMap[norm(tipoMant)]

        if (!catId) {
            fallidos++
            detalles.push({ row: i + 1, error: `Categoría "${categoria}" no existe`, codigo_mh: codigoMh })
            continue
        }
        if (!tipoId) {
            fallidos++
            detalles.push({ row: i + 1, error: `Tipo de mantenimiento "${tipoMant}" no existe`, codigo_mh: codigoMh })
            continue
        }

        // ── Validar contrato ──────────────────────────────────────────────
        const contrato = contratoMap[norm(numeroContrato)]
        if (!contrato) {
            fallidos++
            detalles.push({ row: i + 1, error: `Contrato "${numeroContrato}" no existe`, codigo_mh: codigoMh })
            continue
        }
        if (!contrato.activo) {
            fallidos++
            detalles.push({ row: i + 1, error: `Contrato "${numeroContrato}" está inactivo`, codigo_mh: codigoMh })
            continue
        }

        // ── Validar ubicación (si se provee) ──────────────────────────────
        let ubicacionId: string | null = null
        if (ubicacionNombre) {
            const key = `${contrato.cliente_id}:${norm(ubicacionNombre)}`
            ubicacionId = ubicacionMap[key] ?? null
            if (!ubicacionId) {
                fallidos++
                detalles.push({
                    row: i + 1,
                    error: `Ubicación "${ubicacionNombre}" no existe o no pertenece al cliente de este contrato`,
                    codigo_mh: codigoMh,
                })
                continue
            }
        }

        // ── Llamar RPC transaccional ──────────────────────────────────────
        try {
            const { error: rpcError } = await supabase.rpc('importar_equipo_con_contrato', {
                p_codigo_mh: codigoMh,
                p_nombre: nombre,
                p_marca: (row.marca ?? '').trim() || null,
                p_modelo: (row.modelo ?? '').trim() || null,
                p_numero_serie: (row.numero_serie ?? '').trim() || null,
                p_activo_fijo: (row.activo_fijo ?? '').trim() || null,
                p_categoria_id: catId,
                p_tipo_mantenimiento_id: tipoId,
                p_fecha_fabricacion: (row.fecha_fabricacion ?? '').trim() || null,
                p_observaciones: (row.observaciones ?? '').trim() || null,
                p_contrato_id: contrato.id,
                p_ubicacion_id: ubicacionId,
                p_modo: modo,
            })

            if (rpcError) {
                fallidos++
                // Mensaje legible para errores comunes de la RPC
                let msg = rpcError.message
                if (msg.includes('duplicate key') || rpcError.code === '23505') {
                    msg = 'Código MH ya existe'
                } else if (msg.includes('Contrato no existe')) {
                    msg = `Contrato "${numeroContrato}" no existe`
                } else if (msg.includes('Contrato inactivo')) {
                    msg = `Contrato "${numeroContrato}" está inactivo`
                }
                detalles.push({ row: i + 1, error: msg, codigo_mh: codigoMh })
            } else {
                insertados++
            }
        } catch (err: any) {
            fallidos++
            detalles.push({
                row: i + 1,
                error: err.message || 'Error inesperado en el servidor',
                codigo_mh: codigoMh,
            })
        }
    }

    return { insertados, fallidos, detalles }
}
