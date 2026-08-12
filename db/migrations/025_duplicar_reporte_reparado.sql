-- =============================================================================
-- Migration: 025_duplicar_reporte_reparado
--
-- Repara duplicar_reporte, que hoy falla SIEMPRE, y le quita la herencia de las
-- horas.
--
-- LO QUE SE ENCONTRÓ (2026-08-12, probando contra la base)
--   Hay DOS versiones desplegadas de duplicar_reporte:
--
--     duplicar_reporte(p_reporte_id_original, p_nuevo_equipo_id, p_tecnico_id)
--       Es la que llama la aplicación (duplicarReporteAction). Responde:
--         42703: column "fecha_ejecucion" of relation
--                "reportes_mantenimiento" does not exist
--       Esa columna no existe ni existió: la de la tabla es fecha_inicio. O sea
--       que duplicar un reporte CON conexión no ha funcionado nunca. Pasó
--       desapercibido porque en campo se duplica sin red, y ahí responde otra
--       implementación distinta, en TypeScript (src/lib/offline/duplicar.ts).
--
--     duplicar_reporte(p_reporte_id, p_nuevo_equipo_id)
--       Dos argumentos, no está en db/migrations y no la llama nadie. Alguien la
--       creó a mano en algún momento.
--
--   Se eliminan las dos y queda una sola definición, la de tres argumentos, que
--   es la que la aplicación usa.
--
-- EL CAMBIO DE FONDO: LAS HORAS NO SE HEREDAN
--   La versión anterior copiaba hora_entrada y hora_salida del original, así que
--   la copia nacía con la hora de una visita que podía ser de hace semanas. Un
--   duplicado es una visita NUEVA: entra ahora y todavía no ha salido. La hora
--   de salida la sella la firma del técnico.
--
--   El mismo cambio va en src/lib/offline/duplicar.ts. Las dos implementaciones
--   tienen que coincidir o el resultado dependerá de si había señal — un error
--   imposible de diagnosticar después.
--
-- EJECUCIÓN: los tres bloques van por separado en el SQL Editor.
-- =============================================================================


-- =============================================================================
-- BLOQUE 1 — VERIFICACIÓN PREVIA (no modifica nada)
-- =============================================================================

-- 1.1 Qué versiones de duplicar_reporte hay desplegadas ahora mismo.
--     Se esperan DOS filas, con 2 y 3 argumentos.
SELECT
    p.oid::regprocedure                AS firma,
    pg_get_function_identity_arguments(p.oid) AS argumentos
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'duplicar_reporte'
  AND n.nspname = 'public'
ORDER BY firma;

-- 1.2 Confirmar que fecha_ejecucion NO existe y fecha_inicio SÍ.
--     Debe devolver una sola fila: fecha_inicio.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'reportes_mantenimiento'
  AND column_name IN ('fecha_ejecucion', 'fecha_inicio');

-- 1.3 El cuerpo actual de la versión de 3 argumentos, para tenerlo a mano por si
--     hiciera falta volver atrás.
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'duplicar_reporte'
  AND n.nspname = 'public'
  AND pg_get_function_identity_arguments(p.oid) LIKE '%,%,%';


-- =============================================================================
-- BLOQUE 2 — CAMBIO
-- =============================================================================

BEGIN;

