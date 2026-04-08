import { getReportesPendientes, marcarReporteSincronizado } from './db'
import { createBorradorReporte, guardarDetalleReporte, guardarInsumosTecnicos } from '@/app/actions/reportes'
import { createClient } from '@/lib/supabase/client'

export async function sincronizarReportesPendientes() {
    const pendientes = await getReportesPendientes()
    if (pendientes.length === 0) return { sincronizados: 0, errores: 0 }

    let sincronizados = 0
    let errores = 0

    const supabase = createClient()

    for (const reporte of pendientes) {
        try {
            // 1. Intentar crear el borrador en Supabase
            const resultado = await createBorradorReporte({
                equipo_id: reporte.equipo_id,
                tecnico_principal_id: reporte.tecnico_principal_id,
                tipo_mantenimiento_id: reporte.tipo_mantenimiento_id,
                dispositivo_origen: reporte.dispositivo_origen || 'web',
                fecha_inicio: reporte.fecha_inicio,
                hora_entrada: reporte.hora_entrada,
                ciudad: reporte.ciudad,
                solicitado_por: reporte.solicitado_por,
                motivo_visita: reporte.motivo_visita,
                numero_reporte_fisico: reporte.numero_reporte_fisico,
            })

            if (resultado.error) throw new Error(resultado.error)

            const reporte_id = resultado.data!.id

            // 2. Guardar detalle
            const detalleRes = await guardarDetalleReporte({
                reporte_id,
                diagnostico: reporte.diagnostico || null,
                trabajo_realizado: reporte.trabajo_realizado || null,
                observaciones: null,
                hora_salida: reporte.hora_salida || null,
                estado_equipo_post: reporte.estado_equipo_post as any,
                actividades: reporte.actividades,
            })

            if (detalleRes.error) throw new Error(detalleRes.error)

            // 3. Guardar insumos si existen
            if (reporte.insumos_usados.length > 0 ||
                reporte.insumos_requeridos.length > 0 ||
                reporte.accesorios.length > 0 ||
                reporte.tecnicos_apoyo.length > 0) {

                const insumosRes = await guardarInsumosTecnicos({
                    reporte_id,
                    insumos_usados: reporte.insumos_usados,
                    insumos_requeridos: reporte.insumos_requeridos,
                    accesorios: reporte.accesorios,
                    tecnicos_apoyo: reporte.tecnicos_apoyo.map(id => ({ tecnico_id: id })),
                })

                if (insumosRes.error) throw new Error(insumosRes.error)
            }

            // 4. Limpiar de IndexedDB
            await marcarReporteSincronizado(reporte.id)
            sincronizados++

        } catch (error: any) {
            errores++
            // Intentar registrar conflicto en Supabase
            try {
                await supabase.from('sync_conflicts').insert({
                    reporte_id: null, // no existe aún en BD
                    dispositivo_origen: reporte.dispositivo_origen ?? 'desconocido',
                    detalle: `Error al sincronizar reporte offline: ${error.message}`,
                    payload_conflicto: reporte, // guardar el payload completo
                    resuelto: false
                })
            } catch {
                // Si tampoco se puede registrar el conflicto,
                // dejar el reporte en IndexedDB para siguiente intento
            }
        }
    }

    return { sincronizados, errores }
}
