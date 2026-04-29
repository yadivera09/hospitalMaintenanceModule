-- =============================================================================
-- Migration: 004_historial_ubicaciones_view
-- Description: Crea la vista para consultar el historial de ubicaciones de un equipo
--              basado en sus reportes de mantenimiento.
-- =============================================================================

CREATE OR REPLACE VIEW v_historial_ubicaciones_equipo AS
  SELECT
    rm.equipo_id,
    e.codigo_mh,
    e.nombre          AS equipo_nombre,
    u.nombre          AS ubicacion_nombre,
    rm.ubicacion_detalle,
    rm.fecha_inicio   AS fecha_registro,
    rm.estado_reporte,
    t.nombre || ' ' || t.apellido AS tecnico_nombre
  FROM reportes_mantenimiento rm
  JOIN equipos      e ON e.id = rm.equipo_id
  JOIN tecnicos     t ON t.id = rm.tecnico_principal_id
  LEFT JOIN ubicaciones u ON u.id = rm.ubicacion_id
  WHERE rm.estado_reporte IN ('pendiente_firma_cliente', 'cerrado')
  ORDER BY rm.equipo_id, rm.fecha_inicio DESC;

COMMENT ON VIEW v_historial_ubicaciones_equipo IS 'Historial de ubicaciones de equipos derivado de reportes finalizados o en firma.';
