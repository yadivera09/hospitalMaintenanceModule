---
trigger: always_on
---

Este archivo es continuación de refactor-parte1.md. Léelos en orden antes de comenzar.


# 7. HISTORIAL DE UBICACIÓN DE EQUIPOS

**Decisión arquitectónica:** Usar **Opción B — snapshot en `reportes_mantenimiento`**.

**Justificación:**

- El campo `ubicacion_id` ya existe en `reportes_mantenimiento`
- El campo `ubicacion_detalle` también existe para texto libre
- Crear una tabla separada (`equipo_ubicaciones_historial`) sería redundante con datos que ya están registrados por reporte
- La vista `v_historial_equipo` ya existe y puede extenderse

**Implementación:**

Crear una vista que agrupe el historial de ubicaciones por equipo usando los reportes cerrados:

```sql
CREATE OR REPLACE VIEW v_historial_ubicaciones_equipo AS
  SELECT
    rm.equipo_id,
    e.codigo_mh,
    e.nombre          AS equipo_nombre,
    u.nombre          AS ubicacion_nombre,
    rm.ubicacion_detalle,
    rm.fecha_inicio   AS fecha_registro,
    rm.estado_reporte,
    t.nombre || ' ' || t.apellido AS tecnico_nombre
  FROM reportes_mantenimiento rm
  JOIN equipos      e ON e.id = rm.equipo_id
  JOIN tecnicos     t ON t.id = rm.tecnico_principal_id
  LEFT JOIN ubicaciones u ON u.id = rm.ubicacion_id
  WHERE rm.estado_reporte IN ('pendiente_firma_cliente', 'cerrado')
  ORDER BY rm.equipo_id, rm.fecha_inicio DESC;
```

Esta vista se muestra en el detalle del equipo en el panel de administrador.

> **Regla:** Al crear o actualizar un reporte, el técnico debe poder seleccionar o confirmar la ubicación actual del equipo. Ese valor se persiste en `reportes_mantenimiento.ubicacion_id`.

---

# 8. SERIAL DE REPORTE — GENERACIÓN DIFERIDA

> ⚠️ Este cambio **requiere la Migración 2** ejecutada previamente.

**Decisión:** El serial **se genera cuando el reporte pasa de `en_progreso` a `pendiente_firma_cliente`**, no al crearlo.

**Justificación:**

- Evita consumir seriales de reportes que se eliminan en estado `en_progreso`
- El serial tiene significado de trazabilidad, no de identificación técnica (para eso existe el UUID)
- La generación con `SEQUENCE` en servidor evita colisiones en concurrencia

**Implementación:**

En el server action o RPC que cambia el estado de `en_progreso` a `pendiente_firma_cliente`:

```typescript
// En /app/actions/reportes.ts
async function avanzarEstadoReporte(reporteId: string) {
  // 1. Llamar RPC que asigna serial Y cambia estado de forma atómica
  const { data, error } = await supabase.rpc('cerrar_borrador_reporte', {
    p_reporte_id: reporteId
  });
}
```

```sql
-- RPC atómica: asigna serial y avanza estado
CREATE OR REPLACE FUNCTION cerrar_borrador_reporte(p_reporte_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_serial TEXT;
BEGIN
  -- Asignar serial
  v_serial := 'RPT-' || LPAD(nextval('seq_numero_reporte')::TEXT, 6, '0');

  UPDATE reportes_mantenimiento
    SET numero_reporte_fisico = v_serial,
        estado_reporte = 'pendiente_firma_cliente'
    WHERE id = p_reporte_id
      AND estado_reporte = 'en_progreso'
      AND numero_reporte_fisico IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El reporte no existe, ya tiene serial, o no está en estado en_progreso';
  END IF;

  RETURN v_serial;
END;
$$;
```

---


# 9. FUNCIÓN: DUPLICAR REPORTE

**Recomendación:** Implementar con restricciones claras.

**La función ES recomendable** porque el caso de uso es real (varios equipos del mismo modelo en mismo día). Los riesgos de integridad son manejables si se aplican estas reglas:

**Reglas de la duplicación:**

- El reporte duplicado **siempre se crea en estado `en_progreso`**
- El duplicado **NO hereda**: `equipo_id`, `numero_reporte_fisico`, `firma_tecnico`, `firma_cliente`, `hash_firma_tecnico`, `hash_firma_cliente`, `fecha_firma_tecnico`, `fecha_firma_cliente`, `nombre_cliente_firma`, `estado_equipo_post`, `ubicacion_id`, `ubicacion_detalle`
- El duplicado **SÍ hereda**: `tipo_mantenimiento_id`, `diagnostico`, `trabajo_realizado`, `observaciones`, `motivo_visita`, `hora_entrada`, `hora_salida`, `ciudad`, `solicitado_por`, checklist de actividades, insumos usados, insumos requeridos
- El técnico **debe seleccionar el nuevo equipo** antes de guardar el duplicado

**Implementación:** RPC en Supabase + server action en `/app/actions/reportes.ts`. No implementar en el frontend directamente.

---

