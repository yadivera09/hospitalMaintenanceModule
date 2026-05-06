---
trigger: always_on
---

# offline_sync.md — Capa de Sincronización
## Módulo de Mantenimiento Mobilhospital

## CONTEXTO
Esta capa cubre el proceso de enviar al servidor los reportes creados offline.
Depende de `offline_logic.md` (IndexedDB, stores, estados) y alimenta a
`offline_ui.md` (indicadores visuales de sync).

---

## CUÁNDO SINCRONIZAR

- Al detectar reconexión (`window.addEventListener('online', ...)`)
- Al abrir la app con conexión disponible y haber pendientes
- Manualmente desde el dashboard del técnico (botón "Sincronizar ahora")

No sincronizar automáticamente en background si el técnico está en medio del wizard —
esperar a que termine el paso actual para no interferir.

---

## PROCESO DE SINCRONIZACIÓN

```
/lib/offline/sync.ts
```

```
1. Leer todos los registros de sync_queue con estado pendiente_sync
2. Para cada reporte en la cola (en orden de creación):
   a. Marcar como sincronizando (evita doble envío si se llama dos veces)
   b. POST /api/reportes con los datos del borrador
   c. Si respuesta 200/201:
      - Reemplazar ID local por ID real del servidor en todos los registros relacionados
      - Actualizar estado a sincronizado
      - Eliminar de reportes_borrador
      - Eliminar de sync_queue
   d. Si respuesta de error:
      - Marcar como error_sync
      - Registrar motivo del error
      - NO eliminar el borrador local
      - Continuar con el siguiente reporte de la cola (no abortar todo)
3. Al terminar, actualizar lastSync en useOfflineStatus
4. Mostrar resumen al técnico: "X reportes sincronizados, Y con errores"
```

---

## ENDPOINT DE RECEPCIÓN

```
/app/api/sync/route.ts
```

Recibe un reporte creado offline. Debe:
- Aceptar el mismo formato que `/api/reportes` (POST normal)
- Validar con zod igual que el endpoint regular
- Responder `{ data: { id: string }, error: null }` con el ID real asignado
- Si hay conflicto (ej: equipo ya tiene reporte abierto): responder con error descriptivo,
  NO crear el reporte silenciosamente

---

## MANEJO DE CONFLICTOS

Un conflicto ocurre cuando el servidor rechaza un reporte por inconsistencia de datos.
Ejemplos:
- El equipo ya tiene un reporte en_progreso asignado a otro técnico
- El técnico fue desactivado mientras estaba offline
- El equipo fue reasignado a otro contrato

### Qué hacer ante un conflicto
1. NO sobreescribir silenciosamente
2. Registrar en tabla `sync_conflicts`:
   ```
   reporte_local_id   → ID temporal local del reporte
   motivo             → mensaje de error del servidor
   payload            → datos del reporte que falló (para revisión)
   fecha_intento      → timestamp del intento de sync
   resuelto           → false por defecto
   ```
3. Marcar el reporte como `error_sync` en IndexedDB
4. Mostrar al técnico: qué reporte falló y el motivo
5. El administrador puede ver conflictos pendientes en su panel

---

## REINTENTO MANUAL

Los reportes con estado `error_sync` no se reintentan automáticamente.
El técnico puede:
- Ver el reporte con error en su dashboard
- Tocar "Reintentar" para volver a intentar el envío
- Contactar al administrador si el error persiste

---

## ARCHIVOS INVOLUCRADOS

```
/lib/offline/sync.ts          → lógica principal de sincronización
/lib/offline/db.ts            → stores de IndexedDB (definido en offline_logic.md)
/hooks/useOfflineStatus.ts    → expone pendingCount, lastSync, sync()
/app/api/sync/route.ts        → endpoint de recepción en el servidor
```

---

## CRITERIOS DE ACEPTACIÓN

- [ ] Al recuperar conexión, los reportes pendientes se sincronizan automáticamente
- [ ] Si la sync falla, el reporte NO se pierde — queda como error_sync
- [ ] Los conflictos quedan registrados en sync_conflicts con motivo legible
- [ ] El técnico ve cuántos reportes tiene pendientes y puede sincronizar manualmente
- [ ] La sincronización procesa los reportes en orden de creación
- [ ] Un error en un reporte no aborta la sincronización de los siguientes
- [ ] Al terminar la sync, el banner se actualiza con el resultado