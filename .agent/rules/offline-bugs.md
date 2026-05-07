---
trigger: always_on
---

# offline_bugs.md — Bugs Pendientes Modo Offline
## Módulo de Mantenimiento Mobilhospital

## CONTEXTO
El modo offline tiene implementadas las tres capas (logic, sync, UI) pero persisten
bugs críticos que impiden el flujo completo de creación de reporte offline.
Atacar en el orden listado — los bugs están priorizados por impacto.

---

## BUG 1 — CRÍTICO: El reporte se duplica al sincronizar

### Síntoma
Al crear un reporte con internet y perder la conexión antes de firmar, al reconectar
se crean múltiples copias del mismo reporte en la base de datos (se ven 10+ reportes
"En progreso" del mismo equipo). Los reportes "Pendiente sync" locales también se
multiplican.

### Causa probable
`guardarPaso()` en `useOfflineReporte` está añadiendo entradas a `sync_queue` en
cada avance de paso, en lugar de solo guardar en `reportes_borrador`. Al sincronizar,
cada entrada de la cola crea un reporte nuevo en el servidor.

### Fix esperado
- `guardarPaso()` → solo escribe en `reportes_borrador` (crash recovery). NUNCA toca `sync_queue`
- `finalizarReporte()` → es el ÚNICO que añade una entrada a `sync_queue`
- Verificar que no haya otras rutas de código que añadan a `sync_queue` fuera de `finalizarReporte()`
- Añadir guard en `sync.ts`: antes de procesar una entrada de `sync_queue`, verificar
  que no existe ya un reporte con el mismo `equipo_id` + `tecnico_id` + `fecha` en el
  servidor para evitar duplicados aunque la cola tenga entradas repetidas

### Limpieza requerida
Eliminar manualmente en Supabase todos los reportes duplicados de prueba antes de
verificar el fix.

---

## BUG 2 — CRÍTICO: La firma no se guarda offline y rompe el flujo

### Síntoma
Al llegar al paso de firma sin conexión (o perder conexión antes de firmar):
- El botón "Firmar y enviar reporte" falla silenciosamente o lanza error en consola
- El técnico es redirigido al dashboard sin confirmación
- El reporte no queda guardado localmente con la firma

Errores en consola:
```
Uncaught (in promise) Error: A listener indicated an asynchronous response
by returning true, but the message channel closed before a response was received

GET https://[supabase].co/rest/v1/tecnicos... net::ERR_INTERNET_DISCONNECTED

Failed to fetch RSC payload. Falling back to browser navigation.
```

### Causa probable
El componente de firma llama directamente a un endpoint de Supabase o a una server
action para obtener datos del técnico (nombre, id) al momento de firmar, sin pasar
por `useOfflineReporte`. Cuando no hay red, ese fetch falla y rompe todo el paso.

### Fix esperado
- Los datos del técnico necesarios para la firma deben estar disponibles localmente
  (ya deberían estar en `catalogos_cache` desde el preload del login)
- El paso de firma debe usar `useOfflineReporte.guardarPaso(4, { firma_base64 })`
  para guardar el canvas en `reportes_borrador`
- `finalizarReporte()` debe incluir la firma en el payload que se encola en `sync_queue`
- El botón "Firmar y enviar reporte" sin conexión debe mostrar:
  "Firma guardada. El reporte se enviará cuando tengas conexión." — no redirigir al dashboard
- Eliminar cualquier fetch a Supabase que ocurra dentro del paso de firma

### El error del Service Worker
`A listener indicated an asynchronous response by returning true, but the message
channel closed` viene de `sw.js`. Revisar todos los `addEventListener('message', ...)`
en el SW — si alguno retorna `true` (indicando respuesta asíncrona) pero no llama
`event.ports[0].postMessage()` antes de que el canal se cierre, lanzará este error.
Corregir o eliminar los listeners de mensaje que no resuelven correctamente.

---

