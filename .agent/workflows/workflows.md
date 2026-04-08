---
description: 
---

# workflows.md — Mobilhospital Maintenance Module

## WORKFLOW 1: SETUP INICIAL
Trigger: Inicio del proyecto
Pasos:
  1. Crear estructura de carpetas del proyecto
  2. Configurar Next.js 14 con App Router y TypeScript
  3. Configurar Supabase client (server y client-side)
  4. Instalar y configurar shadcn/ui + Tailwind
  5. Configurar ESLint + Prettier
  6. Definir variables de entorno (.env.local)
  7. Ejecutar schema SQL en Supabase
  8. Ejecutar seeders de datos base (tipos_mantenimiento, categorías de ejemplo)

---

## WORKFLOW 2: BLOQUE 0 — BASE DE DATOS
Trigger: Setup completado
Orden de ejecución:

  FASE 1 — Tablas maestras:
    clientes → contratos → categorias_equipo → tecnicos →
    tipos_mantenimiento → insumos → ubicaciones

  FASE 2 — Tabla central de equipos:
    equipos → equipo_contratos

  FASE 3 — Tablas de reporte:
    reportes_mantenimiento → reporte_tecnicos →
    actividades_checklist → reporte_actividades →
    reporte_insumos_usados → reporte_insumos_requeridos

  FASE 4 — Vistas y funciones:
    v_equipo_contrato_vigente → v_equipos_mantenimiento_vencido →
    v_historial_equipo → fn_set_updated_at → triggers

  FASE 5 — Seeders:
    tipos_mantenimiento (datos base ya definidos en schema)
    Categorías de ejemplo: Cama, Camilla, Coche de paro, Silla de ruedas
    Checklist de ejemplo por categoría

---

## WORKFLOW 3: BLOQUE 1 — FRONTEND (Panel Administrador primero)
Trigger: Base de datos completa y verificada

  FASE 1 — Layout y sistema de diseño:
    tokens de diseño → layout base → sidebar → navbar → sistema de navegación

  FASE 2 — Panel Administrador (módulos en orden):
    2.1  Dashboard (métricas: vencidos, pendientes, correctivos recientes)
    2.2  Gestión de Clientes (lista + detalle + formulario)
    2.3  Gestión de Contratos (lista + detalle + formulario)
    2.4  Gestión de Equipos (lista + búsqueda por código_mh / serie / activo fijo)
    2.5  Gestión de Técnicos
    2.6  Catálogos (categorías, tipos mantenimiento, insumos, ubicaciones)
    2.7  Reportes (lista global + filtros + vista detalle + estado del reporte)
    2.8  Checklist Builder (editor de actividades por categoría)

  FASE 3 — Panel Técnico (módulos en orden):
    3.1  Dashboard técnico (mis reportes del día, pendientes de firma)
    3.2  Nuevo Reporte (formulario principal con checklist dinámico)
    3.3  Búsqueda de equipo (por código MH, serie, activo fijo)
    3.4  Firma digital (canvas de firma en móvil)
    3.5  Mis reportes (historial personal)
    3.6  Modo offline (indicador de conectividad + cola de sincronización)

---

## WORKFLOW 4: BLOQUE 2 — BACKEND SIMPLE
Trigger: Frontend completado para el módulo correspondiente
Módulos a cubrir (sin transacciones):

  /api/clientes        → GET list, GET by id, POST, PUT, DELETE (soft)
  /api/contratos       → GET list, GET by id, POST, PUT
  /api/categorias      → GET list, POST, PUT
  /api/tecnicos        → GET list, GET by id, POST, PUT
  /api/insumos         → GET list, GET by id, POST, PUT
  /api/ubicaciones     → GET list por cliente, POST, PUT
  /api/checklist       → GET por categoría, POST actividad, PUT, toggle activa

Por cada endpoint:
  1. Crear route handler en /app/api/[entidad]/route.ts
  2. Crear schema zod de validación
  3. Crear tipo TypeScript correspondiente en /types/[entidad].ts
  4. Conectar con el componente de frontend correspondiente
  5. Verificar que lista y detalle funcionan con datos reales

---

## WORKFLOW 5: BLOQUE 3 — BACKEND CRÍTICO
Trigger: Bloque 2 completo y verificado

  PROCESO 1 — Gestión de equipos con asignación a contrato:
    - Crear equipo
    - Asignar a contrato (INSERT en equipo_contratos)
    - Reasignar (fecha_retiro en registro anterior + nuevo registro)
    - Ver historial de contratos del equipo
    Iteración: verificar que v_equipo_contrato_vigente retorna correcto

  PROCESO 2 — Creación de reporte (flujo completo):
    Paso 1: Crear borrador de reporte
    Paso 2: Asociar técnicos de apoyo
    Paso 3: Cargar checklist dinámico según categoría del equipo
    Paso 4: Guardar actividades realizadas
    Paso 5: Registrar insumos usados y requeridos
    Paso 6: Firma del técnico (generar hash SHA-256)
    Paso 7: Firma del cliente (generar hash SHA-256)
    Paso 8: Cerrar reporte (validar constraint de firmas)
    Iteración: verificar que cada paso actualiza estado_reporte correctamente

  PROCESO 3 — Sincronización offline:
    Paso 1: Cola de reportes en IndexedDB (client-side)
    Paso 2: Detección de reconexión
    Paso 3: Envío de lote de reportes pendientes
    Paso 4: Validación de conflictos en servidor
    Paso 5: Confirmación de sincronización (actualizar campo sincronizado)
    Iteración: simular conflicto y verificar que se registra en sync_conflicts

---

## WORKFLOW 6: BLOQUE 4 — VERIFICACIÓN
Trigger: Bloque 3 completo

  CHECK 1: Flujo completo de reporte (crear → checklist → firmas → cerrar)
  CHECK 2: Vistas SQL con datos de prueba reales
  CHECK 3: Equipos con preventivo vencido aparecen en dashboard
  CHECK 4: Sincronización offline simulada
  CHECK 5: Permisos de rol (técnico no accede a rutas de admin)
  CHECK 6: Búsqueda de equipo con número de serie duplicado (validación manual)
  CHECK 7: Reasignación de equipo a nuevo contrato preserva historial