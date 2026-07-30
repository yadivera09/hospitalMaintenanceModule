-- =============================================================================
-- Migration: 020_rls_por_permisos
-- Description: Hace que RLS entienda la matriz de permisos, no solo los dos
--              roles historicos.
--
--   PROBLEMA
--   La migracion 018 conecto la matriz rol -> modulo -> permiso a la capa de
--   aplicacion: middleware, server actions y interfaz. Pero las policies de
--   reportes_mantenimiento siguen preguntando "eres administrador?" o "eres
--   tecnico?". Un rol nuevo (por ejemplo supervisor) con permiso 'ver' sobre
--   /admin/reportes no encaja en ninguna de las dos, y la base le devuelve
--   cero filas sin error.
--
--   Se manifiesta en todo lo que lee reportes con el cliente sujeto a RLS:
--   el historial de mantenimientos en la ficha del equipo, el ultimo
--   preventivo, la pantalla de analisis y los indicadores del dashboard.
--   Todo aparece vacio, como si el equipo no tuviera historial.
--
--   SOLUCION
--   Una funcion que responde la misma pregunta que hace la aplicacion —
--   "tiene este usuario tal permiso sobre tal modulo?" — y una policy de
--   lectura que la usa. Las policies son permisivas y se combinan con OR, asi
--   que esto AÑADE acceso a quien lo tenga concedido, sin quitarselo a nadie.
--
-- Prerrequisitos: 014 (es_administrador), 017, 018 (matriz sembrada)
-- Objetos que crea: tiene_permiso(text, text)
-- Policies que crea: reportes_ver_por_permiso
-- =============================================================================


-- ---------------------------------------------------------------------------
-- PASO 0 - CONTEXTO (ejecutar solo esto primero)
--
-- Muestra que tablas tienen RLS activo. Solo esas filtran por policy; en el
-- resto, la aplicacion es la unica que autoriza.
-- ---------------------------------------------------------------------------

SELECT
    c.relname AS tabla,
    c.relrowsecurity AS rls_activo,
    COUNT(p.policyname) AS policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public' AND c.relkind = 'r'
GROUP BY c.relname, c.relrowsecurity
HAVING c.relrowsecurity
ORDER BY c.relname;


-- ---------------------------------------------------------------------------
-- PASO 1 - FUNCION DE CONSULTA DE LA MATRIZ
--
-- Mismo diseno que es_administrador() y es_tecnico(): SECURITY DEFINER para
-- no recursar contra las policies, y search_path fijo.
--
-- Recorre el mismo camino que permisosUsuario() en la aplicacion:
--   usuarios -> usuario_roles -> roles -> rol_permisos_modulo -> modulos
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tiene_permiso(p_modulo_url TEXT, p_permiso TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.usuarios             u
        JOIN public.usuario_roles       ur ON ur.usuario_id = u.id AND ur.activo
        JOIN public.roles                r ON r.id  = ur.rol_id    AND r.activo
        JOIN public.rol_permisos_modulo rpm ON rpm.rol_id = r.id   AND rpm.activo
        JOIN public.modulos              m ON m.id  = rpm.modulo_id AND m.activo
        JOIN public.permisos             p ON p.id  = rpm.permiso_id
        WHERE u.user_id = auth.uid()
          AND u.activo
          AND m.url    = p_modulo_url
          AND p.codigo = p_permiso
    );
$$;

GRANT EXECUTE ON FUNCTION public.tiene_permiso(TEXT, TEXT) TO authenticated;


-- ---------------------------------------------------------------------------
-- PASO 2 - LECTURA DE REPORTES POR PERMISO
--
-- Quien tenga 'ver' sobre /admin/reportes puede leerlos todos. Es lo que ya
-- concede el middleware al dejarlo entrar a esa pantalla; aqui solo se hace
-- que la base opine lo mismo.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "reportes_ver_por_permiso" ON public.reportes_mantenimiento;

CREATE POLICY "reportes_ver_por_permiso"
ON public.reportes_mantenimiento
FOR SELECT
TO authenticated
USING (public.tiene_permiso('/admin/reportes', 'ver'));


-- ---------------------------------------------------------------------------
-- PASO 3 - REPORTE FINAL
--
-- Comprueba que rol por rol se concede lo esperado. La columna
-- 've_reportes' debe ser true para administrador y para cualquier rol al que
-- se le haya dado 'ver' sobre /admin/reportes.
-- ---------------------------------------------------------------------------

SELECT
    r.nombre AS rol,
    bool_or(m.url = '/admin/reportes' AND p.codigo = 'ver') AS ve_reportes
FROM public.roles r
LEFT JOIN public.rol_permisos_modulo rpm ON rpm.rol_id = r.id AND rpm.activo
LEFT JOIN public.modulos  m ON m.id = rpm.modulo_id
LEFT JOIN public.permisos p ON p.id = rpm.permiso_id
GROUP BY r.nombre
ORDER BY r.nombre;
