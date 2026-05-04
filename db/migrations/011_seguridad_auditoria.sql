-- =============================================================================
-- Migration: 011_seguridad_auditoria
-- Description: Fase 3 del módulo de seguridad.
--              Crea el tipo ENUM de acciones y la tabla de auditoría.
--              La auditoría NO usa triggers de PostgreSQL — se registra desde
--              server actions con el patrón withAudit() en la capa de aplicación.
--
-- Prerrequisitos: 008_usuarios_base (tabla 'usuarios' debe existir)
-- Tipos que crea: accion_auditoria (ENUM)
-- Tablas que crea: auditoria
-- Tablas que modifica: ninguna
-- =============================================================================

-- ─────────────────────────────────────────────
-- 1. TIPO ENUM PARA ACCIONES DE AUDITORÍA
-- Tres acciones posibles que se registran desde las server actions.
-- ─────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accion_auditoria') THEN
        CREATE TYPE public.accion_auditoria AS ENUM (
            'ADICION',
            'MODIFICACION',
            'ELIMINACION'
        );
    END IF;
END
$$;

-- ─────────────────────────────────────────────
-- 2. TABLA AUDITORIA
-- Registro de todas las operaciones de escritura del sistema.
-- Apunta a usuarios.id (genérico), no a tecnicos.id.
--
-- Diseño:
--   - 'detalle' (JSONB): snapshot del cambio (antes/después)
--   - 'ip' y 'user_agent': capturados en la server action desde headers
--   - No se crean triggers — el patrón withAudit() envuelve cada action
--   - Si la action falla, NO se registra auditoría
--   - Si la auditoría falla, NO rompe la action (solo loggea)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auditoria (
    id          UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  UUID                    REFERENCES public.usuarios(id) ON DELETE SET NULL,
    tabla       TEXT                    NOT NULL,
    registro_id UUID                    NOT NULL,
    accion      public.accion_auditoria NOT NULL,
    detalle     JSONB,
    ip          TEXT,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ             NOT NULL DEFAULT now()
);

-- Índices para queries frecuentes en la UI de auditoría
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario
    ON public.auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla
    ON public.auditoria(tabla);
CREATE INDEX IF NOT EXISTS idx_auditoria_created
    ON public.auditoria(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_registro
    ON public.auditoria(tabla, registro_id);

COMMENT ON TABLE public.auditoria IS
    'Registro de auditoría del sistema. Captura quién hizo qué, sobre qué tabla/registro, con snapshot antes/después. Registrado desde server actions con withAudit(), NO con triggers.';
