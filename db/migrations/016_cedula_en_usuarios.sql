-- =============================================================================
-- Migration: 016_cedula_en_usuarios
-- Description: Mueve la cedula a la identidad y prepara el perfil tecnico
--              para poder crearse automaticamente.
--
--   POR QUE
--   La cedula identifica a la PERSONA, no a su rol de tecnico. Estaba solo en
--   'tecnicos', asi que un usuario dado de alta desde Seguridad no podia tener
--   cedula, y al asignarle el rol 'tecnico' su ficha habria nacido incompleta.
--
--   Con la cedula en 'usuarios', la ficha de tecnico deja de contener datos
--   propios: es un id referenciado por los reportes mas un flag de
--   disponibilidad. Eso permite crearla automaticamente al asignar el rol,
--   copiando todo desde la identidad, sin generar registros a medias.
--
--   Las columnas duplicadas de 'tecnicos' (nombre, apellido, email, telefono,
--   cedula) se mantienen por ahora: 14 consultas de reportes, dashboard,
--   analisis y cache offline las leen. Se sincronizan desde la aplicacion.
--   Eliminarlas es un trabajo aparte.
--
-- Prerrequisitos: 008, 014, 015
-- Tablas que modifica: usuarios (agrega cedula)
-- =============================================================================


-- ---------------------------------------------------------------------------
-- PASO 0 - VERIFICACION PREVIA (ejecutar solo esto primero)
--
-- Busca cedulas duplicadas entre tecnicos. La columna nueva es UNIQUE, asi que
-- si hay repetidas el backfill fallaria. Lo normal es que no devuelva filas.
-- ---------------------------------------------------------------------------

SELECT cedula, COUNT(*) AS veces, string_agg(email, ', ') AS afectados
FROM public.tecnicos
WHERE cedula IS NOT NULL AND trim(cedula) <> ''
GROUP BY cedula
HAVING COUNT(*) > 1;


-- ---------------------------------------------------------------------------
-- PASO 1 - COLUMNA EN LA IDENTIDAD
--
-- Nullable: no toda persona del sistema tiene por que tener cedula cargada.
-- UNIQUE para impedir dos identidades con el mismo documento.
-- ---------------------------------------------------------------------------

ALTER TABLE public.usuarios
    ADD COLUMN IF NOT EXISTS cedula TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_cedula
    ON public.usuarios (cedula)
    WHERE cedula IS NOT NULL;


-- ---------------------------------------------------------------------------
-- PASO 2 - BACKFILL DESDE TECNICOS
-- ---------------------------------------------------------------------------

UPDATE public.usuarios u
SET cedula = NULLIF(trim(t.cedula), '')
FROM public.tecnicos t
WHERE (u.id = t.usuario_id OR u.user_id = t.user_id)
  AND u.cedula IS NULL
  AND NULLIF(trim(t.cedula), '') IS NOT NULL;


-- ---------------------------------------------------------------------------
-- PASO 3 - VINCULAR FICHAS HUERFANAS
--
-- La aplicacion busca la ficha por usuario_id. Cualquier fila de 'tecnicos'
-- que quedara sin vincular seria invisible para la sincronizacion de perfiles
-- y provocaria un alta duplicada. Se completa el enlace por user_id.
-- ---------------------------------------------------------------------------

UPDATE public.tecnicos t
SET usuario_id = u.id
FROM public.usuarios u
WHERE t.usuario_id IS NULL
  AND t.user_id = u.user_id;


-- ---------------------------------------------------------------------------
-- PASO 4 - REPORTE FINAL
--
-- Debe devolver 0 filas. Cualquier fila es una ficha de tecnico que no se
-- pudo enlazar con una identidad: normalmente son registros antiguos sin
-- cuenta de acceso (user_id nulo), que no participan del flujo de roles.
-- ---------------------------------------------------------------------------

SELECT
    t.email,
    t.cedula,
    t.user_id IS NULL AS sin_cuenta_de_acceso,
    'ficha sin identidad vinculada' AS motivo
FROM public.tecnicos t
WHERE t.usuario_id IS NULL
ORDER BY t.email;
