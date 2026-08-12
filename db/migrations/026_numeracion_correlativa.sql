-- =============================================================================
-- Migration: 026_numeracion_correlativa
--
-- El número RPT- pasa a ser correlativo sin huecos, y se renumera lo existente.
--
-- POR QUÉ SE QUEMABAN NÚMEROS
--   El serial salía de una SEQUENCE, y una secuencia de PostgreSQL no se
--   revierte al hacer rollback. Es deliberado —así dos transacciones simultáneas
--   no se bloquean entre sí—, pero significa que cada intento fallido se lleva un
--   número por delante. Y fallaban dos cosas a la vez:
--
--     · El reintento de sincronización. Un reporte ya cerrado volvía a entrar
--       por aquí, nextval() consumía un número y el UPDATE no encontraba fila.
--     · El campo "N° reporte físico" del wizard. Escribía en la MISMA columna
--       donde va el serial, y el cierre exige que esté vacía, así que rellenarlo
--       impedía cerrar el reporte — quemando un número en cada intento.
--
--   En la base quedaron 18 huecos: el 10, y el bloque 37–53 completo, quemado el
--   2026-08-07 entre las 19:29 y las 20:30.
--
--   Los dos fallos están corregidos: la idempotencia en la migración 024 y el
--   campo del wizard, eliminado. Esta migración cierra la última vía y repara lo
--   que quedó.
--
-- LA TABLA CONTADOR
--   Un contador en una TABLA sí se revierte con el rollback. Ese es todo el
--   cambio de fondo. A cambio, los cierres simultáneos se serializan mientras dura
--   la transacción: el UPDATE bloquea la fila. Para el volumen de esta aplicación
--   —unos pocos cierres al día— no es un problema; con miles por segundo lo sería.
--
-- ADEMÁS, LA FUNCIÓN SE VUELVE IDEMPOTENTE
--   Si el reporte ya tiene serial, lo devuelve en vez de fallar. Un reintento
--   deja de ser un error y pasa a ser una consulta.
--
-- EJECUCIÓN: los tres bloques van por separado en el SQL Editor.
-- REQUISITO: aplicar antes la migración 024.
-- =============================================================================


-- =============================================================================
-- BLOQUE 1 — VERIFICACIÓN PREVIA (no modifica nada)
-- =============================================================================

-- 1.1 Retrato de la numeración actual: cuántos hay, mínimo, máximo y huecos.
WITH seriales AS (
    SELECT CAST(SUBSTRING(numero_reporte_fisico FROM 5) AS INTEGER) AS n
    FROM reportes_mantenimiento
    WHERE numero_reporte_fisico ~ '^RPT-[0-9]{6}$'
)
SELECT
    COUNT(*)                        AS con_serial,
    MIN(n)                          AS minimo,
    MAX(n)                          AS maximo,
    MAX(n) - COUNT(*)               AS huecos
FROM seriales;
-- Esperado antes de migrar: con_serial 37, minimo 1, maximo 55, huecos 18.

-- 1.2 Los huecos, uno a uno.
WITH seriales AS (
    SELECT CAST(SUBSTRING(numero_reporte_fisico FROM 5) AS INTEGER) AS n
    FROM reportes_mantenimiento
    WHERE numero_reporte_fisico ~ '^RPT-[0-9]{6}$'
)
SELECT g.n AS numero_quemado
FROM generate_series((SELECT MIN(n) FROM seriales), (SELECT MAX(n) FROM seriales)) g(n)
WHERE NOT EXISTS (SELECT 1 FROM seriales s WHERE s.n = g.n)
ORDER BY g.n;

-- 1.3 Valores que NO son seriales del sistema. Son folios de talonario tecleados
--     por el técnico cuando el campo aún existía. NO se tocan en esta migración
--     (quedaron para revisar aparte); solo hay que saber que están.
SELECT id, numero_reporte_fisico, estado_reporte, created_at::date
FROM reportes_mantenimiento
WHERE numero_reporte_fisico IS NOT NULL
  AND numero_reporte_fisico !~ '^RPT-[0-9]{6}$'
ORDER BY created_at;
-- Esperado: 4 filas — 00123, 001323, 00124, 001234.

-- 1.4 COPIA DE SEGURIDAD de la numeración actual. Ejecutar SÍ O SÍ: es lo único
--     que permite volver atrás, porque el bloque 2 sobrescribe los seriales.
CREATE TABLE IF NOT EXISTS respaldo_seriales_026 AS
SELECT id, numero_reporte_fisico, created_at, fecha_firma_tecnico
FROM reportes_mantenimiento
WHERE numero_reporte_fisico IS NOT NULL;

SELECT COUNT(*) AS filas_respaldadas FROM respaldo_seriales_026;
-- Esperado: 41 (37 seriales + 4 folios).


