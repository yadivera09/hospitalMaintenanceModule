-- =============================================================================
-- Migration: 024_sync_idempotente
--
-- Da al servidor una forma de reconocer un reporte que ya subió.
--
-- EL PROBLEMA
--   /api/sync hace cuatro pasos sueltos: crear el borrador, guardar el detalle,
--   guardar los insumos y aplicar las firmas. Si falla el cuarto, el reporte YA
--   existe en la base, pero la respuesta que le llega al dispositivo es un
--   error, así que nunca guarda el id del servidor. El siguiente intento vuelve
--   a entrar por la rama de "crear" y produce otro reporte. Cada reintento, uno
--   más.
--
--   La app intentaba taparlo por su cuenta: antes de subir buscaba si ya había
--   un reporte del mismo equipo, mismo técnico y misma fecha, y si lo
--   encontraba borraba el borrador local. Esa heurística no distingue un
--   reintento de un trabajo distinto — un preventivo por la mañana y un
--   correctivo por la tarde sobre el mismo equipo son dos reportes legítimos, y
--   el segundo se perdía sin subirse y sin aviso.
--
-- LA IDENTIDAD YA EXISTÍA
--   Cada borrador nace en el dispositivo con un id propio ('local_<uuid>', ver
--   src/lib/offline/db.ts). Ese id identifica el trabajo sin ambigüedad y no se
--   estaba usando para nada al sincronizar. Guardarlo aquí, con un índice único,
--   convierte el reintento en algo seguro: el segundo intento choca contra el
--   índice en vez de duplicar.
--
-- POR QUÉ EL ÍNDICE ES PARCIAL
--   Los reportes creados con conexión no tienen id local y nunca lo tendrán.
--   Un índice único normal trataría todos esos NULL como distintos —lo que en
--   Postgres funciona—, pero el parcial además los deja fuera del índice, que
--   con 33 de 75 filas sin valor es la diferencia entre indexar el dato y
--   indexar el hueco.
--
-- EJECUCIÓN: los tres bloques van por separado en el SQL Editor.
-- =============================================================================


-- =============================================================================
-- BLOQUE 1 — VERIFICACIÓN PREVIA (no modifica nada)
-- =============================================================================

-- 1.1 ¿Existe ya la columna? Debe devolver 0 filas.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'reportes_mantenimiento'
  AND column_name = 'id_local';

-- 1.2 Retrato de los duplicados que dejó el fallo, para saber qué se está
--     arrastrando. Agrupa por equipo + técnico + día: lo que salga con más de
--     un reporte y estados repetidos es candidato a duplicado real.
SELECT
    equipo_id,
    tecnico_principal_id,
    fecha_inicio::date            AS dia,
    COUNT(*)                      AS reportes,
    COUNT(*) FILTER (WHERE numero_reporte_fisico IS NULL) AS sin_serial,
    ARRAY_AGG(estado_reporte ORDER BY created_at)         AS estados,
    ARRAY_AGG(id ORDER BY created_at)                     AS ids
FROM reportes_mantenimiento
WHERE activo = true
GROUP BY equipo_id, tecnico_principal_id, fecha_inicio::date
HAVING COUNT(*) > 1
ORDER BY reportes DESC, dia DESC;

-- 1.3 Total de reportes, para comparar después.
SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE activo) AS activos
FROM reportes_mantenimiento;

-- NOTA: esta migración NO borra ningún duplicado. Solo impide que aparezcan
-- nuevos. La limpieza de los que ya existen es una decisión de negocio —hay que
-- mirar uno a uno si son reintentos o trabajos distintos— y va aparte.


-- =============================================================================
-- BLOQUE 2 — CAMBIO
-- =============================================================================

BEGIN;

-- 2.1 El id que trae el dispositivo. TEXT y no UUID: el formato es
--     'local_<uuid>', con prefijo, y guardarlo entero deja claro de un vistazo
--     que ese reporte nació sin conexión.
ALTER TABLE reportes_mantenimiento
    ADD COLUMN IF NOT EXISTS id_local TEXT;

COMMENT ON COLUMN reportes_mantenimiento.id_local IS
    'Id del borrador en el dispositivo que lo creó sin conexión (local_<uuid>). '
    'NULL en los reportes creados con conexión. Su índice único es lo que hace '
    'idempotente el reintento de /api/sync.';

-- 2.2 El índice único, que es el punto de toda la migración.
CREATE UNIQUE INDEX IF NOT EXISTS ux_reportes_id_local
    ON reportes_mantenimiento (id_local)
    WHERE id_local IS NOT NULL;

COMMIT;


-- =============================================================================
-- BLOQUE 3 — VERIFICACIÓN POSTERIOR
-- =============================================================================

-- 3.1 La columna existe y admite NULL.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'reportes_mantenimiento'
  AND column_name = 'id_local';
-- Esperado: id_local | text | YES

-- 3.2 El índice existe y es único y parcial.
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'reportes_mantenimiento'
  AND indexname = 'ux_reportes_id_local';
-- Esperado: CREATE UNIQUE INDEX ... WHERE (id_local IS NOT NULL)

-- 3.3 Nada se ha tocado: el total debe coincidir con el de 1.3.
SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE activo) AS activos
FROM reportes_mantenimiento;

-- 3.4 Prueba de que el índice muerde. Debe fallar con
--     'duplicate key value violates unique constraint "ux_reportes_id_local"'.
--     Si NO falla, el índice no se creó y la migración no sirvió de nada.
--
-- DO $$
-- BEGIN
--     UPDATE reportes_mantenimiento SET id_local = 'local_prueba_024'
--     WHERE id = (SELECT id FROM reportes_mantenimiento LIMIT 1);
--     UPDATE reportes_mantenimiento SET id_local = 'local_prueba_024'
--     WHERE id = (SELECT id FROM reportes_mantenimiento OFFSET 1 LIMIT 1);
-- END $$;
--
-- Y para dejarlo limpio después de comprobarlo:
-- UPDATE reportes_mantenimiento SET id_local = NULL WHERE id_local = 'local_prueba_024';
