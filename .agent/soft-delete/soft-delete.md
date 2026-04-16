# SOFT DELETE - Implementación para Módulo de Mantenimiento
## Mobilhospital - Eliminación con PROTECT y desactivación inteligente

---

## 📋 ÍNDICE

1. [Arquitectura General](#arquitectura-general)
2. [Migraciones Base de Datos](#migraciones-base-de-datos)
3. [Funciones PostgreSQL (RPC)](#funciones-postgresql-rpc)
4. [Servicio de Soft Delete](#servicio-de-soft-delete)
5. [Hook Personalizado](#hook-personalizado)
6. [Componente DeleteDialog](#componente-deletedialog)
7. [Integración en Equipos](#integracion-en-equipos)
8. [RLS Policies](#rls-policies)
9. [Testing](#testing)
10. [Checklist Final](#checklist-final)

---

## 🎯 ARQUITECTURA GENERAL

### Principios aplicados:
- **Soft Delete universal**: Todos los modelos tienen campo `activo` (boolean)
- **PROTECT pattern**: Verificar dependencias antes de desactivar
- **Auditoría**: Registrar quién y cuándo se desactivó (opcional)
- **Dashboard diferenciado**:
  - Admin: Puede ver/activar/desactivar registros
  - Técnico: Solo ve registros activos

### Tablas afectadas (ya tienen `activo/activa`):
✅ `equipos.activo`
✅ `clientes.activo`
✅ `contratos.activo`
✅ `tecnicos.activo`
✅ `categorias_equipo.activa`
✅ `tipos_mantenimiento.activo`
✅ `insumos.activo`
✅ `ubicaciones.activa`
✅ `reportes_mantenimiento.activo`

---

## 🗄️ MIGRACIONES BASE DE DATOS

### 1. Crear migración: `supabase/migrations/XXXX_soft_delete_system.sql`

```sql
-- =====================================================
-- SOFT DELETE SYSTEM - Mobilhospital
-- =====================================================

-- 1.1 AUDIT LOG para soft deletes (opcional pero recomendado)
CREATE TABLE IF NOT EXISTS public.audit_soft_deletes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    deleted_by UUID REFERENCES auth.users(id),
    deleted_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB,
    restored_at TIMESTAMPTZ,
    restored_by UUID REFERENCES auth.users(id)
);

-- Índices para búsqueda rápida
CREATE INDEX idx_audit_soft_deletes_record ON audit_soft_deletes(table_name, record_id);
CREATE INDEX idx_audit_soft_deletes_deleted_at ON audit_soft_deletes(deleted_at);

-- 1.2 FUNCIÓN PARA VERIFICAR DEPENDENCIAS (EQUIPOS)
CREATE OR REPLACE FUNCTION public.check_equipo_dependencies(p_equipo_id UUID)
RETURNS TABLE (
    has_dependencies BOOLEAN,
    dependency_count BIGINT,
    dependency_type TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Verificar reportes de mantenimiento activos
    RETURN QUERY
    SELECT 
        COUNT(*) > 0 AS has_dependencies,
        COUNT(*) AS dependency_count,
        'reportes_mantenimiento' AS dependency_type
    FROM public.reportes_mantenimiento
    WHERE equipo_id = p_equipo_id AND activo = true
    
    UNION ALL
    
    SELECT 
        COUNT(*) > 0,
        COUNT(*),
        'equipo_contratos'
    FROM public.equipo_contratos
    WHERE equipo_id = p_equipo_id AND fecha_retiro IS NULL;
END;
$$;

-- 1.3 FUNCIÓN PARA VERIFICAR DEPENDENCIAS (CLIENTES)
CREATE OR REPLACE FUNCTION public.check_cliente_dependencies(p_cliente_id UUID)
RETURNS TABLE (
    has_dependencies BOOLEAN,
    dependency_count BIGINT,
    dependency_type TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT COUNT(*) > 0, COUNT(*), 'contratos_activos'
    FROM public.contratos
    WHERE cliente_id = p_cliente_id AND activo = true
    
    UNION ALL
    
    SELECT COUNT(*) > 0, COUNT(*), 'ubicaciones_activas'
    FROM public.ubicaciones
    WHERE cliente_id = p_cliente_id AND activa = true;
END;
$$;

-- 1.4 FUNCIÓN PARA VERIFICAR DEPENDENCIAS (CONTRATOS)
CREATE OR REPLACE FUNCTION public.check_contrato_dependencies(p_contrato_id UUID)
RETURNS TABLE (
    has_dependencies BOOLEAN,
    dependency_count BIGINT,
    dependency_type TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT COUNT(*) > 0, COUNT(*), 'equipos_asignados'
    FROM public.equipo_contratos
    WHERE contrato_id = p_contrato_id AND fecha_retiro IS NULL;
END;
$$;

-- 1.5 FUNCIÓN PARA VERIFICAR DEPENDENCIAS (TÉCNICOS)
CREATE OR REPLACE FUNCTION public.check_tecnico_dependencies(p_tecnico_id UUID)
RETURNS TABLE (
    has_dependencies BOOLEAN,
    dependency_count BIGINT,
    dependency_type TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT COUNT(*) > 0, COUNT(*), 'reportes_activos'
    FROM public.reportes_mantenimiento
    WHERE tecnico_principal_id = p_tecnico_id AND activo = true
    
    UNION ALL
    
    SELECT COUNT(*) > 0, COUNT(*), 'reportes_apoyo'
    FROM public.reporte_tecnicos
    WHERE tecnico_id = p_tecnico_id;
END;
$$;

-- 1.6 FUNCIÓN PRINCIPAL DE SOFT DELETE (GENERIC)
CREATE OR REPLACE FUNCTION public.soft_delete_record(
    p_table_name TEXT,
    p_record_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_column_name TEXT;
    v_result JSONB;
    v_dependencies JSONB;
BEGIN
    -- Determinar la columna de estado según la tabla
    v_column_name := CASE p_table_name
        WHEN 'equipos' THEN 'activo'
        WHEN 'clientes' THEN 'activo'
        WHEN 'contratos' THEN 'activo'
        WHEN 'tecnicos' THEN 'activo'
        WHEN 'categorias_equipo' THEN 'activa'
        WHEN 'tipos_mantenimiento' THEN 'activo'
        WHEN 'insumos' THEN 'activo'
        WHEN 'ubicaciones' THEN 'activa'
        ELSE 'activo'
    END;

    -- Verificar dependencias según la tabla
    IF p_table_name = 'equipos' THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'type', dependency_type,
                'count', dependency_count
            )
        ) INTO v_dependencies
        FROM check_equipo_dependencies(p_record_id)
        WHERE has_dependencies = true;
        
        IF v_dependencies IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'message', 'El equipo tiene dependencias activas',
                'dependencies', v_dependencies
            );
        END IF;
    
    ELSIF p_table_name = 'clientes' THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'type', dependency_type,
                'count', dependency_count
            )
        ) INTO v_dependencies
        FROM check_cliente_dependencies(p_record_id)
        WHERE has_dependencies = true;
        
        IF v_dependencies IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'message', 'El cliente tiene dependencias activas',
                'dependencies', v_dependencies
            );
        END IF;
    
    ELSIF p_table_name = 'contratos' THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'type', dependency_type,
                'count', dependency_count
            )
        ) INTO v_dependencies
        FROM check_contrato_dependencies(p_record_id)
        WHERE has_dependencies = true;
        
        IF v_dependencies IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'message', 'El contrato tiene equipos asignados activos',
                'dependencies', v_dependencies
            );
        END IF;
    
    ELSIF p_table_name = 'tecnicos' THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'type', dependency_type,
                'count', dependency_count
            )
        ) INTO v_dependencies
        FROM check_tecnico_dependencies(p_record_id)
        WHERE has_dependencies = true;
        
        IF v_dependencies IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'message', 'El técnico tiene reportes activos',
                'dependencies', v_dependencies
            );
        END IF;
    END IF;

    -- Ejecutar soft delete
    EXECUTE format('
        UPDATE public.%I 
        SET %I = false, updated_at = now()
        WHERE id = $1
        RETURNING jsonb_build_object(
            ''success'', true,
            ''id'', id,
            ''message'', ''Registro desactivado correctamente''
        )
    ', p_table_name, v_column_name)
    INTO v_result
    USING p_record_id;

    -- Registrar en auditoría si hay user_id
    IF p_user_id IS NOT NULL AND v_result->>'success' = 'true' THEN
        INSERT INTO public.audit_soft_deletes (table_name, record_id, deleted_by, metadata)
        VALUES (p_table_name, p_record_id, p_user_id, jsonb_build_object('timestamp', now()));
    END IF;

    RETURN COALESCE(v_result, jsonb_build_object(
        'success', false,
        'message', 'Registro no encontrado'
    ));
END;
$$;

-- 1.7 FUNCIÓN PARA RESTAURAR REGISTRO
CREATE OR REPLACE FUNCTION public.restore_record(
    p_table_name TEXT,
    p_record_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_column_name TEXT;
    v_result JSONB;
BEGIN
    v_column_name := CASE p_table_name
        WHEN 'categorias_equipo' THEN 'activa'
        ELSE 'activo'
    END;

    EXECUTE format('
        UPDATE public.%I 
        SET %I = true, updated_at = now()
        WHERE id = $1
        RETURNING jsonb_build_object(
            ''success'', true,
            ''id'', id,
            ''message'', ''Registro restaurado correctamente''
        )
    ', p_table_name, v_column_name)
    INTO v_result
    USING p_record_id;

    -- Actualizar auditoría
    IF p_user_id IS NOT NULL AND v_result->>'success' = 'true' THEN
        UPDATE public.audit_soft_deletes
        SET restored_at = now(), restored_by = p_user_id
        WHERE table_name = p_table_name AND record_id = p_record_id AND restored_at IS NULL;
    END IF;

    RETURN COALESCE(v_result, jsonb_build_object(
        'success', false,
        'message', 'Registro no encontrado'
    ));
END;
$$;

-- 1.8 ÍNDICES adicionales para performance
CREATE INDEX IF NOT EXISTS idx_equipos_activo ON equipos(activo) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_clientes_activo ON clientes(activo) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_contratos_activo ON contratos(activo) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_tecnicos_activo ON tecnicos(activo) WHERE activo = true;

-- 1.9 TRIGGER para evitar soft delete duplicado (opcional)
CREATE OR REPLACE FUNCTION public.prevent_double_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.activo = false AND NEW.activo = false THEN
        RAISE EXCEPTION 'El registro ya está desactivado';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a tablas principales
CREATE TRIGGER prevent_double_soft_delete_equipos
    BEFORE UPDATE OF activo ON equipos
    FOR EACH ROW EXECUTE FUNCTION prevent_double_soft_delete();