# 10. CARGA MASIVA DE EQUIPOS VIA CSV
Este cambio no requiere migraciones de base de datos. La tabla equipos existente se mantiene sin cambios estructurales. Se implementa al final, después de todos los cambios anteriores.

Problema: Registrar equipos uno a uno es ineficiente cuando un contrato incluye muchas unidades del mismo tipo (por ejemplo, 20 camas eléctricas). El formulario manual no escala para incorporaciones masivas.
Decisión: Agregar un botón "Carga masiva" en la vista /admin/equipos que permita subir un archivo CSV y procesar todos los registros en una sola operación.

El archivo debe respetar exactamente estas columnas (los nombres en el encabezado son case-insensitive):

codigo_mh,nombre,marca,modelo,numero_serie,activo_fijo,categoria_id,tipo_mantenimiento_id,fecha_fabricacion,observaciones


Columnas obligatorias: codigo_mh, nombre, categoria_id, tipo_mantenimiento_id
Columnas opcionales: marca, modelo, numero_serie, activo_fijo, fecha_fabricacion, observaciones

Nota UX: Para facilitar al administrador obtener los categoria_id y tipo_mantenimiento_id correctos, el modal de carga masiva debe incluir un botón "Descargar plantilla" que genere un CSV con los encabezados ya escritos y filas de ejemplo comentadas, además de una tabla de referencia con los IDs válidos de categorías y tipos de mantenimiento disponibles en el sistema.

UI — Botón en la vista de Equipos
En /admin/equipos/page.tsx, junto al botón + Nuevo Equipo:<Button variant="outline" onClick={() => setModalCargaMasivaOpen(true)}>
  <Upload className="w-4 h-4 mr-2" />
  Carga masiva
</Button>
```
---

## Componente: `ModalCargaMasivaEquipos`

Ubicación: `/components/admin/equipos/ModalCargaMasivaEquipos.tsx`

**Estados del modal:**
```
idle → cargando_archivo → previsualizando → enviando → resultado

Flujo en 3 pasos:
Paso 1 — Subir archivo: El administrador arrastra o selecciona un .csv. El componente parsea el archivo en el cliente con papaparse y muestra una tabla de previsualización con las filas detectadas.
Paso 2 — Validación en cliente: Antes de enviar, validar fila a fila:

codigo_mh no vacío y no duplicado dentro del mismo CSV
categoria_id y tipo_mantenimiento_id son UUIDs válidos
Marcar filas con error en rojo y filas válidas en verde
Si hay errores, no habilitar el botón de confirmar hasta que el usuario corrija o elimine las filas con error

Paso 3 — Confirmación e inserción: Al confirmar, llamar al server action importarEquiposDesdeCSV. Mostrar resultado: cuántos se insertaron, cuántos fallaron, con detalle por fila fallida.

Reglas de inserción

Cada fila se intenta insertar de forma independiente. Un error en una fila no cancela las demás.
Si codigo_mh ya existe en la base de datos (constraint UNIQUE), se reporta como fila fallida con mensaje claro.
El campo activo siempre se establece en true en inserciones masivas.
No se asigna el equipo a ningún contrato durante la carga masiva. Esa asociación se hace posteriormente desde la vista de contratos (equipo_contratos).
Los UUIDs de categoria_id y tipo_mantenimiento_id deben existir en sus respectivas tablas maestras; si no existen, Supabase rechazará el insert por FK violation y se reportará como fila fallida.

# ORDEN DE IMPLEMENTACIÓN

Para evitar romper el sistema, los cambios deben implementarse en este orden estricto:

| Paso | Cambio | Prerequisito |
|---|---|---|
| 0️⃣ | Ejecutar **Migración 1** (estados) | Ninguno |
| 0️⃣ | Ejecutar **Migración 2** (serial con SEQUENCE) | Ninguno |
| 1️⃣ | Corrección de vistas y consultas de reportes (cambio 3 y 5) | Migración 1 |
| 2️⃣ | Actualización de estados en frontend y backend (cambio 4) | Migración 1 |
| 3️⃣ | Corrección de último mantenimiento preventivo (cambio 1) | Ninguno |
| 4️⃣ | Validaciones del formulario multipágina (cambio 2) | Ninguno |
| 5️⃣ | Mejora de insumos dinámicos (cambio 6) | Ninguno |
| 6️⃣ | Implementación de historial de ubicaciones — vista (cambio 7) | Ninguno |
| 7️⃣ | Serial diferido — RPC y server action (cambio 8) | Migración 2 |
| 8️⃣ | Función duplicar reporte (cambio 9) | Cambio 4 |
| 9️⃣ | Carga masiva de equipos vía CSV (cambio 10) | Todos los anteriores |

---

# IMPORTANTE

Antes de generar código para cada cambio:

1. Analiza impacto en base de datos
2. Identifica si requiere alguna de las migraciones definidas arriba
3. Verifica que las RLS de Supabase permiten la operación para el rol correspondiente
4. Propón soluciones arquitectónicas si detectas nuevos problemas

No implementes cambios estructurales **sin explicar primero la estrategia de migración**.

Un paso = un contexto. No mezcles cambios de bloques distintos en el mismo paso.