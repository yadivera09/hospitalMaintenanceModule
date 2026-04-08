---
trigger: always_on
---

Este documento tiene continuación en refactor-parte2.md. Léelos en orden antes de comenzar.


# CONTEXTO DEL PROYECTO

Estoy desarrollando un sistema de **Mantenimiento de Equipos Hospitalarios** para una empresa llamada **Mobilhospital**, que se encarga de la **distribución y mantenimiento técnico de insumos y equipos médicos**.

El proyecto ya tiene definidos:

- `rules.md`
- `workflows.md`
- Arquitectura completa
- Base de datos implementada en PostgreSQL
- Frontend en Next.js 14 (App Router)
- Backend con Supabase
- UI con Tailwind + shadcn/ui

El sistema tiene **dos roles principales**:

- `administrador`
- `tecnico`

Actualmente **ya se completó el BLOQUE 3 (Backend Crítico)** definido en `rules.md`.

Por lo tanto, ahora estamos en el **BLOQUE 4 — Verificación, Ajustes y Mejoras del Sistema**.

Este documento define **correcciones funcionales, mejoras de modelo de datos y optimizaciones de UX** que deben implementarse **siguiendo una secuencia lógica para evitar romper funcionalidades existentes**.

Antes de generar código, analiza cada cambio y valida que **respete las reglas definidas en `rules.md` y la estructura del proyecto**.

Si detectas inconsistencias en el modelo de datos o arquitectura, **detente y sugiere una solución antes de implementar**.

---

# OBJETIVO DE ESTE BLOQUE

Realizar **correcciones y mejoras funcionales** en:

- Dashboard del técnico
- Flujo de creación de reportes
- Visualización de reportes en admin
- Modelo de equipos y contratos
- Gestión de insumos
- Historial de ubicaciones
- Serialización de reportes
- Métricas administrativas

Todo esto **sin romper los workflows existentes**.

---

# MIGRACIONES REQUERIDAS

> ⚠️ Estas migraciones deben ejecutarse **antes que cualquier otro cambio** en la base de datos o el frontend. Son prerequisito de los cambios 3, 4, 7 y 8.

## MIGRACIÓN 1 — Nuevo flujo de estados de reporte

Los estados `borrador` y `pendiente_firma_tecnico` se eliminan. El nuevo estado inicial es `en_progreso`.

El constraint actual debe reemplazarse de forma atómica:

```sql
-- Paso 1: eliminar constraint existente
ALTER TABLE reportes_mantenimiento
  DROP CONSTRAINT IF EXISTS ck_estado_reporte;

-- Paso 2: actualizar registros con estados obsoletos (si existen)
UPDATE reportes_mantenimiento
  SET estado_reporte = 'en_progreso'
  WHERE estado_reporte IN ('borrador', 'pendiente_firma_tecnico');

-- Paso 3: crear nuevo constraint con estados válidos
ALTER TABLE reportes_mantenimiento
  ADD CONSTRAINT ck_estado_reporte CHECK (
    estado_reporte = ANY (
      ARRAY['en_progreso', 'pendiente_firma_cliente', 'cerrado', 'anulado']
    )
  );
```

El nuevo flujo de estados es:

```
en_progreso → pendiente_firma_cliente → cerrado
```

El único retroceso permitido sigue siendo: → `anulado`

El constraint de cierre ya existente se mantiene sin cambios:

```sql
-- Este constraint NO cambia, se conserva tal cual
CONSTRAINT ck_reporte_cerrado_requiere_firmas CHECK (
  estado_reporte <> 'cerrado'
  OR (firma_tecnico IS NOT NULL AND firma_cliente IS NOT NULL)
)
```

## MIGRACIÓN 2 — Serial de reporte con SEQUENCE de PostgreSQL

El campo `numero_reporte_fisico` actualmente es texto libre. Se debe crear un `SEQUENCE` para generación controlada del serial.

