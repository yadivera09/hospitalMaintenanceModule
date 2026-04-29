-- =============================================================================
-- Migration: 006_fix_reportes_rls
-- Description: Ajusta las políticas de RLS para reportes_mantenimiento.
--              Asegura que el administrador vea TODOS los reportes y el
--              técnico vea solo los suyos (principal o apoyo).
-- =============================================================================

-- 1. Habilitar RLS
ALTER TABLE reportes_mantenimiento ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas antiguas para evitar conflictos
DROP POLICY IF EXISTS "Administradores ven todo" ON reportes_mantenimiento;
DROP POLICY IF EXISTS "Técnicos ven sus propios reportes" ON reportes_mantenimiento;
DROP POLICY IF EXISTS "Técnicos crean sus propios reportes" ON reportes_mantenimiento;
DROP POLICY IF EXISTS "Técnicos editan sus propios reportes" ON reportes_mantenimiento;

-- 3. Política para Administradores (Acceso Total)
CREATE POLICY "Admin_Full_Access"
ON reportes_mantenimiento
FOR ALL
TO authenticated
USING (
  (SELECT (auth.jwt() -> 'user_metadata' ->> 'rol')) = 'administrador'
)
WITH CHECK (
  (SELECT (auth.jwt() -> 'user_metadata' ->> 'rol')) = 'administrador'
);

-- 4. Política para Técnicos (Ver sus propios reportes)
-- Pueden ver si son técnico principal O si están en la tabla de apoyo
CREATE POLICY "Tecnico_Select_Own"
ON reportes_mantenimiento
FOR SELECT
TO authenticated
USING (
  (SELECT (auth.jwt() -> 'user_metadata' ->> 'rol')) = 'tecnico'
  AND (
    tecnico_principal_id IN (SELECT id FROM tecnicos WHERE user_id = auth.uid())
    OR
    id IN (SELECT reporte_id FROM reporte_tecnicos WHERE tecnico_id IN (SELECT id FROM tecnicos WHERE user_id = auth.uid()))
  )
);

-- 5. Política para Técnicos (Insertar sus propios reportes)
CREATE POLICY "Tecnico_Insert_Own"
ON reportes_mantenimiento
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT (auth.jwt() -> 'user_metadata' ->> 'rol')) = 'tecnico'
  AND tecnico_principal_id IN (SELECT id FROM tecnicos WHERE user_id = auth.uid())
);

-- 6. Política para Técnicos (Actualizar sus propios reportes)
-- Solo pueden actualizar si el reporte está en estado 'en_progreso' o 'pendiente_firma_cliente' (para firma cliente)
CREATE POLICY "Tecnico_Update_Own"
ON reportes_mantenimiento
FOR UPDATE
TO authenticated
USING (
  (SELECT (auth.jwt() -> 'user_metadata' ->> 'rol')) = 'tecnico'
  AND tecnico_principal_id IN (SELECT id FROM tecnicos WHERE user_id = auth.uid())
  AND estado_reporte IN ('en_progreso', 'pendiente_firma_cliente')
)
WITH CHECK (
  (SELECT (auth.jwt() -> 'user_metadata' ->> 'rol')) = 'tecnico'
  AND tecnico_principal_id IN (SELECT id FROM tecnicos WHERE user_id = auth.uid())
  AND estado_reporte IN ('en_progreso', 'pendiente_firma_cliente', 'cerrado')
);

COMMENT ON TABLE reportes_mantenimiento IS 'Reportes con RLS: Admin ve todo, Tecnico ve lo asignado.';
