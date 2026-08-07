-- =============================================================================
-- Migration: 023_estado_cerrado_unico
--
-- Elimina el estado 'pendiente_firma_cliente'. El flujo pasa de
--
--     en_progreso -> pendiente_firma_cliente -> cerrado
-- a
--     en_progreso -> cerrado
--
-- El reporte queda cerrado cuando firma el TÉCNICO. La firma del cliente sigue
-- pudiendo registrarse después, pero ya no es requisito para cerrar.
--
-- CONSECUENCIA QUE CONVIENE TENER PRESENTE
--   Hasta ahora la base garantizaba que ningún reporte podía darse por cerrado
--   sin la firma del cliente (constraint ck_reporte_cerrado_requiere_firmas).
--   Esa garantía desaparece: a partir de aquí, "cerrado" significa que el
--   técnico terminó, no que el cliente lo aceptó. Si en algún momento hace
--   falta distinguir ambas cosas, la información sigue estando en
--   firma_cliente / fecha_firma_cliente, que no se tocan.
--
-- ESTADO ENCONTRADO AL ESCRIBIR ESTA MIGRACIÓN (2026-08-07)
--   48 reportes en 'pendiente_firma_cliente', todos con firma del técnico y
--   ninguno con firma del cliente. De esos, 26 sin fecha_fin: se rellena con
--   fecha_firma_tecnico, porque los rankings y la vista de mantenimientos
--   vencidos se calculan sobre fecha_fin y sin ella el reporte no cuenta.
--
-- EJECUCIÓN: los tres bloques van por separado en el SQL Editor.
-- =============================================================================


-- =============================================================================
-- BLOQUE 1 — VERIFICACIÓN PREVIA (no modifica nada)
-- =============================================================================

-- 1.1 Reparto actual de estados
SELECT estado_reporte, activo, COUNT(*) AS total
FROM reportes_mantenimiento
GROUP BY estado_reporte, activo
ORDER BY estado_reporte;

-- 1.2 Los que se van a migrar: ¿les falta algo?
SELECT
    COUNT(*)                                        AS a_migrar,
    COUNT(*) FILTER (WHERE firma_tecnico IS NULL)   AS sin_firma_tecnico,
    COUNT(*) FILTER (WHERE fecha_fin IS NULL)       AS sin_fecha_fin,
    COUNT(*) FILTER (WHERE fecha_fin IS NULL
                       AND fecha_firma_tecnico IS NULL) AS sin_fecha_recuperable
FROM reportes_mantenimiento
WHERE estado_reporte = 'pendiente_firma_cliente';

-- Si 'sin_fecha_recuperable' no es 0, PARAR: esos reportes quedarían cerrados
-- sin fecha y desaparecerían de los informes. Hay que decidir qué fecha darles
-- antes de continuar.

-- 1.3 Constraints actuales de la tabla
SELECT conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'reportes_mantenimiento'::regclass
  AND contype = 'c'
ORDER BY conname;

-- 1.4 Policies que mencionan el estado que se elimina
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'reportes_mantenimiento';


-- =============================================================================
-- BLOQUE 2 — MIGRACIÓN
--
-- EJECUTAR EL BLOQUE ENTERO DE UNA SOLA VEZ, no paso a paso.
--
-- Va envuelto en BEGIN/COMMIT, así que lanzar los pasos por separado deja la
-- transacción abierta y sin confirmar: lo que hizo el paso anterior se descarta
-- al terminar esa ejecución. Y los pasos dependen entre sí — el 2.3 falla con
-- "violates check constraint ck_reporte_cerrado_requiere_firmas" si el 2.1 no
-- ha llegado a aplicarse, porque ese constraint sigue exigiendo la firma del
-- cliente que ninguno de estos reportes tiene.
--
-- Se puede repetir sin daño si algo falla a mitad: todos los pasos son
-- idempotentes.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 2.1 Relajar el constraint de cierre ANTES de mover nada.
--
-- El orden importa: ck_reporte_cerrado_requiere_firmas exige firma del cliente
-- para estar en 'cerrado', y ninguno de los 48 la tiene. Si se intentara el
-- UPDATE primero, fallaría entero.
-- ---------------------------------------------------------------------------
ALTER TABLE reportes_mantenimiento
    DROP CONSTRAINT IF EXISTS ck_reporte_cerrado_requiere_firmas;

-- Se mantiene la mitad de la garantía que sigue teniendo sentido: un reporte
-- cerrado sin la firma de quien hizo el trabajo no debería existir nunca.
-- El DROP previo es para poder repetir el bloque: ADD CONSTRAINT falla si el
-- constraint ya se creó en un intento anterior.
ALTER TABLE reportes_mantenimiento
    DROP CONSTRAINT IF EXISTS ck_reporte_cerrado_requiere_firma_tecnico;

ALTER TABLE reportes_mantenimiento
    ADD CONSTRAINT ck_reporte_cerrado_requiere_firma_tecnico CHECK (
        estado_reporte <> 'cerrado'
        OR firma_tecnico IS NOT NULL
    );

-- ---------------------------------------------------------------------------
-- 2.2 Rellenar fecha_fin donde falte.
--
-- Sin esto, 26 reportes quedarían cerrados y con fecha_fin NULL. No es
-- cosmético: v_equipos_mantenimiento_vencido calcula el último mantenimiento
-- con MAX(fecha_fin), y los rankings del dashboard filtran por ese campo. Un
-- cerrado sin fecha_fin es invisible para todo el sistema de informes.
-- ---------------------------------------------------------------------------
UPDATE reportes_mantenimiento
SET fecha_fin = fecha_firma_tecnico
WHERE estado_reporte = 'pendiente_firma_cliente'
  AND fecha_fin IS NULL
  AND fecha_firma_tecnico IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2.3 Mover los reportes al nuevo estado
