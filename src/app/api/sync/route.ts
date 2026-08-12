import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
    createBorradorReporte,
    guardarDetalleReporte,
    guardarInsumosTecnicos,
} from '@/app/actions/reportes'

// ─── Schema de validación ─────────────────────────────────────────────────────

const ActividadSchema = z.object({
    actividad_id: z.string().uuid(),
    completada: z.boolean(),
    observacion: z.string().nullable().optional(),
})

const InsumoUsadoSchema = z.object({
    insumo_id: z.string().uuid(),
    cantidad: z.number().positive(),
    observacion: z.string().nullable().optional(),
})

const InsumoReqSchema = z.object({
    insumo_id: z.string().uuid(),
    cantidad: z.number().positive(),
    urgente: z.boolean().optional(),
    observacion: z.string().nullable().optional(),
})

const AccesorioSchema = z.object({
    descripcion: z.string().min(1),
    cantidad: z.number().positive(),
})

const SyncReporteSchema = z.object({
    id: z.string(),
    equipo_id: z.string().uuid('equipo_id inválido'),
    tecnico_principal_id: z.string().uuid('tecnico_principal_id inválido'),
    tipo_mantenimiento_id: z.string().uuid('tipo_mantenimiento_id inválido'),
    fecha_inicio: z.string().min(1, 'fecha_inicio requerida'),
    hora_entrada: z.string().nullable().optional(),
    hora_salida: z.string().nullable().optional(),
    ciudad: z.string().nullable().optional(),
    solicitado_por: z.string().nullable().optional(),
    // El wizard exige la ubicación, así que un reporte offline sin ella era un
    // dato perdido por el camino, no una elección del técnico.
    ubicacion_id: z.string().uuid().nullable().optional(),
    ubicacion_detalle: z.string().nullable().optional(),
    motivo_visita: z.string().nullable().optional(),
    numero_reporte_fisico: z.string().nullable().optional(),
    dispositivo_origen: z.string().nullable().optional(),
    diagnostico: z.string().nullable().optional(),
    trabajo_realizado: z.string().nullable().optional(),
    estado_equipo_post: z
        .enum(['operativo', 'restringido', 'no_operativo', 'almacenado', 'dado_de_baja'])
        .nullable()
        .optional(),
    actividades: z.array(ActividadSchema).default([]),
    insumos_usados: z.array(InsumoUsadoSchema).default([]),
    insumos_requeridos: z.array(InsumoReqSchema).default([]),
    accesorios: z.array(AccesorioSchema).default([]),
    tecnicos_apoyo: z.array(z.string().uuid()).default([]),
    firma_base64: z.string().nullable().optional(),
    firma_cliente_base64: z.string().nullable().optional(),
    nombre_firmante: z.string().nullable().optional(),
    reporte_server_id: z.string().uuid().nullable().optional(),
})

// ─── POST /api/sync ───────────────────────────────────────────────────────────

