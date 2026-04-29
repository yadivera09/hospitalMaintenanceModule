-- =============================================================================
-- Migration: 003_reporte_states_and_sequence
-- Description: Implementa el nuevo flujo de estados de reporte y el serial con SEQUENCE.
--              Prerequisito para los cambios del Bloque 4.
-- =============================================================================

-- 1. MIGRACIÓN 1 — Nuevo flujo de estados de reporte
-- Eliminar constraint existente
ALTER TABLE reportes_mantenimiento
  DROP CONSTRAINT IF EXISTS ck_estado_reporte;

-- Actualizar registros con estados obsoletos (si existen)
UPDATE reportes_mantenimiento
  SET estado_reporte = 'en_progreso'
  WHERE estado_reporte IN ('borrador', 'pendiente_firma_tecnico');

-- Crear nuevo constraint con estados válidos
-- Flujo: en_progreso → pendiente_firma_cliente → cerrado
ALTER TABLE reportes_mantenimiento
  ADD CONSTRAINT ck_estado_reporte CHECK (
    estado_reporte = ANY (
      ARRAY['en_progreso', 'pendiente_firma_cliente', 'cerrado', 'anulado']
    )
  );

-- El constraint de cierre ya existente se mantiene sin cambios:
-- CONSTRAINT ck_reporte_cerrado_requiere_firmas CHECK (
--   estado_reporte <> 'cerrado'
--   OR (firma_tecnico IS NOT NULL AND firma_cliente IS NOT NULL)
-- )

-- 2. MIGRACIÓN 2 — Serial de reporte con SEQUENCE de PostgreSQL
-- Crear sequence para seriales de reporte
CREATE SEQUENCE IF NOT EXISTS seq_numero_reporte START 1 INCREMENT 1;

-- Función RPC que asigna el serial de forma atómica
-- El serial se genera cuando el reporte pasa de en_progreso a pendiente_firma_cliente
CREATE OR REPLACE FUNCTION cerrar_borrador_reporte(p_reporte_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_serial TEXT;
  v_estado TEXT;
BEGIN
  SELECT estado_reporte INTO v_estado
    FROM reportes_mantenimiento
    WHERE id = p_reporte_id;

  IF v_estado <> 'en_progreso' THEN
    RAISE EXCEPTION 'Solo se puede asignar serial a reportes en estado en_progreso';
  END IF;

  -- Generar serial: RPT-000001
  v_serial := 'RPT-' || LPAD(nextval('seq_numero_reporte')::TEXT, 6, '0');

  UPDATE reportes_mantenimiento
    SET numero_reporte_fisico = v_serial,
        estado_reporte = 'pendiente_firma_cliente',
        fecha_fin = NOW() -- Opcional: registrar fin de actividad técnica
    WHERE id = p_reporte_id
      AND estado_reporte = 'en_progreso'
      AND numero_reporte_fisico IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El reporte no existe o ya tiene serial';
  END IF;

  RETURN v_serial;
END;
$$;
