-- =============================================================================
-- Migration: 013_seguridad_seed
-- Description: Datos iniciales del módulo de seguridad + migración de roles
--              desde user_metadata.rol de auth.users a la tabla usuario_roles.
--
-- Prerrequisitos: 008, 009, 010, 011, 012 (todas las tablas y RLS)
-- Tablas que modifica (INSERT): roles, permisos, menus, usuario_roles
-- =============================================================================

-- ─────────────────────────────────────────────
-- 1. ROLES BASE DEL SISTEMA
-- es_sistema = true → no se pueden eliminar desde la UI
-- ─────────────────────────────────────────────
INSERT INTO public.roles (nombre, descripcion, es_sistema) VALUES
    ('administrador', 'Acceso completo al sistema',               true),
    ('tecnico',       'Técnico de mantenimiento estándar',        true),
    ('supervisor',    'Supervisa técnicos y reportes, sin admin', false)
ON CONFLICT (nombre) DO NOTHING;

-- ─────────────────────────────────────────────
-- 2. PERMISOS BASE
-- Acciones que se pueden asignar sobre cada módulo.
-- ─────────────────────────────────────────────
INSERT INTO public.permisos (codigo, nombre, descripcion) VALUES
    ('ver',      'Ver',      'Acceso de lectura al módulo'),
    ('crear',    'Crear',    'Crear nuevos registros'),
    ('editar',   'Editar',   'Modificar registros existentes'),
    ('eliminar', 'Eliminar', 'Eliminar registros'),
    ('exportar', 'Exportar', 'Exportar datos a PDF/Excel'),
    ('anular',   'Anular',   'Anular reportes o registros')
ON CONFLICT (codigo) DO NOTHING;

-- ─────────────────────────────────────────────
-- 3. MENÚS BASE
-- Grupos de navegación del sistema.
-- ─────────────────────────────────────────────
INSERT INTO public.menus (nombre, icono, orden) VALUES
    ('Operaciones',    'bi bi-tools',       1),
    ('Administración', 'bi bi-gear',        2),
    ('Seguridad',      'bi bi-shield-lock', 3)
ON CONFLICT (nombre) DO NOTHING;

-- ─────────────────────────────────────────────
-- 4. MIGRAR ROLES EXISTENTES
-- Poblar usuario_roles desde la metadata de auth.users.
-- Cada técnico con user_id obtiene un rol en la tabla nueva
-- basado en su user_metadata.rol actual.
-- Si no tiene rol en metadata, se asigna 'tecnico' por defecto.
-- ─────────────────────────────────────────────
INSERT INTO public.usuario_roles (usuario_id, rol_id)
SELECT
    u.id        AS usuario_id,
    r.id        AS rol_id
FROM public.tecnicos t
JOIN public.usuarios u  ON u.user_id = t.user_id
JOIN auth.users au      ON au.id = t.user_id
JOIN public.roles r     ON r.nombre = COALESCE(
    au.raw_user_meta_data ->> 'rol',
    'tecnico'
)
WHERE t.user_id IS NOT NULL
ON CONFLICT (usuario_id, rol_id) DO NOTHING;
