-- =============================================================================
-- Migration: 010_seguridad_grupos
-- Description: Fase 2 del módulo de seguridad.
--              Crea las tablas de grupos y jerarquías:
--              grupos (equipos de trabajo) y grupo_miembros.
--
-- Prerrequisitos: 008_usuarios_base (tabla 'usuarios' debe existir)
-- Tablas que crea: grupos, grupo_miembros
-- Tablas que modifica: ninguna
-- =============================================================================

-- ─────────────────────────────────────────────
-- 1. GRUPOS
-- Equipos de trabajo — agnósticos al módulo de negocio.
-- Ejemplo: "Equipo Guayaquil", "Equipo Quito"
-- El responsable es un usuario (no necesariamente un técnico).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.grupos (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          TEXT        NOT NULL UNIQUE,
    descripcion     TEXT,
    responsable_id  UUID        REFERENCES public.usuarios(id) ON DELETE SET NULL,
    activo          BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grupos_responsable
    ON public.grupos(responsable_id) WHERE responsable_id IS NOT NULL;

CREATE TRIGGER trg_grupos_updated_at
    BEFORE UPDATE ON public.grupos
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

COMMENT ON TABLE public.grupos IS
    'Equipos de trabajo del sistema. Agnósticos al módulo de negocio. Cada grupo tiene un responsable y múltiples miembros.';

-- ─────────────────────────────────────────────
-- 2. GRUPO_MIEMBROS
-- Usuarios que pertenecen a un grupo.
-- Un usuario puede pertenecer a múltiples grupos.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.grupo_miembros (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id    UUID        NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
    usuario_id  UUID        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(grupo_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_grupo_miembros_grupo
    ON public.grupo_miembros(grupo_id);
CREATE INDEX IF NOT EXISTS idx_grupo_miembros_usuario
    ON public.grupo_miembros(usuario_id);

COMMENT ON TABLE public.grupo_miembros IS
    'Membresía de usuarios en grupos de trabajo. Un usuario puede pertenecer a múltiples grupos.';
