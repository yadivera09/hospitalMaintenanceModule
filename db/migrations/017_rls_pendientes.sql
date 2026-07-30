-- =============================================================================
-- Migration: 017_rls_pendientes
-- Description: Termina el trabajo de 014. Reemplaza las policies que seguian
--              decidiendo autorizacion con user_metadata.rol en las tablas
--              'tecnicos' y 'reportes_mantenimiento'.
--
--   POR QUE FALTABAN
--   La migracion 014 corrigio las policies creadas en 012 (usuarios,
--   usuario_roles, auditoria), pero las de 'tecnicos' (migracion 002) y
--   'reportes_mantenimiento' (migracion 006) son anteriores y usan el mismo
--   patron. Quedaron sin cubrir.
--
--   IMPACTO DE SEGURIDAD
--   Identico al que cerro 014: user_metadata lo escribe el propio usuario, asi
--   que cualquiera podia ejecutar
--       supabase.auth.updateUser({ data: { rol: 'administrador' } })
--   y obtener acceso total de escritura sobre tecnicos y sobre todos los
--   reportes de mantenimiento.
--
--   IMPACTO FUNCIONAL
--   Ademas ya estaba rompiendo la aplicacion: updateTecnico usa el cliente
--   sujeto a RLS, y su UPDATE afectaba 0 filas cuando el JWT del administrador
--   no traia el rol en la metadata, con el error PGRST116 'The result contains
--   0 rows' presentado como "Error al actualizar el tecnico".
--
-- Prerrequisitos: 002, 006, 014 (usa public.es_administrador)
-- Policies que reemplaza:
--   tecnicos: "Administradores tienen acceso total a tecnicos"
--   reportes_mantenimiento: Admin_Full_Access, Tecnico_Select_Own,
--                           Tecnico_Insert_Own, Tecnico_Update_Own
-- Objetos que crea: es_tecnico(), tecnico_actual_id()
-- =============================================================================


-- ---------------------------------------------------------------------------
-- PASO 1 - FUNCIONES DE APOYO
--
-- Mismo diseno que es_administrador() en 014: SECURITY DEFINER para no
-- recursar contra las policies, y search_path fijo.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.es_tecnico()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.usuarios       u
        JOIN public.usuario_roles ur ON ur.usuario_id = u.id AND ur.activo
        JOIN public.roles          r ON r.id = ur.rol_id     AND r.activo
        WHERE u.user_id = auth.uid()
          AND u.activo
          AND r.nombre = 'tecnico'
    );
$$;

-- tecnicos.id del usuario autenticado. Se usa en las policies de reportes,
-- que referencian la ficha y no la identidad.
CREATE OR REPLACE FUNCTION public.tecnico_actual_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT id FROM public.tecnicos WHERE user_id = auth.uid() AND activo;
$$;

GRANT EXECUTE ON FUNCTION public.es_tecnico()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.tecnico_actual_id() TO authenticated;


-- ---------------------------------------------------------------------------
-- PASO 2 - TECNICOS
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Administradores tienen acceso total a tecnicos" ON public.tecnicos;

CREATE POLICY "tecnicos_admin_full"
ON public.tecnicos
FOR ALL
TO authenticated
USING (public.es_administrador())
WITH CHECK (public.es_administrador());

-- Se conserva la policy de lectura de 002: cualquier autenticado ve a los
-- tecnicos activos, necesario para elegir tecnicos de apoyo en un reporte.


-- ---------------------------------------------------------------------------
-- PASO 3 - REPORTES DE MANTENIMIENTO
--
-- Se mantienen exactamente las mismas reglas de negocio de 006; solo cambia
-- de donde sale el rol.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admin_Full_Access"   ON public.reportes_mantenimiento;
DROP POLICY IF EXISTS "Tecnico_Select_Own"  ON public.reportes_mantenimiento;
DROP POLICY IF EXISTS "Tecnico_Insert_Own"  ON public.reportes_mantenimiento;
DROP POLICY IF EXISTS "Tecnico_Update_Own"  ON public.reportes_mantenimiento;

CREATE POLICY "reportes_admin_full"
ON public.reportes_mantenimiento
FOR ALL
TO authenticated
USING (public.es_administrador())
WITH CHECK (public.es_administrador());

CREATE POLICY "reportes_tecnico_select"
ON public.reportes_mantenimiento
FOR SELECT
TO authenticated
USING (
    public.es_tecnico()
    AND (
        tecnico_principal_id = public.tecnico_actual_id()
        OR id IN (
            SELECT reporte_id FROM public.reporte_tecnicos
            WHERE tecnico_id = public.tecnico_actual_id()
        )
    )
);

CREATE POLICY "reportes_tecnico_insert"
ON public.reportes_mantenimiento
FOR INSERT
TO authenticated
WITH CHECK (
    public.es_tecnico()
    AND tecnico_principal_id = public.tecnico_actual_id()
);

CREATE POLICY "reportes_tecnico_update"
ON public.reportes_mantenimiento
FOR UPDATE
TO authenticated
USING (
    public.es_tecnico()
    AND tecnico_principal_id = public.tecnico_actual_id()
    AND estado_reporte IN ('en_progreso', 'pendiente_firma_cliente')
)
WITH CHECK (
    public.es_tecnico()
    AND tecnico_principal_id = public.tecnico_actual_id()
    AND estado_reporte IN ('en_progreso', 'pendiente_firma_cliente', 'cerrado')
);


-- ---------------------------------------------------------------------------
-- PASO 4 - REPORTE FINAL
--
-- Debe devolver 0 filas: ninguna policy del esquema publico debe seguir
-- leyendo user_metadata para decidir autorizacion.
-- ---------------------------------------------------------------------------

SELECT
    schemaname,
    tablename,
    policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND (COALESCE(qual, '') LIKE '%user_metadata%'
       OR COALESCE(with_check, '') LIKE '%user_metadata%')
ORDER BY tablename, policyname;
