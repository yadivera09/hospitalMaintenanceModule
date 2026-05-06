---
trigger: always_on
---

# offline_ui.md — Capa de Interfaz de Usuario (Modo Offline)
## Módulo de Mantenimiento Mobilhospital

## CONTEXTO
Esta capa cubre todos los componentes visuales que el técnico ve e interactúa en modo offline.
No incluye lógica de almacenamiento ni sincronización — eso está en `offline_logic.md` y `offline_sync.md`.

---

## BANNER DE CONECTIVIDAD

Reemplazar el banner actual (solo visual, sin lógica real) por uno que muestre
estado real y sea accionable.

### Estados del banner

```
🔴 Sin conexión — Modo offline activo
   3 reportes pendientes de sincronización    [Sincronizar ahora]

🟡 Sincronizando...
   Enviando reporte 2 de 3

🟢 Conectado — Todo sincronizado
   Último sync: hace 5 minutos
```

### Reglas del banner
- Siempre visible en el layout del panel técnico (no solo en algunas páginas)
- En estado verde, puede colapsarse automáticamente después de 5 segundos
- El botón "Sincronizar ahora" llama al hook `useOfflineStatus` → método `sync()`
- El conteo de pendientes viene del store `sync_queue` de IndexedDB
- No mostrar el banner en el panel administrador

### Componente
```
/components/tecnico/OfflineBanner.tsx
```

---

## WIZARD DE NUEVO REPORTE (comportamiento offline)

El wizard tiene múltiples pasos. En modo offline NO debe bloquearse en ningún paso.
El técnico debe poder completar el formulario exactamente igual que con conexión.

### Indicador de modo en el wizard
- Mostrar un badge pequeño en el header del wizard: "Guardando localmente" cuando no hay conexión
- Al completar el último paso sin conexión: mostrar mensaje de confirmación:
  "Reporte guardado en tu dispositivo. Se enviará automáticamente cuando tengas conexión."
- Al completar con conexión: comportamiento actual sin cambios

### Pasos del wizard — comportamiento esperado
Cada paso del wizard guarda su progreso localmente (IndexedDB) al avanzar,
independientemente de si hay conexión o no. Esto también sirve como recuperación
ante cierres accidentales de la app.

---

## BÚSQUEDA DE EQUIPOS (offline)

La búsqueda de equipos por código MH debe funcionar offline usando el caché local.

### Comportamiento
- Con conexión: buscar en API normalmente
- Sin conexión: buscar en `equipos_cache` de IndexedDB
- Si el equipo no está en caché: mostrar mensaje "Este equipo no está disponible offline.
  Conéctate para buscarlo." — no bloquear, permitir ingreso manual del código

### Indicador visual
- Mostrar ícono de caché junto al resultado cuando se sirve desde IndexedDB:
  "Resultado desde caché local"

---

## INDICADORES EN EL DASHBOARD TÉCNICO

### Badge en reportes pendientes de sync
Los reportes creados offline que aún no se han sincronizado deben tener un badge visible:

| Estado | Badge | Color |
|---|---|---|
| `pendiente_sync` | "Pendiente sync" | Amarillo |
| `sincronizando` | "Sincronizando..." | Azul |
| `error_sync` | "Error al sincronizar" | Rojo con ícono de advertencia |
| `sincronizado` | Sin badge | — |

### Sección de sync en el dashboard
Añadir una sección pequeña en el dashboard del técnico que muestre:
- Cantidad de reportes pendientes de sync
- Botón "Sincronizar ahora" (visible solo si hay pendientes)
- Último sync exitoso (fecha y hora)

```
/components/tecnico/SyncStatus.tsx
```

---

## REGLAS DE UI

1. Nunca deshabilitar botones del wizard por falta de conexión
2. Nunca mostrar errores de red al técnico como errores de formulario
3. Cualquier error de conectividad se muestra en el banner, no dentro del formulario
4. El técnico no debe necesitar saber si está online u offline para completar su trabajo
5. Los textos de confirmación deben ser claros sobre si el reporte fue al servidor o quedó local