```sql
-- Crear sequence para seriales de reporte
CREATE SEQUENCE IF NOT EXISTS seq_numero_reporte START 1 INCREMENT 1;

-- Función RPC que asigna el serial de forma atómica
CREATE OR REPLACE FUNCTION asignar_serial_reporte(p_reporte_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_serial TEXT;
  v_estado TEXT;
BEGIN
  SELECT estado_reporte INTO v_estado
    FROM reportes_mantenimiento
    WHERE id = p_reporte_id;

  IF v_estado <> 'en_progreso' THEN
    RAISE EXCEPTION 'Solo se puede asignar serial a reportes en estado en_progreso';
  END IF;

  v_serial := 'RPT-' || LPAD(nextval('seq_numero_reporte')::TEXT, 6, '0');

  UPDATE reportes_mantenimiento
    SET numero_reporte_fisico = v_serial
    WHERE id = p_reporte_id
      AND numero_reporte_fisico IS NULL;

  RETURN v_serial;
END;
$$;
```

> **Nota:** El serial solo se genera cuando el reporte pasa de `en_progreso` a `pendiente_firma_cliente`. Ver cambio 8 para la lógica completa.

---

# CAMBIOS REQUERIDOS

---

# 1. CORRECCIÓN: ÚLTIMO MANTENIMIENTO PREVENTIVO (TÉCNICO)

**Vista afectada:** `/tecnico/nuevo-reporte`

Cuando el técnico selecciona un equipo, el sistema debe mostrar la **fecha del último mantenimiento preventivo realizado**.

Actualmente este campo aparece como **NULL**, lo cual es incorrecto.

La lógica correcta:

- Buscar en `reportes_mantenimiento`
- Filtrar por:
  - mismo `equipo_id`
  - `tipo_mantenimiento` de tipo preventivo (`es_planificado = true`)
  - `estado_reporte IN ('pendiente_firma_cliente', 'cerrado')`
- Tomar: `MAX(fecha_inicio)`

**Implementación:** Crear una función RPC o query directa desde el server component que resuelva esto. No calcular en el frontend.

```sql
-- Query de referencia para el server component
SELECT MAX(rm.fecha_inicio) AS ultimo_preventivo
FROM reportes_mantenimiento rm
JOIN tipos_mantenimiento tm ON tm.id = rm.tipo_mantenimiento_id
WHERE rm.equipo_id = $1
  AND tm.es_planificado = true
  AND rm.estado_reporte IN ('pendiente_firma_cliente', 'cerrado');
```

---

# 2. VALIDACIÓN DE FORMULARIO MULTIPÁGINA (CREAR REPORTE)

El formulario de creación de reportes tiene **4 páginas**.

Se debe garantizar que el usuario **no pueda avanzar si los campos obligatorios de la página actual no están completos**.

Reglas:

- Los campos que permiten `NULL` en el schema **no deben bloquear el avance**
- Solo los campos definidos como obligatorios deben validarse
- Implementar validación por página con schema `zod` independiente por paso

**Tecnologías:** `react-hook-form` + `zod`

Implementación por página:

```typescript
// Esquema de validación por página — ejemplo página 1
const pageOneSchema = z.object({
  equipo_id: z.string().uuid('Debe seleccionar un equipo'),
  tipo_mantenimiento_id: z.string().uuid('Debe seleccionar tipo de mantenimiento'),
  fecha_inicio: z.string().min(1, 'La fecha es requerida'),
  // Campos opcionales NO incluidos en el schema de validación de página
  // (diagnostico, observaciones, etc.)
});
```

El botón "Siguiente" solo se habilita si `trigger(camposDeLaPaginaActual)` retorna `true`.

---

# 3. CORRECCIÓN: REPORTES NO VISIBLES EN ADMIN

**Problema:** Los reportes existentes aparecen como "Reporte no encontrado" en el panel de administrador.

Revisar en este orden:

1. **RLS de Supabase:** Verificar que la política de la tabla `reportes_mantenimiento` permita lectura a usuarios con rol `administrador` sin filtro por `tecnico_principal_id`
2. **Consultas SQL:** Verificar que los joins con `equipos`, `tecnicos` y `tipos_mantenimiento` no fallen por registros huérfanos
3. **Vistas:** Asegurarse de que las vistas usan `LEFT JOIN` donde corresponde
4. **Estado del reporte:** Después de aplicar la Migración 1, los filtros del admin deben actualizarse para incluir el estado `en_progreso` y excluir `borrador` y `pendiente_firma_tecnico`

