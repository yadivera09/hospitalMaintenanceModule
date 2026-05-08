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

## BUG 2 — ~~CRÍTICO~~ PARCIALMENTE RESUELTO: La firma no redirige al dashboard tras guardar offline

### Estado
La firma se guarda correctamente offline. El problema ahora es el comportamiento
post-firma: el técnico **no es redirigido al dashboard** después de firmar sin conexión,
y el dashboard no muestra el estado "Esperando sincronización" para el reporte pendiente.

### Síntoma actual
- La firma se captura y guarda en `reportes_borrador` ✓
- Al confirmar la firma sin conexión, el flujo se detiene — no hay redirección
- El dashboard no refleja el reporte como "Pendiente sync" al volver

### Causa probable
`finalizarReporte()` probablemente hace `await` a alguna operación de red (fetch a
Supabase o server action) antes de ejecutar el `router.push('/dashboard')`. Sin
conexión, ese await cuelga o falla silenciosamente y nunca se alcanza la redirección.

### Fix esperado
- `finalizarReporte()` debe seguir este flujo estrictamente:
  1. Guardar firma en `reportes_borrador` (IndexedDB) — operación local, sin red
  2. Añadir entrada a `sync_queue` (IndexedDB) — operación local, sin red
  3. `router.push('/dashboard')` — **siempre**, independientemente del estado de red
- La redirección NO debe estar condicionada a que el reporte llegue a Supabase
- En el dashboard, al volver, debe mostrarse el reporte recién creado con estado
  "Pendiente sync" (leer desde `sync_queue` o `reportes_borrador` local)
- El sync real a Supabase ocurre en background cuando se detecta reconexión —
  el técnico no debe esperar ese proceso

### Mensaje de confirmación antes de redirigir
Mostrar brevemente (toast o pantalla intermedia):
> "Firma guardada. El reporte se enviará automáticamente cuando tengas conexión."

Luego redirigir al dashboard. No bloquear la UI esperando respuesta del servidor.

### Nota sobre el error del Service Worker (previo, para referencia)
`A listener indicated an asynchronous response by returning true, but the message
channel closed` venía de `sw.js`. Revisar todos los `addEventListener('message', ...)`
— si alguno retorna `true` pero no llama `event.ports[0].postMessage()` antes de que
el canal se cierre, lanzará este error. Corregir o eliminar los listeners que no
resuelven correctamente.

---

## BUG 3 — ~~ALTO~~ RESUELTO PARCIALMENTE: Búsqueda offline funciona, superposición visual persiste en dashboard

### Estado
La búsqueda de equipos offline ya funciona correctamente — filtra desde `equipos_cache`
con los términos ingresados. ✓

### Síntoma pendiente
El banner "Sin conexión" sigue superponiéndose visualmente al contenido del **dashboard**
(no solo al wizard). El saludo, los reportes recientes o los botones de acción quedan
parcialmente tapados por el banner.

### Causa probable
El banner de modo offline en el dashboard tiene `position: fixed` o `position: sticky`
sin que el contenedor principal tenga el `padding-top` o `margin-top` compensatorio.
Al renderizarse el banner, empuja o se superpone al contenido en lugar de desplazarlo.

### Fix esperado
- El banner debe ocupar espacio en el flujo del documento (no flotar sobre el contenido)
- Si se mantiene `position: fixed`, el layout wrapper del dashboard debe aplicar
  dinámicamente un `padding-top` igual a la altura del banner cuando `isOnline === false`
- Verificar que el banner tiene altura fija o conocida para calcular el offset correctamente
- Aplicar el mismo fix en todas las vistas que usen el banner (dashboard, wizard, listados)

---

## BUG 4 — ALTO: Timeout al crear nuevo reporte sin conexión

### Síntoma
Sin internet, al presionar "Crear nuevo reporte" (botón `+` o equivalente en el
dashboard), la acción demora varios segundos antes de responder o no responde en
absoluto. El técnico queda esperando sin feedback.

