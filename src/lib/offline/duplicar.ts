/**
 * src/lib/offline/duplicar.ts
 *
 * Duplica un reporte sin conexión, replicando la RPC `duplicar_reporte`.
 *
 * POR QUÉ EXISTE UNA SEGUNDA IMPLEMENTACIÓN
 *   Duplicar es hoy una función SECURITY DEFINER en Postgres (migración 005).
 *   En campo, que es donde el técnico realmente duplica —mismo mantenimiento
 *   sobre varios equipos iguales de una sala—, no hay servidor al que llamar.
 *   La alternativa sería bloquear el botón sin red, que es justo el escenario
 *   en que más se usa.
 *
 * LAS REGLAS DEBEN COINCIDIR CON LA RPC
 *   Un borrador creado aquí termina sincronizándose como reporte nuevo, así que
 *   si las dos versiones divergen el resultado depende de si había señal — un
 *   error imposible de diagnosticar después. Lo que la RPC hace:
 *
 *     hereda    tipo, ciudad, solicitante, motivo, diagnóstico, trabajo
 *               realizado y estado del equipo
 *     reinicia  fecha (hoy), HORAS, estado ('en_progreso'), firmas y número de
 *               reporte físico — el serial no se hereda nunca
 *     copia     checklist, insumos usados e insumos requeridos
 *     NO copia  accesorios ni técnicos de apoyo
 *
 *   Cualquier cambio en db/migrations/005_duplicar_reporte_rpc.sql tiene que
 *   reflejarse aquí.
 */

import {
    getReporteDeCache,
    guardarReporteBorrador,
    agregarASyncQueue,
    generarIdLocal,
    type ReporteBorrador,
} from './db'

/** Fecha de hoy en ISO corto, igual que el CURRENT_DATE de la RPC. */
function hoy(): string {
    return new Date().toISOString().split('T')[0]
}

/** Hora local en HH:MM, el mismo formato que usa el wizard. */
function horaAhora(): string {
    return new Date().toTimeString().slice(0, 5)
}

/**
 * Crea un borrador local a partir de un reporte cacheado.
 *
 * @param reporteOriginalId - id del reporte ya sincronizado que se copia.
 * @param nuevoEquipoId     - equipo al que se aplica la copia.
 * @param tecnicoId         - tecnicos.id del técnico en sesión.
 * @returns El id local del borrador nuevo.
 * @throws Si el reporte original no está en el dispositivo.
 */
export async function duplicarReporteOffline(
    reporteOriginalId: string,
    nuevoEquipoId: string,
    tecnicoId: string,
): Promise<string> {
    const entrada = await getReporteDeCache(reporteOriginalId)

    if (!entrada) {
        throw new Error(
            'El reporte original no está disponible sin conexión. Ábrelo con señal para descargarlo.',
        )
    }

    const original = entrada.datos
    const ahora = new Date().toISOString()
    const id = generarIdLocal()

    const borrador: ReporteBorrador = {
        id,
        equipo_id: nuevoEquipoId,
        tecnico_principal_id: tecnicoId,

        // ── Heredado del original ────────────────────────────────────────────
        tipo_mantenimiento_id: original.tipo_mantenimiento_id ?? '',
        ciudad:                original.ciudad ?? null,
        solicitado_por:        original.solicitado_por ?? null,
        motivo_visita:         original.motivo_visita ?? null,
        diagnostico:           original.diagnostico ?? null,
        trabajo_realizado:     original.trabajo_realizado ?? null,
        estado_equipo_post:    original.estado_equipo_post ?? null,

        // ── Reiniciado ───────────────────────────────────────────────────────
        // La fecha es la de hoy y no la del original: el trabajo se está
        // haciendo ahora. El número de reporte físico y las firmas se dejan
        // vacíos a propósito — son propios de cada visita y arrastrarlos
        // convertiría la copia en un duplicado también a efectos legales.
        //
        // Las horas siguen la misma lógica y antes no lo hacían: la copia
        // llegaba con la hora de entrada de la visita original, que podía ser de
        // hace semanas. Un duplicado es una visita nueva, así que entra ahora y
        // todavía no ha salido. La hora de salida se sella al firmar.
        fecha_inicio:          hoy(),
        hora_entrada:          horaAhora(),
        hora_salida:           null,
        numero_reporte_fisico: null,
        firma_base64:          null,
        firma_cliente_base64:  null,
        nombre_firmante:       null,

        // ── Colecciones copiadas ─────────────────────────────────────────────
        actividades: (original.checklist ?? []).map((a: { actividad_id: string; completada: boolean; observacion?: string | null }) => ({
            actividad_id: a.actividad_id,
            completada:   a.completada ?? false,
            observacion:  a.observacion ?? null,
        })),
        insumos_usados: (original.insumos_usados ?? []).map((i: { insumo_id: string; cantidad: number; observacion?: string | null }) => ({
            insumo_id:   i.insumo_id,
            cantidad:    i.cantidad,
            observacion: i.observacion ?? null,
        })),
        insumos_requeridos: (original.insumos_requeridos ?? []).map((i: { insumo_id: string; cantidad: number; urgente?: boolean; observacion?: string | null }) => ({
            insumo_id:   i.insumo_id,
            cantidad:    i.cantidad,
            urgente:     i.urgente ?? false,
            observacion: i.observacion ?? null,
        })),

        // ── Colecciones que la RPC NO copia ──────────────────────────────────
        accesorios:     [],
        tecnicos_apoyo: [],

        // ── Metadatos locales ────────────────────────────────────────────────
        // Nace como borrador y no como pendiente de sincronizar: todavía le
        // falta la firma. Solo entra en la cola cuando el técnico lo cierra.
        dispositivo_origen: 'web',
        reporte_server_id:  null,
        estado:             'borrador_local',
        motivo_error:       null,
        created_at:         ahora,
        updated_at:         ahora,
    }

    await guardarReporteBorrador(borrador)

    return id
}

/**
 * Marca un borrador local como listo para subir.
 * Se llama al firmar, no al duplicar.
 */
export async function encolarBorrador(idLocal: string): Promise<void> {
    await agregarASyncQueue(idLocal)
}
