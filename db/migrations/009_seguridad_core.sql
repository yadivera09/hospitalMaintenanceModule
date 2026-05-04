-- =============================================================================
-- Migration: 009_seguridad_core
-- Description: Fase 1 del módulo de seguridad.
--              Crea las tablas core del sistema RBAC:
--              menus, modulos, roles, permisos, rol_permisos_modulo, usuario_roles.
--
-- Prerrequisitos: 008_usuarios_base (tabla 'usuarios' debe existir)
-- Tablas que crea: menus, modulos, roles, permisos, rol_permisos_modulo, usuario_roles
-- Tablas que modifica: ninguna
-- =============================================================================

-- ─────────────────────────────────────────────
-- 1. MENUS
-- Grupos de navegación del sistema.
-- Ejemplos: "Operaciones", "Administración", "Seguridad"
-- Cada menú agrupa módulos (pantallas) relacionados.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.menus (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      TEXT        NOT NULL UNIQUE,
    icono       TEXT        NOT NULL DEFAULT 'bi bi-grid',
    orden       SMALLINT    NOT NULL DEFAULT 0,
    activo      BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_menus_updated_at
    BEFORE UPDATE ON public.menus
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

COMMENT ON TABLE public.menus IS
    'Grupos de navegación del sistema. Cada menú contiene uno o más módulos (pantallas).';

-- ─────────────────────────────────────────────
-- 2. MODULOS
-- Pantallas específicas agrupadas por menú.
-- Ejemplos: "Nuevo Reporte", "Dashboard Mantenimiento", "Lista Equipos"
-- La columna 'url' es la ruta del App Router de Next.js.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.modulos (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id     UUID        NOT NULL REFERENCES public.menus(id) ON DELETE RESTRICT,
    nombre      TEXT        NOT NULL,
    url         TEXT        NOT NULL UNIQUE,
    descripcion TEXT,
    icono       TEXT        NOT NULL DEFAULT 'bi bi-x-octagon',
    orden       SMALLINT    NOT NULL DEFAULT 0,
    activo      BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modulos_menu_id ON public.modulos(menu_id);

CREATE TRIGGER trg_modulos_updated_at
    BEFORE UPDATE ON public.modulos
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

COMMENT ON TABLE public.modulos IS
    'Pantallas específicas del sistema. Cada módulo tiene una URL única y pertenece a un menú.';

-- ─────────────────────────────────────────────
-- 3. ROLES
-- Reemplaza el user_metadata.rol hardcodeado en auth.users.
-- Ejemplos: "administrador", "tecnico", "supervisor", "contador_readonly"
-- Roles con es_sistema = true no se pueden eliminar desde la UI.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roles (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      TEXT        NOT NULL UNIQUE,
    descripcion TEXT,
    es_sistema  BOOLEAN     NOT NULL DEFAULT false,
    activo      BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_roles_updated_at
    BEFORE UPDATE ON public.roles
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

COMMENT ON TABLE public.roles IS
    'Roles del sistema. Reemplaza user_metadata.rol hardcodeado. es_sistema=true impide eliminación.';

-- ─────────────────────────────────────────────
-- 4. PERMISOS
-- Acciones posibles sobre cualquier módulo.
-- Catálogo fijo: ver, crear, editar, eliminar, exportar, anular.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.permisos (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo      TEXT        NOT NULL UNIQUE,
    nombre      TEXT        NOT NULL,
    descripcion TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.permisos IS
    'Acciones posibles sobre un módulo: ver, crear, editar, eliminar, exportar, anular.';

-- ─────────────────────────────────────────────
-- 5. ROL_PERMISOS_MODULO (TABLA UNIFICADA)
-- Qué permisos tiene cada rol sobre cada módulo.
-- Tabla única con clave compuesta — sin tablas intermedias adicionales.
-- Ejemplo: rol "tecnico" tiene permiso "ver" sobre módulo "/tecnico/reportes".
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rol_permisos_modulo (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    rol_id      UUID        NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    modulo_id   UUID        NOT NULL REFERENCES public.modulos(id) ON DELETE CASCADE,
    permiso_id  UUID        NOT NULL REFERENCES public.permisos(id) ON DELETE CASCADE,
    activo      BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(rol_id, modulo_id, permiso_id)
);

-- Índices parciales para queries frecuentes (solo registros activos)
CREATE INDEX IF NOT EXISTS idx_rol_permisos_rol
    ON public.rol_permisos_modulo(rol_id) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_rol_permisos_modulo
    ON public.rol_permisos_modulo(modulo_id) WHERE activo = true;

COMMENT ON TABLE public.rol_permisos_modulo IS
    'Matriz de permisos: qué acciones puede realizar cada rol sobre cada módulo. Tabla unificada con clave compuesta (rol_id, modulo_id, permiso_id).';

-- ─────────────────────────────────────────────
-- 6. USUARIO_ROLES
-- Un usuario puede tener múltiples roles.
-- Ejemplo: un contador puede tener rol 'ver_mantenimiento' sin ser técnico.
-- Apunta a 'usuarios' (genérico), no a 'tecnicos' (perfil de negocio).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usuario_roles (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  UUID        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    rol_id      UUID        NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    activo      BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(usuario_id, rol_id)
);

-- Índice parcial para búsquedas frecuentes de roles activos de un usuario
CREATE INDEX IF NOT EXISTS idx_usuario_roles_usuario
    ON public.usuario_roles(usuario_id) WHERE activo = true;

COMMENT ON TABLE public.usuario_roles IS
    'Asignación de roles a usuarios. Un usuario puede tener múltiples roles. El cálculo de permisos hace OR entre todos los roles activos.';