-- ---------------------------------------------------------------------------
UPDATE reportes_mantenimiento
SET estado_reporte = 'cerrado'
WHERE estado_reporte = 'pendiente_firma_cliente';

-- ---------------------------------------------------------------------------
-- 2.4 Retirar el estado del dominio permitido
-- ---------------------------------------------------------------------------
ALTER TABLE reportes_mantenimiento
    DROP CONSTRAINT IF EXISTS ck_estado_reporte;

ALTER TABLE reportes_mantenimiento
    ADD CONSTRAINT ck_estado_reporte CHECK (
        estado_reporte = ANY (ARRAY['en_progreso', 'cerrado', 'anulado'])
    );

-- ---------------------------------------------------------------------------
-- 2.5 El RPC que asigna el serial ahora cierra directamente.
--
-- Es el punto donde nacía el estado intermedio, así que si no se cambia aquí
-- el constraint nuevo rechazaría la siguiente firma de técnico.
-- ---------------------------------------------------------------------------
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

  v_serial := 'RPT-' || LPAD(nextval('seq_numero_reporte')::TEXT, 6, '0');

  -- El estado pasa a 'cerrado' en el mismo UPDATE que el serial.
  --
  -- OJO al orden en la aplicación: el constraint
  -- ck_reporte_cerrado_requiere_firma_tecnico rechaza un cerrado sin firma, y
  -- esta función NO recibe la firma. Por eso firmarComoTecnico() escribe primero
  -- firma_tecnico —con el reporte aún 'en_progreso', donde el constraint no
  -- aplica— y solo después llama aquí. Invertir ese orden hace fallar el cierre.
  UPDATE reportes_mantenimiento
    SET numero_reporte_fisico = v_serial,
        estado_reporte = 'cerrado',
        fecha_fin = NOW()
    WHERE id = p_reporte_id
      AND estado_reporte = 'en_progreso'
      AND numero_reporte_fisico IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El reporte no existe o ya tiene serial';
  END IF;

  RETURN v_serial;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.6 Vista de historial de ubicaciones
-- ---------------------------------------------------------------------------
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
  WHERE rm.estado_reporte = 'cerrado'
  ORDER BY rm.equipo_id, rm.fecha_inicio DESC;

-- ---------------------------------------------------------------------------
-- 2.7 Policy de escritura del técnico.
--
-- Antes permitía editar en 'en_progreso' y 'pendiente_firma_cliente'. Como la
-- firma del cliente se registra ahora sobre un reporte YA cerrado, ese estado
-- tiene que entrar en el USING o la firma sería rechazada por RLS.
--
-- Amplía el acceso de escritura del técnico a reportes cerrados: es
-- consecuencia directa de cerrar antes de que firme el cliente.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "reportes_tecnico_update" ON public.reportes_mantenimiento;

CREATE POLICY "reportes_tecnico_update"
ON public.reportes_mantenimiento
FOR UPDATE
TO authenticated
USING (
    public.es_tecnico()
    AND tecnico_principal_id = public.tecnico_actual_id()
    AND estado_reporte IN ('en_progreso', 'cerrado')
)
WITH CHECK (
    public.es_tecnico()
    AND tecnico_principal_id = public.tecnico_actual_id()
    AND estado_reporte IN ('en_progreso', 'cerrado')
);

COMMIT;


-- =============================================================================
-- BLOQUE 3 — VERIFICACIÓN POSTERIOR
-- =============================================================================

-- 3.1 No debe quedar ningún reporte en el estado eliminado
SELECT estado_reporte, COUNT(*) AS total
FROM reportes_mantenimiento
GROUP BY estado_reporte
ORDER BY estado_reporte;
-- Esperado: en_progreso, cerrado, anulado. Y 'cerrado' = 1 + 48 = 49.

-- 3.2 Ningún cerrado sin fecha_fin (si sale > 0, no aparecerá en los informes)
SELECT COUNT(*) AS cerrados_sin_fecha_fin
FROM reportes_mantenimiento
WHERE estado_reporte = 'cerrado' AND fecha_fin IS NULL;
-- Esperado: 0

-- 3.3 El dominio nuevo está en su sitio
SELECT conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'reportes_mantenimiento'::regclass
  AND conname IN ('ck_estado_reporte', 'ck_reporte_cerrado_requiere_firma_tecnico');

-- 3.4 El estado eliminado ya no se acepta.
--     Esta sentencia DEBE fallar con violación de ck_estado_reporte.
--     Va envuelta para no dejar nada escrito.
DO $$
BEGIN
    BEGIN
        UPDATE reportes_mantenimiento
        SET estado_reporte = 'pendiente_firma_cliente'
        WHERE id = (SELECT id FROM reportes_mantenimiento LIMIT 1);

        RAISE EXCEPTION 'FALLO: el estado pendiente_firma_cliente todavía se acepta';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK: el estado pendiente_firma_cliente ya no se acepta';
    END;
    RAISE EXCEPTION 'rollback intencional de la comprobación';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Comprobación terminada: %', SQLERRM;
END $$;

-- 3.5 Cierres por mes, para confirmar que el dashboard ya tiene material
SELECT date_trunc('month', fecha_fin)::DATE AS mes, COUNT(*) AS cerrados
FROM reportes_mantenimiento
WHERE estado_reporte = 'cerrado'
GROUP BY 1
ORDER BY 1 DESC;
