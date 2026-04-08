---
trigger: always_on
---

# rules.md — Mobilhospital Maintenance Module

## IDENTIDAD DEL PROYECTO
- Nombre: Módulo de Mantenimiento Mobilhospital
- Motor de base de datos: PostgreSQL
- Stack: Next.js 14 (App Router) + Supabase + Tailwind CSS + shadcn/ui
- Objetivo: Digitalizar reportes técnicos de mantenimiento de equipo hospitalario

---

## REGLAS GENERALES

1. Nunca generes código de dos bloques distintos en el mismo paso. Un paso = un contexto.
2. Nunca asumas que una tabla, función o componente existe si no ha sido creado en un paso anterior de esta sesión.
3. Siempre que trabajes con la base de datos, valida que el schema definido en `db/schema.sql` sea la fuente de verdad.
4. Nunca uses IDs autoincrementales. Todos los PKs son UUID generados con `gen_random_uuid()`.
5. Todo campo de fecha/hora usa TIMESTAMPTZ (con zona horaria).
6. Ningún reporte puede cerrarse sin `firma_tecnico` y `firma_cliente` presentes.
7. El campo `estado_reporte` solo puede avanzar en este orden:
   borrador → pendiente_firma_tecnico → pendiente_firma_cliente → cerrado
   Nunca puede retroceder excepto a `anulado`.
8. El cliente de un equipo se obtiene SIEMPRE a través de equipo_contratos → contratos → clientes. Nunca directamente.
9. Ante cualquier ambigüedad en los requerimientos, detente y solicita aclaración. No asumas.
10. Cada archivo generado debe tener su ruta completa especificada en el encabezado del bloque de código.

---

## ORDEN ESTRICTO DE DESARROLLO
### El desarrollo sigue esta secuencia. No se puede avanzar al siguiente bloque sin completar el anterior.

BLOQUE 0 — BASE DE DATOS
BLOQUE 1 — FRONTEND (vistas y componentes)
BLOQUE 2 — BACKEND SIMPLE (CRUDs sin transacciones)
BLOQUE 3 — BACKEND CRÍTICO (CRUDs con transacciones e iteraciones)
BLOQUE 4 — VERIFICACIÓN Y AJUSTES

### Dentro de cada bloque, sigue el orden de módulos definido en workflows.md

---

## REGLAS POR BLOQUE

### BLOQUE 0 — BASE DE DATOS
- Usar exactamente el schema definido en `db/schema.sql` (fuente de verdad)
- Crear primero tablas maestras, luego tablas de transacción, luego tablas intermedias
- Las vistas se crean al final del bloque, después de todas las tablas
- Los triggers de `updated_at` se aplican al finalizar el bloque
- Verificar FK antes de cada INSERT de datos semilla
- Ejecutar seeders solo después de que todas las tablas estén creadas

### BLOQUE 1 — FRONTEND
- Empezar siempre por el panel del ADMINISTRADOR
- Crear primero el layout base, luego las páginas, luego los componentes
- No conectar datos reales en este bloque. Usar mocks/fixtures locales
- Todo componente debe tener sus props tipadas con TypeScript
- Usar shadcn/ui como librería base de componentes
- Tailwind CSS para estilos. Sin CSS modules ni styled-components
- Los formularios usan react-hook-form + zod para validación
- Respetar el sistema de diseño definido en `design/tokens.md`

### BLOQUE 2 — BACKEND SIMPLE
- CRUDs que aplican en este bloque: clientes, contratos, categorias_equipo,
  tecnicos, tipos_mantenimiento, insumos, ubicaciones, actividades_checklist
- Cada endpoint se crea en `/app/api/[entidad]/route.ts`
- Validación de entrada con zod en todos los endpoints
- Respuestas siempre en formato `{ data, error, meta }``
- No se procesan transacciones en este bloque
- Tests unitarios básicos por cada endpoint creado

### BLOQUE 3 — BACKEND CRÍTICO
- CRUDs que aplican: equipos (con asignación a contrato), reportes_mantenimiento
  (con firmas, checklist, insumos, técnicos asociados), sincronización offline
- Cada proceso crítico se itera mínimo una vez antes de continuar
- Las transacciones usan BEGIN/COMMIT explícito via Supabase RPC
- El proceso de firma digital requiere generación de hash SHA-256 en servidor
- La sincronización offline valida `dispositivo_origen` y `fecha_sincronizacion`
- En caso de conflicto de sincronización: registrar en tabla `sync_conflicts`
  y notificar al administrador. Nunca sobreescribir silenciosamente.

### BLOQUE 4 — VERIFICACIÓN
- Revisar que todas las vistas SQL retornen datos correctos con datos de prueba
- Verificar el flujo completo de un reporte: creación → checklist → firmas → cierre
- Verificar sincronización offline con simulación de dispositivo sin red
- Revisar permisos por rol (técnico vs administrador)
- Corregir cualquier inconsistencia detectada antes de cerrar el módulo

---

## REGLAS DE SEGURIDAD Y ROLES

- Existen dos roles: `administrador` y `tecnico`
- El técnico SOLO puede: crear reportes, ver sus propios reportes, completar checklist, firmar
- El administrador puede: todo lo anterior + gestionar catálogos, ver todos los reportes, aprobar/anular
- Los endpoints validan el rol en el middleware antes de procesar la solicitud
- Nunca exponer campos de hash de firma en respuestas de API públicas
- Las firmas digitales nunca se envían al cliente en base64 completo desde listados; solo en vista de detalle

---

## REGLAS DE CÓDIGO

- TypeScript estricto. Sin `any` explícito
- Naming: camelCase para variables/funciones, PascalCase para componentes y tipos
- Archivos de componentes: PascalCase (`ReportCard.tsx`)
- Archivos de utilidades y hooks: camelCase (`useReportForm.ts`)
- Cada función de más de 20 líneas debe tener un comentario de intención
- Sin lógica de negocio en componentes de vista. Usar hooks o server actions
- Los server actions van en `/app/actions/[módulo].ts`