El administrador debe poder ver **todos los reportes** sin importar su estado.

**Estados válidos después de la Migración 1:**

```
en_progreso | pendiente_firma_cliente | cerrado | anulado
```

---

# 4. CAMBIO EN LOS ESTADOS DE REPORTE

> ⚠️ Este cambio **requiere la Migración 1** ejecutada previamente.

Los estados `borrador` y `pendiente_firma_tecnico` **ya no existen**.

Deben eliminarse de:

- Dashboard del administrador (filtros, contadores, labels)
- Dashboard del técnico (filtros, listados)
- Todas las vistas SQL (recrear si es necesario)
- Todas las consultas del backend
- Todos los componentes de frontend que muestren `estado_reporte` como texto

**Mapa de reemplazo de labels en UI:**

| Estado anterior | Estado nuevo |
|---|---|
| `borrador` | eliminado |
| `pendiente_firma_tecnico` | eliminado |
| `en_progreso` (nuevo) | "En progreso" |
| `pendiente_firma_cliente` | "Pendiente firma cliente" |
| `cerrado` | "Cerrado" |
| `anulado` | "Anulado" |

---

# 5. CORRECCIÓN: INFORMACIÓN GENERAL DE REPORTE

**Problema:** Al ver un reporte existente, estos campos aparecen incorrectamente:

```
Equipo: no definido
Tipo mantenimiento: por definir
Ubicación: no asignada
```

Pero los datos **sí existen en la base de datos**.

Revisar:

- Los joins de la query de detalle del reporte deben incluir explícitamente:
  - `equipos` (para nombre, código, marca, modelo)
  - `tipos_mantenimiento` (para nombre del tipo)
  - `ubicaciones` via `ubicacion_id` del reporte (con `LEFT JOIN`)
- Si el reporte tiene `ubicacion_id` en `reportes_mantenimiento`, joinear directamente desde ahí (no desde `equipo_contratos`)
- Los snapshots del equipo (`equipo_marca_snapshot`, `equipo_modelo_snapshot`, `equipo_serie_snapshot`) deben usarse como fallback si los joins no retornan datos

**Query de referencia para el detalle:**

```sql
SELECT
  rm.*,
  e.codigo_mh, e.nombre AS equipo_nombre, e.marca, e.modelo,
  tm.nombre AS tipo_mantenimiento_nombre,
  u.nombre  AS ubicacion_nombre,
  t.nombre || ' ' || t.apellido AS tecnico_nombre
FROM reportes_mantenimiento rm
JOIN equipos             e  ON e.id  = rm.equipo_id
JOIN tipos_mantenimiento tm ON tm.id = rm.tipo_mantenimiento_id
JOIN tecnicos            t  ON t.id  = rm.tecnico_principal_id
LEFT JOIN ubicaciones    u  ON u.id  = rm.ubicacion_id
WHERE rm.id = $1;
```

---

# 6. MEJORA: INSUMOS DINÁMICOS EN REPORTE

**Vista afectada:** Página 3 del formulario de reporte.

Actualmente solo la sección de **accesorios/repuestos** permite agregar ítems dinámicamente.

Se debe extender el mismo comportamiento a:

- **Insumos usados** (`reporte_insumos_usados`)
- **Insumos requeridos** (`reporte_insumos_requeridos`)

El técnico debe poder en cada sección:

1. **Seleccionar del catálogo** existente (autocomplete sobre tabla `insumos`)
2. **O escribir manualmente** un nuevo ítem (que se crea en `insumos` si no existe)
3. **Especificar cantidad** (campo numérico, validado como `> 0`)
4. **Agregar observación** opcional
5. **Eliminar ítems** antes de guardar

**Componente reutilizable:** Crear un único componente `InsumoSelector` parametrizable por tipo (`usado | requerido`) que encapsule esta lógica. No duplicar código.

---