/**
 * Recibe un reporte creado offline y lo persiste en Supabase.
 *
 * Responde { data: { id }, error: null } con el ID real asignado.
 * En conflicto responde con error descriptivo — nunca crea silenciosamente.
 *
 * SOBRE EL ID EN LAS RESPUESTAS DE ERROR
 *   Cuando algo falla DESPUÉS de haber creado el reporte, la respuesta lleva el
 *   error y además el id del servidor. Parece contradictorio devolver las dos
 *   cosas, y es justo lo que faltaba: el reporte existe, así que el reintento
 *   tiene que actualizarlo, no crearlo otra vez. Antes el cliente solo veía el
 *   error, perdía el id y volvía a empezar de cero — un reporte nuevo por cada
 *   intento, y un número de serie quemado por cada uno.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const parsed = SyncReporteSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { data: null, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
                { status: 400 },
            )
        }

        const reporte = parsed.data
        const supabase = createClient()

        // ── Verificar sesión activa ────────────────────────────────────────────
        // getUser() y no getSession(): el segundo se fía de la cookie tal cual,
        // el primero valida el JWT contra el servidor de Auth. En un endpoint
        // que escribe reportes, la diferencia importa.
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json(
                { data: null, error: 'Sesión no válida — vuelve a iniciar sesión' },
                { status: 401 },
            )
        }

        // ── Detectar conflicto: equipo con reporte abierto de otro técnico ─────
        // limit(1) y no maybeSingle(): maybeSingle devuelve ERROR si hay más de
        // una fila, y con el error la comprobación se saltaba entera. O sea que
        // la protección se apagaba sola justo cuando había más de un conflicto,
        // que es cuando más falta hace.
        const { data: conflictos } = await supabase
            .from('reportes_mantenimiento')
            .select('id, tecnico_principal_id')
            .eq('equipo_id', reporte.equipo_id)
            .eq('estado_reporte', 'en_progreso')
            .eq('activo', true)
            .neq('tecnico_principal_id', reporte.tecnico_principal_id)
            .limit(1)

        const conflicto = conflictos?.[0]

        if (conflicto) {
            return NextResponse.json(
                {
                    data: null,
                    error: 'El equipo ya tiene un reporte en progreso asignado a otro técnico',
                },
                { status: 409 },
            )
        }

        // ── PASO 1: Crear o actualizar borrador ─────────────────────────────────────────────
        //
        // Si el dispositivo no trae id de servidor, todavía puede ser un
        // reintento: el envío anterior pudo crear el reporte y perder la
        // respuesta. Se busca por el id local antes de decidir, que es
        // exactamente para lo que existe el índice de la migración 024.
        let reporte_id = reporte.reporte_server_id ?? null

        if (!reporte_id) {
            const { data: yaSubido } = await supabase
                .from('reportes_mantenimiento')
                .select('id')
                .eq('id_local', reporte.id)
                .maybeSingle()

            if (yaSubido) reporte_id = yaSubido.id
        }

        if (reporte_id) {
            const { actualizarBorradorReporte } = await import('@/app/actions/reportes')
            const borradorRes = await actualizarBorradorReporte(reporte_id, {
                equipo_id: reporte.equipo_id,
                tecnico_principal_id: reporte.tecnico_principal_id,
                tipo_mantenimiento_id: reporte.tipo_mantenimiento_id,
                fecha_inicio: reporte.fecha_inicio,
                hora_entrada: reporte.hora_entrada ?? null,
                ciudad: reporte.ciudad ?? null,
                solicitado_por: reporte.solicitado_por ?? null,
                motivo_visita: reporte.motivo_visita ?? null,
                ubicacion_id: reporte.ubicacion_id ?? null,
                ubicacion_detalle: reporte.ubicacion_detalle ?? null,
                numero_reporte_fisico: reporte.numero_reporte_fisico ?? null,
                dispositivo_origen: reporte.dispositivo_origen ?? 'web',
            })

            if (borradorRes.error || !borradorRes.data) {
                return NextResponse.json(
                    { data: null, error: borradorRes.error ?? 'Error al actualizar el borrador' },
                    { status: 422 },
                )
            }
        } else {
            const borradorRes = await createBorradorReporte({
                equipo_id: reporte.equipo_id,
                tecnico_principal_id: reporte.tecnico_principal_id,
                tipo_mantenimiento_id: reporte.tipo_mantenimiento_id,
                fecha_inicio: reporte.fecha_inicio,
                hora_entrada: reporte.hora_entrada ?? null,
                ciudad: reporte.ciudad ?? null,
                solicitado_por: reporte.solicitado_por ?? null,
                motivo_visita: reporte.motivo_visita ?? null,
                ubicacion_id: reporte.ubicacion_id ?? null,
                ubicacion_detalle: reporte.ubicacion_detalle ?? null,
                numero_reporte_fisico: reporte.numero_reporte_fisico ?? null,
                dispositivo_origen: reporte.dispositivo_origen ?? 'web',
                id_local: reporte.id,
            })

            if (borradorRes.error || !borradorRes.data) {
                return NextResponse.json(
                    { data: null, error: borradorRes.error ?? 'Error al crear el borrador' },
                    { status: 422 },
                )
            }
            reporte_id = borradorRes.data.id
        }

        // El reporte ya existe en la base a partir de aquí. Cualquier error que
        // venga después viaja CON su id, para que el reintento actualice este
        // reporte en vez de crear otro.
        const fallo = (error: string, status = 422) =>
            NextResponse.json({ data: { id: reporte_id }, error }, { status })

        // ── PASO 2: Guardar detalle (solo si estado_equipo_post está presente) ─
        if (reporte.estado_equipo_post) {
            const detalleRes = await guardarDetalleReporte({
                reporte_id,
                diagnostico: reporte.diagnostico ?? null,
                trabajo_realizado: reporte.trabajo_realizado ?? null,
                observaciones: null,
                hora_salida: reporte.hora_salida ?? null,
                estado_equipo_post: reporte.estado_equipo_post,
                actividades: reporte.actividades,
            })

            // Ya NO se revierte con activo:false. Antes tenía sentido porque el
            // reintento creaba un reporte nuevo y este quedaba huérfano; ahora el
            // reintento vuelve sobre este mismo id, y desactivarlo lo dejaría
            // invisible para siempre — actualizarBorradorReporte no filtra por
            // activo, así que lo seguiría escribiendo sin que nadie lo viera.
            if (detalleRes.error) return fallo(detalleRes.error)
        } else if (reporte.hora_salida) {
            // La hora de salida vive en reportes_mantenimiento pero solo la
            // escribía guardarDetalleReporte, que exige estado_equipo_post. Un
            // reporte sincronizado sin ese campo perdía la hora en silencio.
            await supabase
                .from('reportes_mantenimiento')
                .update({ hora_salida: reporte.hora_salida })
                .eq('id', reporte_id)
        }

        // ── PASO 3: Guardar insumos, accesorios y técnicos de apoyo ──────────
        const hayInsumos =
            reporte.insumos_usados.length > 0 ||
            reporte.insumos_requeridos.length > 0 ||
            reporte.accesorios.length > 0 ||
            reporte.tecnicos_apoyo.length > 0

        if (hayInsumos) {
            const insumosRes = await guardarInsumosTecnicos({
                reporte_id,
                insumos_usados: reporte.insumos_usados,
                insumos_requeridos: reporte.insumos_requeridos.map(i => ({
                    ...i,
                    urgente: i.urgente ?? false,
                })),
                accesorios: reporte.accesorios,
                tecnicos_apoyo: reporte.tecnicos_apoyo.map(id => ({ tecnico_id: id })),
            })

            if (insumosRes.error) return fallo(insumosRes.error)
        }

        // ── PASO 4: Aplicar firma de técnico y cliente ────────────────────────────────────────
        if (reporte.firma_base64) {
            const { firmarComoTecnico, firmarComoCliente } = await import('@/app/actions/reportes')

            // Un reintento puede encontrarse el reporte ya cerrado: el intento
            // anterior llegó hasta el final y solo se perdió la respuesta.
            // Volver a firmar fallaría —firmarComoTecnico exige 'en_progreso'—
            // y, peor, cerrar_borrador_reporte consume un número de serie ANTES
            // de comprobar si procede, y PostgreSQL no revierte las secuencias.
            // Cada reintento sobre un reporte ya cerrado quemaba un RPT-.
            const { data: estadoActual } = await supabase
                .from('reportes_mantenimiento')
                .select('estado_reporte')
                .eq('id', reporte_id)
                .maybeSingle()

            if (estadoActual?.estado_reporte === 'cerrado') {
                return NextResponse.json(
                    { data: { id: reporte_id, yaExistia: true }, error: null },
                    { status: 200 },
                )
            }

            const firmaTecnicoRes = await firmarComoTecnico({
                reporte_id,
                firma_base64: reporte.firma_base64,
                // La hora real de la visita, no la de esta sincronización.
                hora_salida: reporte.hora_salida ?? null,
            })

            if (firmaTecnicoRes.error) return fallo(firmaTecnicoRes.error)

            if (reporte.firma_cliente_base64) {
                const firmaClienteRes = await firmarComoCliente({
                    reporte_id,
                    firma_base64: reporte.firma_cliente_base64,
                    nombre_firmante: reporte.nombre_firmante || 'Cliente',
                })

                if (firmaClienteRes.error) return fallo(firmaClienteRes.error)
            }
        }

        return NextResponse.json({ data: { id: reporte_id }, error: null }, { status: 201 })

    } catch (err: any) {
        console.error('[/api/sync]', err)
        return NextResponse.json(
            { data: null, error: 'Error inesperado al sincronizar el reporte' },
            { status: 500 },
        )
    }
}