-- =============================================================================
-- BLOQUE 2 — CAMBIO
-- =============================================================================

BEGIN;

-- 2.1 El contador. Una sola fila, garantizada por el CHECK sobre la clave.
CREATE TABLE IF NOT EXISTS contador_reportes (
    id     BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    ultimo INTEGER NOT NULL DEFAULT 0
);

INSERT INTO contador_reportes (id, ultimo)
VALUES (TRUE, 0)
ON CONFLICT (id) DO NOTHING;

-- Nadie toca esta tabla directamente: se manipula desde cerrar_borrador_reporte,
-- que es SECURITY DEFINER y por tanto no pasa por RLS. Sin políticas, queda
-- cerrada a la API.
ALTER TABLE contador_reportes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE contador_reportes IS
    'Último número de reporte asignado. Es una tabla y no una secuencia a '
    'propósito: las secuencias no se revierten con el rollback y cada cierre '
    'fallido quemaba un número.';

-- 2.2 Renumerar lo existente, cerrando los huecos.
--
-- Se ordena por el serial actual y no por fecha: así el orden histórico se
-- conserva exactamente y lo único que cambia es que desaparecen los saltos.
--
-- POR QUÉ EN DOS FASES
--   Sobre la tabla hay un índice único parcial que no está en db/schema.sql:
--
--     CREATE UNIQUE INDEX uidx_reporte_numero_fisico
--       ON reportes_mantenimiento (numero_reporte_fisico)
--       WHERE numero_reporte_fisico IS NOT NULL
--
--   Un UPDATE que reasigne los números de una sola pasada choca contra él, y no
--   por un error del cálculo: los valores nuevos invaden el rango de los viejos.
--   Al bajar RPT-000026 a RPT-000025, el 25 todavía existe —le toca bajar a 24
--   más adelante, en la misma sentencia— y el índice, que se comprueba fila a
--   fila y no al final, lo rechaza:
--
--     23505: duplicate key value violates unique constraint
--            "uidx_reporte_numero_fisico"
--     DETAIL: Key (numero_reporte_fisico)=(RPT-000025) already exists.
--
--   Al ser un índice y no una constraint, tampoco se puede aplazar con
--   DEFERRABLE. La salida es pasar por un prefijo intermedio: TMP- no colisiona
--   con ningún RPT-, y dentro de TMP- cada número es único. Las dos fases van en
--   la misma transacción, así que nadie llega a ver los valores intermedios.
WITH orden AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            ORDER BY CAST(SUBSTRING(numero_reporte_fisico FROM 5) AS INTEGER)
        ) AS n
    FROM reportes_mantenimiento
    WHERE numero_reporte_fisico ~ '^RPT-[0-9]{6}$'
)
UPDATE reportes_mantenimiento r
SET numero_reporte_fisico = 'TMP-' || LPAD(o.n::TEXT, 6, '0')
FROM orden o
WHERE r.id = o.id;

UPDATE reportes_mantenimiento
SET numero_reporte_fisico = 'RPT-' || SUBSTRING(numero_reporte_fisico FROM 5)
WHERE numero_reporte_fisico ~ '^TMP-[0-9]{6}$';

-- 2.3 El contador arranca donde terminó la renumeración.
UPDATE contador_reportes
SET ultimo = COALESCE((
    SELECT MAX(CAST(SUBSTRING(numero_reporte_fisico FROM 5) AS INTEGER))
    FROM reportes_mantenimiento
    WHERE numero_reporte_fisico ~ '^RPT-[0-9]{6}$'
), 0)
WHERE id;