-- 2.1 Fuera las dos versiones. Hay que soltarlas en vez de reemplazarlas:
--     CREATE OR REPLACE no puede cambiar el nombre de un parámetro, y la de dos
--     argumentos sobra entera.
DROP FUNCTION IF EXISTS duplicar_reporte(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS duplicar_reporte(UUID, UUID);

-- 2.2 La definición buena.
CREATE FUNCTION duplicar_reporte(
    p_reporte_id_original UUID,
    p_nuevo_equipo_id     UUID,
    p_tecnico_id          UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_nuevo_id UUID;
BEGIN
    -- 1. El reporte nuevo, heredando solo lo que describe el trabajo.
    INSERT INTO reportes_mantenimiento (
        equipo_id,
        tecnico_principal_id,
        tipo_mantenimiento_id,
        estado_reporte,
        fecha_inicio,
        hora_entrada,
        hora_salida,
        ciudad,
        solicitado_por,
        motivo_visita,
        diagnostico,
        trabajo_realizado,
        observaciones,
        estado_equipo_post,
        equipo_marca_snapshot,
        equipo_modelo_snapshot,
        equipo_serie_snapshot
    )
    SELECT
        p_nuevo_equipo_id,
        p_tecnico_id,
        o.tipo_mantenimiento_id,
        'en_progreso',          -- siempre nace en progreso
        now(),                  -- era fecha_ejecucion, que no existe
        LOCALTIME,              -- la visita empieza AHORA, no cuando la original
        NULL,                   -- y todavía no ha terminado
        o.ciudad,
        o.solicitado_por,
        o.motivo_visita,
        o.diagnostico,
        o.trabajo_realizado,
        o.observaciones,
        o.estado_equipo_post,
        -- Los snapshots son del equipo NUEVO, no del original: describen sobre
        -- qué se trabajó. Heredarlos del original dejaría la copia describiendo
        -- una máquina que no es la suya.
        e.marca,
        e.modelo,
        e.numero_serie
    FROM reportes_mantenimiento o
    CROSS JOIN LATERAL (
        SELECT marca, modelo, numero_serie
        FROM equipos
        WHERE id = p_nuevo_equipo_id
    ) e
    WHERE o.id = p_reporte_id_original
    RETURNING id INTO v_nuevo_id;

    IF v_nuevo_id IS NULL THEN
        RAISE EXCEPTION 'Reporte original no encontrado, o el equipo destino no existe';
    END IF;

    -- 2. Checklist.
    INSERT INTO reporte_actividades (reporte_id, actividad_id, completada, observacion)
    SELECT v_nuevo_id, actividad_id, completada, observacion
    FROM reporte_actividades
    WHERE reporte_id = p_reporte_id_original;

    -- 3. Insumos usados.
    INSERT INTO reporte_insumos_usados (reporte_id, insumo_id, cantidad, observacion)
    SELECT v_nuevo_id, insumo_id, cantidad, observacion
    FROM reporte_insumos_usados
    WHERE reporte_id = p_reporte_id_original;

    -- 4. Insumos requeridos.
    INSERT INTO reporte_insumos_requeridos (reporte_id, insumo_id, cantidad, urgente, observacion)
    SELECT v_nuevo_id, insumo_id, cantidad, urgente, observacion
    FROM reporte_insumos_requeridos
    WHERE reporte_id = p_reporte_id_original;

    -- NO se copian accesorios ni técnicos de apoyo: son de la visita, no del
    -- trabajo. src/lib/offline/duplicar.ts hace lo mismo.

    RETURN v_nuevo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION duplicar_reporte(UUID, UUID, UUID) TO authenticated;

COMMENT ON FUNCTION duplicar_reporte(UUID, UUID, UUID) IS
    'Duplica un reporte para otro equipo: hereda el detalle técnico, reinicia '
    'fecha, horas, firmas y serial. Su gemela sin conexión es '
    'src/lib/offline/duplicar.ts — cualquier cambio va en las dos.';

COMMIT;


-- =============================================================================
-- BLOQUE 3 — VERIFICACIÓN POSTERIOR
-- =============================================================================

-- 3.1 Ahora debe quedar UNA sola versión, la de tres argumentos.
SELECT
    p.oid::regprocedure                       AS firma,
    pg_get_function_identity_arguments(p.oid) AS argumentos
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'duplicar_reporte'
  AND n.nspname = 'public';

-- 3.2 La prueba de que ya no está rota. Con un id inexistente el INSERT no
--     encuentra filas, así que no crea nada, pero Postgres sí planifica la
--     sentencia: antes fallaba aquí con 42703 (fecha_ejecucion).
--     Esperado ahora: 'Reporte original no encontrado…'. Cualquier error que
--     mencione una columna significa que la migración no quedó bien.
SELECT duplicar_reporte(
    '00000000-0000-0000-0000-000000000000'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
);

-- 3.3 Prueba real, con datos. Sustituye los dos ids y ejecútalo:
--
-- SELECT duplicar_reporte(
--     '<id de un reporte cerrado>'::uuid,
--     '<id de otro equipo>'::uuid,
--     '<tecnicos.id>'::uuid
-- ) AS nuevo_id;
--
-- Y comprobar que la copia nace sin horas heredadas:
--
-- SELECT id, fecha_inicio, hora_entrada, hora_salida, estado_reporte,
--        numero_reporte_fisico
-- FROM reportes_mantenimiento
-- WHERE id = '<nuevo_id>';
--
-- Esperado: hora_entrada = la de ahora, hora_salida NULL,
--           estado 'en_progreso', numero_reporte_fisico NULL.
--
-- Para deshacer la prueba:
-- DELETE FROM reportes_mantenimiento WHERE id = '<nuevo_id>';
