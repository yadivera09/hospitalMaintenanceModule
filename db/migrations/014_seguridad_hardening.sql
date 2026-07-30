-- =============================================================================
-- Migration: 014_seguridad_hardening
-- Description: Cierra la escalada de privilegios vía user_metadata.
--
--   PROBLEMA
--   Las policies de 012_seguridad_rls.sql deciden quién es administrador con
--       auth.jwt() -> 'user_metadata' ->> 'rol' = 'administrador'
--   y el código hacía el mismo fallback (permisos.ts). Pero user_metadata lo
--   escribe el PROPIO usuario:
--       supabase.auth.updateUser({ data: { rol: 'administrador' } })
--   Cualquier usuario autenticado podía auto-ascenderse a admin desde la
--   consola del navegador y abrir las RLS de usuarios, usuario_roles y auditoria.
--
--   SOLUCIÓN
--   Toda decisión de autorización pasa a leerse de usuario_roles → roles, que
--   solo se escribe con service_role desde /admin/seguridad/usuarios.
--
-- Prerrequisitos: 008, 009, 010, 011, 012, 013
-- Objetos que crea: es_administrador(), usuario_actual_id()
-- Tablas que modifica: usuarios (INSERT backfill), usuario_roles (INSERT backfill)
-- Policies que reemplaza: usuarios_select, usuario_roles_select, auditoria_select
--
-- ORDEN DE APLICACIÓN
--   1. Ejecutar el paso 0 (verificación previa) y revisar el resultado.
--   2. Ejecutar el resto del archivo.
--   3. Ejecutar el paso 5 (reporte final) y confirmar que la lista está vacía.
--   4. Recién entonces desplegar el código de la Fase 1.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 0 — VERIFICACIÓN PREVIA (ejecutar solo esto primero)
--
-- Lista los usuarios que hoy dependen del fallback de user_metadata y que, sin
-- el backfill de los pasos 1 y 2, perderían el acceso al desplegar la Fase 1.
-- Es informativo: no modifica nada.
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
    au.email,
    au.raw_user_meta_data ->> 'rol'        AS rol_en_metadata,
    u.id IS NOT NULL                       AS tiene_fila_usuarios,
    COALESCE(u.activo, false)              AS cuenta_activa,
    COUNT(ur.id) FILTER (WHERE ur.activo)  AS roles_activos_en_tabla
FROM auth.users au
LEFT JOIN public.usuarios      u  ON u.user_id = au.id
LEFT JOIN public.usuario_roles ur ON ur.usuario_id = u.id
GROUP BY au.email, au.raw_user_meta_data, u.id, u.activo
HAVING COUNT(ur.id) FILTER (WHERE ur.activo) = 0
ORDER BY au.email;


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 1 — BACKFILL DE IDENTIDADES
--
-- La migración 008 pobló 'usuarios' solo desde 'tecnicos'. Cualquier cuenta de
-- auth.users sin perfil técnico quedó sin fila y, a partir de la Fase 1, sin
-- fila = sin acceso (fail-closed). Se crean las que falten.
--
-- Los nombres se toman de user_metadata cuando existe; user_metadata sigue
-- siendo válido como DATO DESCRIPTIVO, lo que se prohíbe es usarlo para AUTORIZAR.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.usuarios (user_id, nombre, apellido, email, activo)
SELECT
    au.id,
    COALESCE(NULLIF(trim(au.raw_user_meta_data ->> 'nombre'), ''), split_part(au.email, '@', 1)),
    COALESCE(NULLIF(trim(au.raw_user_meta_data ->> 'apellido'), ''), '—'),
    au.email,
    true
FROM auth.users au
WHERE au.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.user_id = au.id)
  AND NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE lower(u.email) = lower(au.email))