### Causa probable
El handler del botón probablemente dispara una llamada a Supabase (fetch de catálogos,
verificación de sesión, o precarga de datos del equipo) de forma **síncrona antes de
navegar**. Sin red, esa llamada espera hasta que agota su timeout (generalmente 10–30s)
antes de fallar y continuar.

### Fix esperado
- El botón "Crear nuevo reporte" debe navegar **inmediatamente** a la ruta del wizard
  sin esperar ninguna llamada de red
- Cualquier fetch de catálogos o datos necesarios para el wizard debe:
  1. Primero intentar leer desde `catalogos_cache` / `equipos_cache` en IndexedDB
  2. Disparar el fetch de red **en paralelo o en background**, no bloqueando la navegación
- Si `isOnline === false`, omitir completamente los fetches de red al iniciar el wizard
- Añadir un indicador de carga inmediato (spinner o skeleton) mientras se leen los
  datos locales, para que el técnico reciba feedback en < 200ms tras el click

---

## BUG 5 — ALTO: Seleccionar equipo e iniciar reporte redirige al dashboard en lugar de avanzar

### Síntoma
Sin conexión, en el paso 1 del wizard: el técnico busca un equipo, lo selecciona, y
presiona "Iniciar reporte". En lugar de avanzar al paso 2, la app redirige al dashboard.
El reporte no se crea.

### Causa probable
Al confirmar el equipo, probablemente se ejecuta una validación o fetch contra Supabase
(ej: verificar que el equipo existe, obtener su historial, o crear el registro inicial
del reporte en la BD). Sin red, ese fetch falla y el error handler ejecuta
`router.push('/dashboard')` como fallback de error en lugar de continuar offline.

### Fix esperado
- Al seleccionar equipo y presionar "Iniciar reporte", NO debe hacerse ningún fetch
  de red antes de avanzar al paso 2
- La selección del equipo debe guardarse en `reportes_borrador` via `guardarPaso(1, { equipo })`
  — operación local, sin red
- El fetch de historial u otros datos del equipo puede hacerse en background o diferirse
  al momento de sincronización final
- Revisar el `catch` del handler de "Iniciar reporte": si actualmente hace
  `router.push('/dashboard')` al fallar, cambiarlo para que solo registre el error
  en consola y continúe el flujo offline
- El avance al paso 2 debe ocurrir siempre que el equipo esté seleccionado y los
  datos estén disponibles localmente

---

## ORDEN DE ATAQUE RECOMENDADO

1. **Bug 4** (timeout al crear reporte) — desbloquea la entrada al wizard
2. **Bug 5** (selección de equipo no avanza) — desbloquea el flujo completo del wizard
3. **Bug 2** (redirección post-firma) — cierra el loop del flujo offline end-to-end
4. **Bug 1** (duplicados en sync) — validar una vez que el flujo completo funcione
5. **Bug 3** (banner superpuesto en dashboard) — cosmético, al final

---

## VERIFICACIÓN FINAL (después de todos los fixes)

- [ ] Abrir app sin conexión → ver dashboard con saludo visible y banner integrado (sin superposición)
- [ ] Click en "Crear nuevo reporte" sin internet → navegación inmediata al wizard (< 200ms)
- [ ] Buscar equipo offline → ver resultados del caché local con aviso "Sin conexión"
- [ ] Seleccionar equipo → "Iniciar reporte" → avanza al paso 2 sin redirigir al dashboard
- [ ] Crear reporte completo offline (todos los pasos + firma) → confirmación local + redirección al dashboard
- [ ] Dashboard muestra reporte con estado "Pendiente sync" tras completar flujo offline
- [ ] Reconectar → sync automático en background → exactamente 1 reporte creado en Supabase
- [ ] Crear reporte con conexión, perder red antes de firmar → flujo no se rompe
- [ ] Reconectar después del caso anterior → 1 reporte sincronizado, sin duplicados
- [ ] Revisar Supabase: cero reportes duplicados del mismo equipo + técnico + fecha