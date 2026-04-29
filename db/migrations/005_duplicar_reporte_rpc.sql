-- =============================================================================
-- Migration: 005_duplicar_reporte_rpc
-- Description: Implementa la función RPC para duplicar un reporte de mantenimiento
--              siguiendo las reglas de exclusión y herencia definidas.
-- =============================================================================

CREATE OR REPLACE FUNCTION duplicar_reporte(
  p_reporte_id_original UUID,
  p_nuevo_equipo_id UUID,
  p_tecnico_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nuevo_id UUID;
BEGIN
  -- 1. Insertar el nuevo reporte heredando campos permitidos
  INSERT INTO reportes_mantenimiento (
    equipo_id,
    tecnico_principal_id,
    tipo_mantenimiento_id,
    estado_reporte,
    fecha_ejecucion,
    hora_entrada,
    hora_salida,
    ciudad,
    solicitado_por,
    motivo_visita,
    diagnostico,
    trabajo_realizado,
    observaciones,
    estado_equipo_post
  )
  SELECT
    p_nuevo_equipo_id,
    p_tecnico_id,
    tipo_mantenimiento_id,
    'en_progreso', -- Siempre inicia en progreso
    CURRENT_DATE,
    hora_entrada,
    hora_salida,
    ciudad,
    solicitado_por,
    motivo_visita,
    diagnostico,
    trabajo_realizado,
    observaciones,
    estado_equipo_post
  FROM reportes_mantenimiento
  WHERE id = p_reporte_id_original
  RETURNING id INTO v_nuevo_id;

  -- 2. Duplicar checklist (actividades)
  INSERT INTO reporte_actividades (reporte_id, actividad_id, completada, observacion)
  SELECT v_nuevo_id, actividad_id, completada, observacion
  FROM reporte_actividades
  WHERE reporte_id = p_reporte_id_original;

  -- 3. Duplicar insumos usados
  INSERT INTO reporte_insumos_usados (reporte_id, insumo_id, cantidad, observacion)
  SELECT v_nuevo_id, insumo_id, cantidad, observacion
  FROM reporte_insumos_usados
  WHERE reporte_id = p_reporte_id_original;

  -- 4. Duplicar insumos requeridos
  INSERT INTO reporte_insumos_requeridos (reporte_id, insumo_id, cantidad, urgente, observacion)
  SELECT v_nuevo_id, insumo_id, cantidad, urgente, observacion
  FROM reporte_insumos_requeridos
  WHERE reporte_id = p_reporte_id_original;

  RETURN v_nuevo_id;
END;
$$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION duplicar_reporte(UUID, UUID, UUID) TO authenticated;

COMMENT ON FUNCTION duplicar_reporte(UUID, UUID, UUID) IS 'Duplica un reporte existente para un nuevo equipo, manteniendo el detalle técnico pero reiniciando firmas y serial.';
