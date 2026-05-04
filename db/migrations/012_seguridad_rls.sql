-- =============================================================================
-- Migration: 012_seguridad_rls
-- Description: RLS policies para todas las tablas del módulo de seguridad.
--
-- Diseño de acceso:
--   - Catálogos (menus, modulos, roles, permisos, rol_permisos_modulo):
--     lectura abierta a autenticados (el middleware los necesita).
--   - usuario_roles: un usuario ve sus propios roles + admins ven todos.
--   - auditoria: un usuario ve sus propios registros + admins ven todos.
--   - usuarios: perfil propio + admins ven todos.
--   - grupos/grupo_miembros: lectura autenticada.
--   - Escritura en TODAS: solo via service_role (createAdminClient).
--
-- Prerrequisitos: 008, 009, 010, 011
-- Tablas que modifica: usuarios, roles, modulos, menus, permisos,
--   rol_permisos_modulo, usuario_roles, grupos, grupo_miembros, auditoria
-- =============================================================================

-- 1. HABILITAR RLS
ALTER TABLE public.usuarios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modulos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permisos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rol_permisos_modulo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_miembros      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria           ENABLE ROW LEVEL SECURITY;

-- 2. CATÁLOGOS — LECTURA PARA AUTENTICADOS
CREATE POLICY "menus_select_authenticated" ON public.menus
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "modulos_select_authenticated" ON public.modulos
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "roles_select_authenticated" ON public.roles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "permisos_select_authenticated" ON public.permisos
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "rol_permisos_select_authenticated" ON public.rol_permisos_modulo
    FOR SELECT TO authenticated USING (true);

-- 3. USUARIOS — PERFIL PROPIO + ADMINS VEN TODOS
CREATE POLICY "usuarios_select" ON public.usuarios
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR (SELECT (auth.jwt() -> 'user_metadata' ->> 'rol')) = 'administrador'
    );

-- 4. USUARIO_ROLES — PROPIOS + ADMINS
CREATE POLICY "usuario_roles_select" ON public.usuario_roles
    FOR SELECT TO authenticated
    USING (
        usuario_id IN (SELECT id FROM public.usuarios WHERE user_id = auth.uid())
        OR (SELECT (auth.jwt() -> 'user_metadata' ->> 'rol')) = 'administrador'
    );

-- 5. AUDITORIA — PROPIOS + ADMINS
CREATE POLICY "auditoria_select" ON public.auditoria
    FOR SELECT TO authenticated
    USING (
        usuario_id IN (SELECT id FROM public.usuarios WHERE user_id = auth.uid())
        OR (SELECT (auth.jwt() -> 'user_metadata' ->> 'rol')) = 'administrador'
    );

-- 6. GRUPOS — LECTURA AUTENTICADA
CREATE POLICY "grupos_select_authenticated" ON public.grupos
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "grupo_miembros_select_authenticated" ON public.grupo_miembros
    FOR SELECT TO authenticated USING (true);

-- NOTA: No se crean policies INSERT/UPDATE/DELETE para 'authenticated'.
-- Toda escritura va via createAdminClient() (service_role) en server actions.