## BUG 3 — ALTO: Búsqueda de equipos no funciona offline

### Síntoma
Sin conexión, al escribir en el buscador del paso 1 del wizard:
- Muestra "Sin resultados para X" aunque el técnico haya usado la app con conexión antes
- El banner de modo offline tapa visualmente el buscador de equipos

### Causa probable 1 — caché vacío
`precargarDatosOffline(tecnicoId)` no se está ejecutando correctamente al hacer login,
o los equipos no se están guardando en `equipos_cache` de IndexedDB.

### Causa probable 2 — el buscador no consulta IndexedDB
El componente de búsqueda de equipos detecta `isOnline === false` pero en lugar de
buscar en `equipos_cache` devuelve array vacío o no implementa la búsqueda local.

### Fix esperado
1. Verificar que `precargarDatosOffline()` se llama al completar el login y que
   `equipos_cache` tiene datos (revisar en DevTools → Application → IndexedDB)
2. En el buscador de equipos, cuando `isOnline === false`:
   - Buscar en `equipos_cache` filtrando por el término ingresado (código MH, nombre, serie)
   - Mostrar aviso: "Sin conexión. Mostrando equipos guardados localmente."
   - Si `equipos_cache` está vacío: mostrar "No hay equipos disponibles offline.
     Abre la app con conexión al menos una vez." — no mostrar spinner infinito

### Fix visual
El banner "Sin conexión" en el wizard no debe superponerse al contenido del buscador.
Verificar que el banner tiene altura fija y el contenido debajo tiene el padding-top correcto.

---

## BUG 4 — MEDIO: Hay que presionar varias veces para avanzar de paso

### Síntoma
Al avanzar entre pasos del wizard (especialmente offline), el botón "Siguiente"
requiere múltiples clicks para responder.

### Causa probable
`guardarPaso()` es async y el botón no está deshabilitado mientras se procesa.
El técnico clickea varias veces pensando que no funcionó, generando múltiples
llamadas simultáneas.

### Fix esperado
- Deshabilitar el botón "Siguiente" mientras `guardarPaso()` esté en ejecución
- Mostrar un estado de carga mínimo (spinner o texto "Guardando...") durante el proceso
- Una vez resuelto, habilitar el botón y avanzar al siguiente paso

---

## BUG 5 — BAJO: El banner offline tapa el saludo en el dashboard

### Síntoma
El banner "Sin conexión — Modo offline activo" empuja o tapa el saludo
"Buenos días/tardes, [nombre]" y la fecha en el dashboard del técnico.

### Fix esperado
El banner debe estar integrado dentro del navbar existente (como un pill o badge)
o usar `position: fixed` con z-index apropiado para no desplazar el contenido.
En el dashboard, el saludo debe ser siempre visible independientemente del estado de red.

---

## ORDEN DE ATAQUE RECOMENDADO

1. **Bug 2** (firma) — desbloquea el flujo completo offline
2. **Bug 1** (duplicados) — una vez que la firma funcione, verificar que no se duplica
3. **Bug 3** (búsqueda offline) — independiente, se puede trabajar en paralelo
4. **Bug 4** (doble click) — fix rápido, una vez resueltos los críticos
5. **Bug 5** (banner visual) — cosmético, al final

---

## VERIFICACIÓN FINAL (después de todos los fixes)

- [ ] Abrir app sin conexión → ver dashboard con saludo visible y banner integrado
- [ ] Buscar equipo offline → ver resultados del caché local
- [ ] Crear reporte completo offline (todos los pasos + firma) → confirmación local
- [ ] Reconectar → sync automático → exactamente 1 reporte creado en Supabase
- [ ] Crear reporte con conexión, perder red antes de firmar → flujo no se rompe
- [ ] Reconectar después del caso anterior → 1 reporte sincronizado, sin duplicados
- [ ] Revisar Supabase: cero reportes duplicados del mismo equipo + técnico + fecha