ON CONFLICT (user_id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 2 — BACKFILL DE ROLES
--
-- Migra a usuario_roles el rol que hoy vive en user_metadata, para los usuarios
-- que aún no tienen ningún rol activo en la tabla. Es la última vez que se lee
-- user_metadata.rol: después de esto deja de tener efecto sobre el acceso.
--
-- Solo migra roles que existen en el catálogo. Un metadata con un rol
-- inventado no crea nada — el usuario aparecerá en el reporte del paso 5.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.usuario_roles (usuario_id, rol_id, activo)
SELECT DISTINCT
    u.id,
    r.id,
    true
FROM public.usuarios u
JOIN auth.users   au ON au.id = u.user_id
JOIN public.roles r  ON r.nombre = au.raw_user_meta_data ->> 'rol'
WHERE NOT EXISTS (
    SELECT 1 FROM public.usuario_roles ur
    WHERE ur.usuario_id = u.id AND ur.activo
)
ON CONFLICT (usuario_id, rol_id) DO UPDATE SET activo = true;


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 3 — FUNCIONES DE AUTORIZACIÓN
--
-- SECURITY DEFINER es imprescindible: la función se invoca DESDE las policies
-- de public.usuarios, así que si se ejecutara con RLS activo se llamaría a sí
-- misma en bucle infinito. Al correr como owner de la tabla, la RLS no aplica.
--
-- search_path fijo: evita que un search_path manipulado redirija las tablas
-- a un esquema controlado por el atacante (riesgo clásico de SECURITY DEFINER).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.usuario_actual_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT id FROM public.usuarios WHERE user_id = auth.uid() AND activo;
$$;

CREATE OR REPLACE FUNCTION public.es_administrador()
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
          AND r.nombre = 'administrador'
    );
$$;

GRANT EXECUTE ON FUNCTION public.usuario_actual_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_administrador()  TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 4 — REEMPLAZO DE POLICIES
--
-- Mismas reglas de negocio que en 012 (dato propio + admins ven todo), pero
-- la condición de admin ahora sale de la tabla, no del JWT.
-- ─────────────────────────────────────────────────────────────────────────────

-- 4.1 usuarios — perfil propio + admins ven todos
DROP POLICY IF EXISTS "usuarios_select" ON public.usuarios;

CREATE POLICY "usuarios_select" ON public.usuarios
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR public.es_administrador()
    );

-- 4.2 usuario_roles — propios + admins
DROP POLICY IF EXISTS "usuario_roles_select" ON public.usuario_roles;

CREATE POLICY "usuario_roles_select" ON public.usuario_roles
    FOR SELECT TO authenticated
    USING (
        usuario_id = public.usuario_actual_id()
        OR public.es_administrador()
    );

-- 4.3 auditoria — propios + admins
DROP POLICY IF EXISTS "auditoria_select" ON public.auditoria;

CREATE POLICY "auditoria_select" ON public.auditoria
    FOR SELECT TO authenticated
    USING (
        usuario_id = public.usuario_actual_id()
        OR public.es_administrador()
    );

-- NOTA: se mantiene el diseño de 012 — ninguna policy INSERT/UPDATE/DELETE para
-- 'authenticated'. Toda escritura sigue yendo por service_role desde las server
-- actions, que ahora validan el rol con requireAdmin() (src/lib/seguridad/guard.ts).


-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 5 — REPORTE FINAL (ejecutar y confirmar que no devuelve filas)
--
-- Cualquier fila aquí es una cuenta que quedará SIN acceso al desplegar la
-- Fase 1. Asignarle un rol desde /admin/seguridad/usuarios antes de desplegar,
-- o confirmar que es una cuenta que debe quedar fuera.
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
    au.email,
    au.raw_user_meta_data ->> 'rol' AS rol_en_metadata,
    CASE
        WHEN u.id IS NULL     THEN 'sin fila en usuarios'
        WHEN NOT u.activo     THEN 'cuenta desactivada'
        ELSE                       'sin rol asignado'
    END AS motivo
FROM auth.users au
LEFT JOIN public.usuarios u ON u.user_id = au.id
WHERE u.id IS NULL
   OR NOT u.activo
   OR NOT EXISTS (
        SELECT 1 FROM public.usuario_roles ur
        WHERE ur.usuario_id = u.id AND ur.activo
   )
ORDER BY au.email;
