-- =============================================================================
-- Migration: 002_fix_tecnicos_rls
-- Description: Asegura que los técnicos puedan ver a otros técnicos para el
--              proceso de asignación de apoyo en reportes.
--              También asegura que el técnico actual pueda leer su propio perfil.
-- =============================================================================

-- 1. Habilitar RLS en la tabla tecnicos (si no está ya habilitado)
ALTER TABLE tecnicos ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas restrictivas anteriores (opcional, por seguridad)
DROP POLICY IF EXISTS "Los técnicos solo ven su propio perfil" ON tecnicos;
DROP POLICY IF EXISTS "Permitir lectura de técnicos activos a usuarios autenticados" ON tecnicos;

-- 3. Crear política para permitir que cualquier usuario autenticado vea los técnicos activos
-- Esto es necesario para que un técnico pueda seleccionar a otros como "técnicos de apoyo".
CREATE POLICY "Permitir lectura de técnicos activos a usuarios autenticados"
ON tecnicos
FOR SELECT
TO authenticated
USING (activo = true);

-- 4. Asegurar que los administradores puedan hacer todo (si no hay una política global)
CREATE POLICY "Administradores tienen acceso total a tecnicos"
ON tecnicos
FOR ALL
TO authenticated
USING (
  (SELECT (auth.jwt() -> 'user_metadata' ->> 'rol')) = 'administrador'
)
WITH CHECK (
  (SELECT (auth.jwt() -> 'user_metadata' ->> 'rol')) = 'administrador'
);

COMMENT ON POLICY "Permitir lectura de técnicos activos a usuarios autenticados" ON tecnicos 
IS 'Permite que técnicos y administradores vean la lista de personal activo para asignaciones de apoyo.';