-- 2.4 La función de cierre, ahora contra el contador.
CREATE OR REPLACE FUNCTION cerrar_borrador_reporte(p_reporte_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_serial  TEXT;
    v_previo  TEXT;
    v_estado  TEXT;
    v_numero  INTEGER;
BEGIN
    SELECT estado_reporte, numero_reporte_fisico
      INTO v_estado, v_previo
      FROM reportes_mantenimiento
     WHERE id = p_reporte_id;

    IF v_estado IS NULL THEN
        RAISE EXCEPTION 'El reporte no existe';
    END IF;

    -- Idempotencia. Si ya tiene serial, el trabajo está hecho: se devuelve el
    -- que hay. Antes esto era una excepción, y como nextval() ya se había
    -- consumido, cada reintento de sincronización quemaba un número.
    IF v_previo ~ '^RPT-[0-9]{6}$' THEN
        RETURN v_previo;
    END IF;

    IF v_estado <> 'en_progreso' THEN
        RAISE EXCEPTION 'Solo se puede asignar serial a reportes en estado en_progreso (actual: %)', v_estado;
    END IF;

    -- El número se pide DESPUÉS de comprobar que el cierre procede, y sale de
    -- una tabla: si algo falla más abajo, el rollback lo devuelve al contador.
    UPDATE contador_reportes
       SET ultimo = ultimo + 1
     WHERE id
    RETURNING ultimo INTO v_numero;

    v_serial := 'RPT-' || LPAD(v_numero::TEXT, 6, '0');

    -- OJO al orden en la aplicación: el constraint
    -- ck_reporte_cerrado_requiere_firma_tecnico rechaza un cerrado sin firma, y
    -- esta función NO recibe la firma. Por eso firmarComoTecnico() escribe
    -- primero firma_tecnico —con el reporte aún 'en_progreso', donde el
    -- constraint no aplica— y solo después llama aquí. Invertir ese orden hace
    -- fallar el cierre.
    UPDATE reportes_mantenimiento
       SET numero_reporte_fisico = v_serial,
           estado_reporte        = 'cerrado',
           fecha_fin             = NOW()
     WHERE id = p_reporte_id
       AND estado_reporte = 'en_progreso';

    IF NOT FOUND THEN
        -- Alguien cerró el reporte entre el SELECT y el UPDATE. La excepción
        -- revierte también el incremento del contador, que es justo lo que la
        -- secuencia no hacía.
        RAISE EXCEPTION 'El reporte cambió de estado durante el cierre';
    END IF;

    RETURN v_serial;
END;
$$;

COMMENT ON FUNCTION cerrar_borrador_reporte(UUID) IS
    'Cierra un reporte en progreso y le asigna el correlativo RPT-. Idempotente: '
    'si ya tiene serial lo devuelve sin consumir uno nuevo.';

-- 2.5 Fuera la secuencia: ya no la usa nadie y dejarla ahí invita a que el
--     próximo cambio vuelva a apoyarse en ella.
DROP SEQUENCE IF EXISTS seq_numero_reporte;

COMMIT;


-- =============================================================================
-- BLOQUE 3 — VERIFICACIÓN POSTERIOR
-- =============================================================================

-- 3.1 Ya no debe haber huecos.
WITH seriales AS (
    SELECT CAST(SUBSTRING(numero_reporte_fisico FROM 5) AS INTEGER) AS n
    FROM reportes_mantenimiento
    WHERE numero_reporte_fisico ~ '^RPT-[0-9]{6}$'
)
SELECT
    COUNT(*)          AS con_serial,
    MIN(n)            AS minimo,
    MAX(n)            AS maximo,
    MAX(n) - COUNT(*) AS huecos
FROM seriales;
-- Esperado: con_serial 37, minimo 1, maximo 37, huecos 0.

-- 3.2 Ningún número repetido.
SELECT numero_reporte_fisico, COUNT(*)
FROM reportes_mantenimiento
WHERE numero_reporte_fisico ~ '^RPT-[0-9]{6}$'
GROUP BY numero_reporte_fisico
HAVING COUNT(*) > 1;
-- Esperado: 0 filas.

-- 3.3 El contador coincide con el máximo.
SELECT ultimo FROM contador_reportes;
-- Esperado: 37.

-- 3.4 Los 4 folios de talonario siguen intactos.
SELECT COUNT(*) AS folios_intactos
FROM reportes_mantenimiento
WHERE numero_reporte_fisico IS NOT NULL
  AND numero_reporte_fisico !~ '^RPT-[0-9]{6}$';
-- Esperado: 4.

-- 3.5 Correspondencia entre lo viejo y lo nuevo, para poder avisar si algún
--     reporte ya impreso cambió de número.
SELECT
    b.numero_reporte_fisico AS antes,
    r.numero_reporte_fisico AS ahora,
    r.estado_reporte
FROM respaldo_seriales_026 b
JOIN reportes_mantenimiento r ON r.id = b.id
WHERE b.numero_reporte_fisico IS DISTINCT FROM r.numero_reporte_fisico
ORDER BY CAST(SUBSTRING(b.numero_reporte_fisico FROM 5) AS INTEGER);

-- 3.6 La prueba de que ya no se queman números. Llamar dos veces sobre un
--     reporte YA CERRADO: antes cada llamada consumía un número y lanzaba
--     excepción; ahora debe devolver el mismo serial las dos veces y dejar el
--     contador donde estaba.
--
-- SELECT ultimo AS contador_antes FROM contador_reportes;
-- SELECT cerrar_borrador_reporte('<id de un reporte cerrado>'::uuid);
-- SELECT cerrar_borrador_reporte('<id de un reporte cerrado>'::uuid);
-- SELECT ultimo AS contador_despues FROM contador_reportes;
--
-- Esperado: el mismo RPT- en las dos llamadas, y contador_antes = contador_despues.

-- 3.7 Cuando todo esté comprobado y en uso durante unos días:
-- DROP TABLE respaldo_seriales_026;
