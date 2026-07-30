-- =============================================================================
-- Migration: 019_limpiar_policies_huerfanas
-- Description: Elimina policies creadas fuera de las migraciones que siguen
--              autorizando con user_metadata.
--
--   POR QUE
--   La migracion 017 reemplazo las policies de reportes_mantenimiento por su
--   nombre, tomando los nombres de la migracion 006. Pero en la base habia
--   ademas otras cinco policies creadas a mano desde el panel de Supabase, que
--   nunca pasaron por control de versiones:
--
--       admin_ve_todos_reportes         SELECT   user_metadata.rol
--       admin_actualiza_reportes        UPDATE   user_metadata.rol
--       tecnico_ve_sus_reportes         SELECT   auth.uid()
--       tecnico_actualiza_sus_reportes  UPDATE   auth.uid()
--       tecnico_inserta_reportes        INSERT   --
--
--   Las policies de RLS son permisivas y se combinan con OR: basta que UNA
--   conceda acceso. Por eso las dos primeras mantenian abierta la escalada de
--   privilegios que cerro la migracion 014 — cualquier usuario podia ejecutar
--   updateUser({ data: { rol: 'administrador' } }) y obtener lectura y
--   escritura sobre todos los reportes de mantenimiento.
--
--   Las tres de tecnico son redundantes con reportes_tecnico_* de la 017, que
--   expresan las mismas reglas leyendo los roles de la tabla.
--
-- Prerrequisitos: 017
-- Policies que elimina: las cinco listadas arriba
-- =============================================================================


-- ---------------------------------------------------------------------------
-- PASO 0 - VERIFICACION PREVIA (ejecutar solo esto primero)
--
-- Lista TODAS las policies del esquema publico que deciden autorizacion con
-- user_metadata, sin importar en que tabla esten. Guarda el resultado: es la
-- lista de lo que hay que revisar.
-- ---------------------------------------------------------------------------

SELECT
    tablename,
    policyname,
    cmd,
    COALESCE(qual, with_check) AS condicion
FROM pg_policies
WHERE schemaname = 'public'
  AND (COALESCE(qual, '') LIKE '%user_metadata%'
       OR COALESCE(with_check, '') LIKE '%user_metadata%')
ORDER BY tablename, policyname;


-- ---------------------------------------------------------------------------
-- PASO 1 - ELIMINAR LAS POLICIES HUERFANAS
--
-- Las reglas siguen vigentes a traves de reportes_admin_full y
-- reportes_tecnico_* (migracion 017), que leen los roles de usuario_roles.
-- ---------------------------------------------------------------------------

-- reportes_mantenimiento: sustituidas por reportes_admin_full y
-- reportes_tecnico_* de la migracion 017.
DROP POLICY IF EXISTS "admin_ve_todos_reportes"        ON public.reportes_mantenimiento;
DROP POLICY IF EXISTS "admin_actualiza_reportes"       ON public.reportes_mantenimiento;
DROP POLICY IF EXISTS "tecnico_ve_sus_reportes"        ON public.reportes_mantenimiento;
DROP POLICY IF EXISTS "tecnico_actualiza_sus_reportes" ON public.reportes_mantenimiento;
DROP POLICY IF EXISTS "tecnico_inserta_reportes"       ON public.reportes_mantenimiento;

-- tecnicos: las tres de admin quedan cubiertas por tecnicos_admin_full (017).
-- La cuarta permitia a un tecnico ver a los demas tecnicos activos; eso ya lo
-- concede, de forma mas amplia, la policy de lectura de la migracion 002
-- ("Permitir lectura de tecnicos activos a usuarios autenticados").
DROP POLICY IF EXISTS "admin_puede_actualizar_tecnicos"           ON public.tecnicos;
DROP POLICY IF EXISTS "admin_puede_insertar_tecnicos"             ON public.tecnicos;
DROP POLICY IF EXISTS "admin_puede_ver_todos_tecnicos"            ON public.tecnicos;
DROP POLICY IF EXISTS "tecnicos_pueden_ver_otros_tecnicos_activos" ON public.tecnicos;


-- ---------------------------------------------------------------------------
-- PASO 2 - REPORTE FINAL
--
-- El primer bloque debe devolver 0 filas: ninguna policy del esquema publico
-- puede seguir leyendo user_metadata para autorizar.
-- ---------------------------------------------------------------------------

SELECT
    tablename,
    policyname,
    'sigue usando user_metadata' AS problema
FROM pg_policies
WHERE schemaname = 'public'
  AND (COALESCE(qual, '') LIKE '%user_metadata%'
       OR COALESCE(with_check, '') LIKE '%user_metadata%')
ORDER BY tablename, policyname;


-- Y este muestra como quedan las policies de reportes: deben ser exactamente
-- las cuatro de la migracion 017.
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'reportes_mantenimiento'
ORDER BY policyname;
