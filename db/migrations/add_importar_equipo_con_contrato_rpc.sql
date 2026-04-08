-- =============================================================================
-- Migration: add_importar_equipo_con_contrato_rpc
-- Fecha: 2026-04-07  |  Rev: 2 — idempotencia y robustez
-- Propósito: RPC transaccional para carga masiva de equipos con asignación
--            automática a contrato. Reemplaza el flujo row-by-row anterior.
--
-- Aplica en: Supabase Dashboard → SQL Editor
-- =============================================================================

/**
 * importar_equipo_con_contrato
 *
 * Inserta un equipo y lo asigna a un contrato en UNA sola transacción.
 * Si cualquier paso falla → rollback completo. No quedan equipos huérfanos.
 *
 * Modo 'insert': falla si codigo_mh ya existe (23505).
 * Modo 'upsert': actualiza equipo si existe y reasigna contrato si cambió.
 *
 * Idempotencia (upsert):
 *   Si el equipo ya tiene ese mismo contrato como vigente, solo actualiza
 *   ubicacion_id si cambió — no crea registros duplicados en equipo_contratos.
 *
 * Concurrencia:
 *   El índice uidx_equipo_contrato_vigente (UNIQUE WHERE fecha_retiro IS NULL)
 *   actúa como guard de BD. Si dos transacciones simultáneas intentan crear
 *   un vigente para el mismo equipo, una falla con 23505 y se reporta como error.
 */
CREATE OR REPLACE FUNCTION importar_equipo_con_contrato(
    p_codigo_mh             TEXT,
    p_nombre                TEXT,
    p_marca                 TEXT,
    p_modelo                TEXT,
    p_numero_serie          TEXT,
    p_activo_fijo           TEXT,
    p_categoria_id          UUID,
    p_tipo_mantenimiento_id UUID,
    p_fecha_fabricacion     DATE,
    p_observaciones         TEXT,
    p_contrato_id           UUID,
    p_ubicacion_id          UUID,
    p_modo                  TEXT DEFAULT 'insert'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_equipo_id          UUID;
    v_contrato_activo    BOOLEAN;
    v_vigente_contrato   UUID;   -- contrato_id del vigente actual del equipo
    v_vigente_ec_id      UUID;   -- id del registro equipo_contratos vigente
BEGIN
    -- 1. Validar contrato: existencia + activo
    SELECT activo INTO v_contrato_activo
    FROM contratos
    WHERE id = p_contrato_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contrato no existe';
    END IF;

    IF NOT v_contrato_activo THEN
        RAISE EXCEPTION 'Contrato inactivo';
    END IF;

    -- 2. Insertar o actualizar equipo
    IF p_modo = 'upsert' THEN
        SELECT id INTO v_equipo_id
        FROM equipos
        WHERE codigo_mh = p_codigo_mh;

        IF FOUND THEN
            -- Equipo existe: actualizar campos básicos (NO tocar datos de firma/estado)
            UPDATE equipos
            SET nombre                = p_nombre,
                marca                 = p_marca,
                modelo                = p_modelo,
                numero_serie          = p_numero_serie,
                activo_fijo           = p_activo_fijo,
                categoria_id          = p_categoria_id,
                tipo_mantenimiento_id = p_tipo_mantenimiento_id,
                fecha_fabricacion     = p_fecha_fabricacion,
                observaciones         = p_observaciones
            WHERE id = v_equipo_id;
        ELSE
            -- Equipo nuevo: insertar
            INSERT INTO equipos (
                codigo_mh, nombre, marca, modelo, numero_serie, activo_fijo,
                categoria_id, tipo_mantenimiento_id, fecha_fabricacion, observaciones, activo
            ) VALUES (
                p_codigo_mh, p_nombre, p_marca, p_modelo, p_numero_serie, p_activo_fijo,
                p_categoria_id, p_tipo_mantenimiento_id, p_fecha_fabricacion, p_observaciones, true
            )
            RETURNING id INTO v_equipo_id;
        END IF;

    ELSE
        -- Modo insert estricto: falla con 23505 si codigo_mh ya existe
        INSERT INTO equipos (
            codigo_mh, nombre, marca, modelo, numero_serie, activo_fijo,
            categoria_id, tipo_mantenimiento_id, fecha_fabricacion, observaciones, activo
        ) VALUES (
            p_codigo_mh, p_nombre, p_marca, p_modelo, p_numero_serie, p_activo_fijo,
            p_categoria_id, p_tipo_mantenimiento_id, p_fecha_fabricacion, p_observaciones, true
        )
        RETURNING id INTO v_equipo_id;
    END IF;

    -- 3. Asignar contrato — con idempotencia
    --
    -- Leer el contrato vigente actual (si existe).
    SELECT id, contrato_id
      INTO v_vigente_ec_id, v_vigente_contrato
    FROM equipo_contratos
    WHERE equipo_id = v_equipo_id
      AND fecha_retiro IS NULL;

    IF FOUND AND v_vigente_contrato = p_contrato_id THEN
        -- El equipo ya tiene este contrato como vigente.
        -- Solo actualizar ubicacion_id si cambió.
        -- IDEMPOTENTE: subir el mismo CSV dos veces no genera registros duplicados.
        UPDATE equipo_contratos
        SET ubicacion_id = p_ubicacion_id
        WHERE id = v_vigente_ec_id
          AND (ubicacion_id IS DISTINCT FROM p_ubicacion_id);
    ELSE
        -- Contrato diferente (o el equipo no tenía contrato): cerrar vigente e insertar nuevo.
        -- El índice uidx_equipo_contrato_vigente garantiza que si dos transacciones
        -- concurrentes llegan aquí para el mismo equipo, una fallará con 23505.
        UPDATE equipo_contratos
        SET fecha_retiro = CURRENT_DATE
        WHERE equipo_id = v_equipo_id
          AND fecha_retiro IS NULL;

        INSERT INTO equipo_contratos (equipo_id, contrato_id, ubicacion_id, fecha_asignacion)
        VALUES (v_equipo_id, p_contrato_id, p_ubicacion_id, CURRENT_DATE);
    END IF;

    RETURN v_equipo_id;
END;
$$;

-- Otorgar permisos de ejecución al rol autenticado
GRANT EXECUTE ON FUNCTION importar_equipo_con_contrato(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, DATE, TEXT, UUID, UUID, TEXT
) TO authenticated;
