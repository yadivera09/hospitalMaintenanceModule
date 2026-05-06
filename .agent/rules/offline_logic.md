---
trigger: always_on
---

# offline_logic.md — Capa de Lógica Offline
## Módulo de Mantenimiento Mobilhospital

## CONTEXTO
Esta capa cubre el almacenamiento local con IndexedDB y la lógica que decide
cuándo guardar en servidor vs. guardar localmente. No incluye componentes visuales
(`offline_ui.md`) ni el proceso de sincronización (`offline_sync.md`).

Antes de implementar: revisar si ya existe alguna implementación de IndexedDB,
Service Worker o hooks de conectividad en el proyecto. Reemplazar lo que no funcione,
conservar lo que sí.

---

## ALMACENAMIENTO LOCAL — IndexedDB

### Librería
Usar `idb` (wrapper tipado para IndexedDB). Instalar si no existe:
```bash
npm install idb
```

### Stores necesarios

```
reportes_borrador   → reportes creados offline, pendientes de sync
equipos_cache       → equipos buscados/cargados recientemente
catalogos_cache     → tipos_mantenimiento, insumos, categorias, checklists
sync_queue          → cola de operaciones pendientes de enviar al servidor
```

### Inicialización
```
/lib/offline/db.ts   → abrir/versionar la base IndexedDB, exportar instancia tipada
```

Versionar la DB correctamente — si se añaden stores en el futuro, usar `upgrade()`
de `idb` sin borrar datos existentes.

---

## ESTADOS DE UN REPORTE LOCAL

```
pendiente_sync    → creado offline, aún no enviado al servidor
sincronizando     → en proceso de envío (evita doble envío)
sincronizado      → confirmado por el servidor (tiene ID real de la DB)
error_sync        → falló el envío, requiere atención, NO eliminar
```

### IDs locales
Los reportes creados offline usan un ID temporal con prefijo `local_`:
```
local_<uuid_generado_en_cliente>
```
Este ID nunca se envía al servidor. Se reemplaza por el ID real tras la sincronización.
Todas las referencias internas (checklist, insumos, firma) usan el ID local hasta que se sincronice.

---

## HOOK PRINCIPAL: useOfflineReporte

Este hook envuelve el wizard de nuevo reporte y decide si guardar en servidor o en local.

```
/hooks/useOfflineReporte.ts
```

### Lógica del hook

```typescript
// Pseudocódigo — implementar con tipos reales del proyecto
function useOfflineReporte() {
  const { isOnline } = useOfflineStatus()

  async function guardarPaso(paso: number, datos: DatosPaso) {
    if (isOnline) {
      // Guardar en servidor (comportamiento actual)
      await api.guardarPaso(paso, datos)
    } else {
      // Guardar en IndexedDB
      await db.reportes_borrador.put({ paso, datos, estado: 'pendiente_sync' })
    }
  }

  async function finalizarReporte(datosCompletos: DatosReporte) {
    if (isOnline) {
      await api.crearReporte(datosCompletos)
    } else {
      await db.reportes_borrador.put({ ...datosCompletos, estado: 'pendiente_sync' })
      await db.sync_queue.add({ tipo: 'crear_reporte', payload: datosCompletos })
    }
  }

  return { guardarPaso, finalizarReporte }
}
```

---

## HOOK DE ESTADO: useOfflineStatus

```
/hooks/useOfflineStatus.ts
```

Expone:
```typescript
{
  isOnline: boolean           // estado actual de red
  pendingCount: number        // reportes en sync_queue pendientes
  lastSync: Date | null       // último sync exitoso
  sync: () => Promise<void>   // disparar sincronización manual
}
```

Detectar conectividad con:
```typescript
navigator.onLine
window.addEventListener('online', handler)
window.addEventListener('offline', handler)
```

---

## PRECARGA DE DATOS AL LOGIN

Cuando el técnico inicia sesión con conexión disponible, ejecutar en background:

```
/lib/offline/preload.ts
```

```typescript
async function precargarDatosOffline(tecnicoId: string) {
  // Catálogos base (rara vez cambian, TTL 24h)
  await cachear('/api/tipos-mantenimiento', 'catalogos_cache')
  await cachear('/api/insumos', 'catalogos_cache')
  await cachear('/api/categorias-equipo', 'catalogos_cache')

  // Checklists por categoría
  await cachear('/api/checklist/todas', 'catalogos_cache')

  // Equipos del técnico (para búsqueda offline)
  await cachear(`/api/equipos?tecnico_id=${tecnicoId}`, 'equipos_cache')
}
```

### TTL de caché
- Catálogos (`catalogos_cache`): 24 horas
- Equipos (`equipos_cache`): 12 horas
- Al reconectar, refrescar los stores cuyo TTL haya vencido antes de usarlos

---

## SERVICE WORKER

```
/public/sw.js
```

Registrar solo en producción. Estrategias por tipo de request:

| Tipo de request | Estrategia |
|---|---|
| Assets estáticos (JS, CSS, fuentes) | Cache First |
| Catálogos y datos de referencia | Stale While Revalidate |
| Creación/mutación de datos | Network only + Background Sync si falla |

El Service Worker no maneja la lógica de reportes — eso es responsabilidad
de `useOfflineReporte`. El SW solo maneja assets y catálogos.

---

## FIRMA DIGITAL EN MODO OFFLINE

La firma del técnico (canvas) se guarda como base64 en `reportes_borrador` de IndexedDB,
igual que se enviaría al servidor. No hay diferencia en el flujo del canvas entre online y offline.
Al sincronizar, el base64 se envía junto con el resto del reporte.

---

## REGLAS DE IMPLEMENTACIÓN

1. Nunca borrar un borrador local sin confirmación del servidor
2. Los IDs locales (`local_*`) nunca llegan al servidor
3. El hook `useOfflineReporte` es la única puerta de entrada para guardar reportes —
   no llamar a la API de reportes directamente desde el wizard
4. Si hay conexión al abrir el wizard, pero se pierde durante el llenado,
   el hook debe detectarlo y cambiar a modo local sin perder los datos ya ingresados
5. TypeScript estricto — tipar todos los stores de IndexedDB con interfaces del proyecto