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
 * Responde { data: { id }, error: null } con el ID real asignado.
 * En conflicto responde con error descriptivo — nunca crea silenciosamente.
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
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            return NextResponse.json(
                { data: null, error: 'Sesión no válida — vuelve a iniciar sesión' },
                { status: 401 },
            )
        }

        // ── Detectar conflicto: equipo con reporte abierto de otro técnico ─────
        const { data: conflicto } = await supabase
            .from('reportes_mantenimiento')
            .select('id, tecnico_principal_id')
            .eq('equipo_id', reporte.equipo_id)
            .eq('estado_reporte', 'en_progreso')
            .eq('activo', true)
            .neq('tecnico_principal_id', reporte.tecnico_principal_id)
            .maybeSingle()

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
        let reporte_id = reporte.reporte_server_id
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
                numero_reporte_fisico: reporte.numero_reporte_fisico ?? null,
                dispositivo_origen: reporte.dispositivo_origen ?? 'web',
            })

            if (borradorRes.error || !borradorRes.data) {
                return NextResponse.json(
                    { data: null, error: borradorRes.error ?? 'Error al crear el borrador' },
                    { status: 422 },
                )
            }
            reporte_id = borradorRes.data.id
        }

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

            if (detalleRes.error) {
                // Revertir borrador creado antes de retornar el error
                await supabase
                    .from('reportes_mantenimiento')
                    .update({ activo: false })
                    .eq('id', reporte_id)

                return NextResponse.json(
                    { data: null, error: detalleRes.error },
                    { status: 422 },
                )
            }
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

            if (insumosRes.error) {
                await supabase
                    .from('reportes_mantenimiento')
                    .update({ activo: false })
                    .eq('id', reporte_id)

                return NextResponse.json(
                    { data: null, error: insumosRes.error },
                    { status: 422 },
                )
            }
        }

        // ── PASO 4: Aplicar firma de técnico y cliente ────────────────────────────────────────
        if (reporte.firma_base64) {
            const { firmarComoTecnico, firmarComoCliente } = await import('@/app/actions/reportes')
            
            const firmaTecnicoRes = await firmarComoTecnico({
                reporte_id,
                firma_base64: reporte.firma_base64,
            })

            if (firmaTecnicoRes.error) {
                return NextResponse.json(
                    { data: null, error: firmaTecnicoRes.error },
                    { status: 422 },
                )
            }

            if (reporte.firma_cliente_base64) {
                const firmaClienteRes = await firmarComoCliente({
                    reporte_id,
                    firma_base64: reporte.firma_cliente_base64,
                    nombre_firmante: reporte.nombre_firmante || 'Cliente',
                })

                if (firmaClienteRes.error) {
                    return NextResponse.json(
                        { data: null, error: firmaClienteRes.error },
                        { status: 422 },
                    )
                }
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
