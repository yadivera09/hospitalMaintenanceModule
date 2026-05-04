-- =============================================================================
-- Migration: 008_usuarios_base
-- Description: Fase 0 del módulo de seguridad.
--              Crea la tabla genérica 'usuarios' como base transversal del sistema.
--              Pobla usuarios desde la tabla 'tecnicos' existente.
--              Agrega columna 'usuario_id' a 'tecnicos' para vincular ambos mundos.
--
-- Prerrequisitos: Todas las migraciones 001-007 aplicadas.
-- Tablas que crea: usuarios
-- Tablas que modifica: tecnicos (agrega columna usuario_id)
-- =============================================================================

-- ─────────────────────────────────────────────
-- 1. TABLA USUARIOS
-- El "humano" del sistema. Agnóstico al módulo de negocio.
-- Supabase Auth maneja la autenticación; esta tabla maneja
-- el perfil del sistema (nombre, estado, metadata).
--
-- Arquitectura:
--   auth.users  (autenticación)
--        ↓
--    usuarios   (identidad genérica — roles y permisos van aquí)
--        ↓              ↓              ↓
--    tecnicos      vendedores      contadores   ... (perfiles de negocio)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usuarios (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre      TEXT        NOT NULL,
    apellido    TEXT        NOT NULL,
    email       TEXT        NOT NULL UNIQUE,
    telefono    TEXT,
    imagen_url  TEXT,
    activo      BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_usuarios_user_id ON public.usuarios(user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email   ON public.usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo  ON public.usuarios(activo) WHERE activo = true;

-- Trigger para mantener updated_at automático (reutiliza fn_set_updated_at existente)
CREATE TRIGGER trg_usuarios_updated_at
    BEFORE UPDATE ON public.usuarios
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

COMMENT ON TABLE public.usuarios IS
    'Tabla genérica de usuarios del sistema. Base transversal para roles, permisos y auditoría. Los perfiles de negocio (tecnicos, vendedores, etc.) apuntan aquí via usuario_id.';

-- ─────────────────────────────────────────────
-- 2. POBLAR USUARIOS DESDE TECNICOS EXISTENTES
-- Crea un registro en 'usuarios' por cada técnico que tenga user_id.
-- ON CONFLICT protege contra ejecución duplicada.
-- ─────────────────────────────────────────────
INSERT INTO public.usuarios (user_id, nombre, apellido, email, telefono, activo)
SELECT
    t.user_id,
    t.nombre,
    t.apellido,
    t.email,
    t.telefono,
    t.activo
FROM public.tecnicos t
WHERE t.user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 3. AGREGAR COLUMNA usuario_id A TECNICOS
-- Vincula el perfil de negocio (técnico) con la identidad genérica (usuario).
-- No se hace NOT NULL todavía — se hará en Fase 5 tras verificar en producción.
-- ─────────────────────────────────────────────
ALTER TABLE public.tecnicos
    ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- Índice para búsquedas frecuentes por usuario_id en tecnicos
CREATE INDEX IF NOT EXISTS idx_tecnicos_usuario_id ON public.tecnicos(usuario_id)
    WHERE usuario_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- 4. ACTUALIZAR tecnicos.usuario_id CON LOS REGISTROS RECIÉN CREADOS
-- Establece la relación entre cada técnico y su registro en 'usuarios'.
-- ─────────────────────────────────────────────
UPDATE public.tecnicos t
SET usuario_id = u.id
FROM public.usuarios u
WHERE u.user_id = t.user_id
  AND t.usuario_id IS NULL;

COMMENT ON COLUMN public.tecnicos.usuario_id IS
    'FK a la tabla genérica de usuarios del sistema. En Fase 5 será NOT NULL y reemplazará user_id.';
