---
trigger: always_on
---

# pwa_implementation.md — PWA Módulo Técnico · MobilHospital

## CONTEXTO DEL PROYECTO

Sistema de mantenimiento de equipos médicos para MobilHospital.
Stack: Next.js 15 (App Router) · TypeScript · Tailwind CSS · PostgreSQL (Supabase) · Prisma.

El módulo de técnicos debe funcionar como PWA instalable en iOS y Android,
con soporte completo de modo offline. El modo offline se especifica por separado
en `offline_mode.md` — este documento cubre solo la capa PWA.

---

## FASE 1 — Web App Manifest

### Archivo a crear
`/public/manifest.json`

```json
{
  "name": "MobilHospital Técnicos",
  "short_name": "MH Técnicos",
  "description": "Gestión de mantenimiento de equipos médicos",
  "start_url": "/tecnico",
  "scope": "/tecnico",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#0f172a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

### Íconos requeridos
Crear en `/public/icons/`:
- `icon-192.png` — 192×192px
- `icon-512.png` — 512×512px
- `apple-touch-icon.png` — 180×180px (específico iOS)

### Vincular en el layout
En `app/tecnico/layout.tsx` agregar en el `<head>`:

```tsx
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#0f172a" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="MH Técnicos" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
```

---

## FASE 2 — Service Worker

### Estrategia de caché

| Tipo de recurso | Estrategia | Razón |
|---|---|---|
| Assets estáticos (JS, CSS, fuentes) | Cache First | No cambian entre sesiones |
| Páginas del módulo técnico | Stale While Revalidate | Carga rápida + actualización en background |
| API calls de lectura (GET) | Network First con fallback | Datos frescos cuando hay red |
| API calls de escritura (POST/PATCH) | Background Sync | Se encolan y envían cuando vuelve la red |

### Archivo a crear
`/public/sw.js`

El Service Worker debe manejar:

```
1. INSTALL — precachea los assets críticos:
   - /tecnico (shell de la app)
   - /tecnico/nuevo-reporte
   - /tecnico/mis-reportes
   - Todos los chunks de JS/CSS generados por Next.js

2. ACTIVATE — limpia cachés de versiones anteriores

3. FETCH — intercepta peticiones:
   - Si la URL empieza con /api/tecnico/* → Network First
   - Si es asset estático → Cache First
   - Si es página → Stale While Revalidate
   - Si no hay red y no hay caché → devuelve /offline.html

4. SYNC (Background Sync) — procesa la cola de reportes pendientes
   cuando se restaura la conexión. Nombre del sync tag: 'sync-reportes'
```

### Registro del Service Worker
Crear `/src/lib/pwa/register-sw.ts`:

```typescript
export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/tecnico/',
      });

      // Escuchar actualizaciones disponibles
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Hay update disponible — notificar al usuario
            dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      });
    } catch (error) {
      console.error('Error registrando Service Worker:', error);
    }
  });
}
```

Llamar esta función desde el layout raíz del módulo técnico con `useEffect`.

---

## FASE 3 — Prompt de instalación

### Hook personalizado
Crear `/src/features/tecnico/hooks/useInstallPrompt.ts`:

```typescript
// Captura el evento beforeinstallprompt de Chrome/Android
// Expone: canInstall (boolean), promptInstall (función)
// En iOS no existe este evento — mostrar instrucciones manuales
```

### Lógica de detección de plataforma

```typescript
export function detectPlatform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

export function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;
}
```

### Componente `<InstallBanner />`
Mostrar en la pantalla de login del módulo técnico.

Comportamiento:
- Si ya está instalada como PWA → no mostrar nada
- Si es Android/Chrome → mostrar botón "Instalar app" que dispara el prompt nativo
- Si es iOS/Safari → mostrar instrucciones: "Toca el ícono de compartir → Agregar a pantalla de inicio"
- El técnico puede cerrar el banner y no vuelve a aparecer en 7 días (guardar en localStorage)

---

## FASE 4 — Página offline

### Archivo a crear
`/public/offline.html`

Página estática simple (no usa Next.js) que el Service Worker sirve cuando:
- No hay conexión
- La página solicitada no está en caché

Debe mostrar:
- Logo de MobilHospital
- Mensaje: "Sin conexión — Tus reportes guardados están disponibles"
- Botón "Ir a mis reportes guardados" → redirige a `/tecnico/mis-reportes`
- Indicador visual del estado offline

Esta página debe ser completamente autónoma (CSS inline, sin imports externos).

---

## FASE 5 — Indicador de estado de red

### Componente `<NetworkStatus />`
Reemplaza el banner visual actual que no tiene lógica real.

Estado que debe mostrar:

```typescript
type NetworkState = {
  isOnline: boolean;
  pendingReports: number;    // reportes en cola esperando sync
  lastSyncAt: Date | null;   // última sincronización exitosa
  isSyncing: boolean;        // sync en progreso ahora mismo
}
```

Comportamiento visual:
- **Online, sin pendientes** → solo un punto verde discreto en el header, sin texto
- **Online, sincronizando** → spinner pequeño + "Sincronizando X reportes..."
- **Offline, con pendientes** → banner amarillo + "Sin conexión · X reportes pendientes"
- **Offline, sin pendientes** → banner gris discreto + "Sin conexión"

---

## FASE 6 — Ajustes UI para móvil

### Viewport y seguridad
En el layout de técnicos:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

El `viewport-fit=cover` es necesario para que la app se vea correctamente en iPhones con notch.

En el CSS global del módulo técnico:
```css
/* Respetar safe areas en iPhone con notch */
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
```

### Teclado móvil en el wizard
Cuando el técnico enfoca un campo de texto en el wizard, el teclado virtual sube
y puede tapar el contenido. Solución:

```typescript
// En cada paso del wizard que tenga inputs:
useEffect(() => {
  const handleResize = () => {
    // Scroll al campo activo cuando el teclado aparece
    if (document.activeElement) {
      (document.activeElement as HTMLElement).scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  };
  window.visualViewport?.addEventListener('resize', handleResize);
  return () => window.visualViewport?.removeEventListener('resize', handleResize);
}, []);
```

### Firma digital en móvil
La firma debe funcionar con el dedo. Usar `react-signature-canvas`.

Configuración recomendada para móvil:
```tsx
<SignatureCanvas
  penColor="black"
  canvasProps={{
    width: Math.min(window.innerWidth - 32, 400), // responsive
    height: 200,
    className: 'border rounded-lg touch-none', // touch-none evita scroll accidental
  }}
/>
```

---

## NOTAS IMPORTANTES

### Limitaciones de iOS / Safari
- El storage de Service Worker en Safari se limita a **~50MB** — suficiente para esta app
- En iOS el prompt de instalación **no existe** — siempre hay que mostrar instrucciones manuales
- Los Service Workers en Safari se eliminan si el usuario no visita la PWA en **más de 7 días**
- En iOS < 16.4, las notificaciones push **no funcionan** en PWAs — no implementar por ahora

### Next.js y Service Workers
Next.js no gestiona el Service Worker automáticamente. El archivo `sw.js` debe estar
en `/public/` y ser un archivo JavaScript estático. No puede ser un módulo de Next.js.

Para el precacheo de los chunks de Next.js (que tienen hashes en el nombre), usar
la librería `workbox-precaching` — simplifica enormemente el manejo de versiones.

### Prueba en dispositivo real
Los Service Workers solo funcionan en HTTPS o en localhost.
Para probar en un celular durante desarrollo, usar `ngrok` o el tunnel de Vercel:
```bash
vercel dev --tunnel
```

---

## ARCHIVOS A CREAR (resumen)

```
/public/
├── manifest.json
├── sw.js
├── offline.html
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── apple-touch-icon.png

/src/
├── lib/pwa/
│   ├── register-sw.ts
│   └── detect-platform.ts
└── features/tecnico/
    ├── hooks/
    │   ├── useInstallPrompt.ts
    │   └── useNetworkStatus.ts
    └── components/
        ├── InstallBanner.tsx
        └── NetworkStatus.tsx
```

---

## ORDEN DE IMPLEMENTACIÓN RECOMENDADO

1. Crear íconos y `manifest.json` → probar que Chrome muestre "Instalar"
2. Crear `offline.html` básica
3. Implementar `sw.js` con caché de assets estáticos solamente
4. Agregar el componente `<NetworkStatus />` con lógica real
5. Implementar Background Sync para la cola de reportes (coordinado con `offline_mode.md`)
6. Agregar `<InstallBanner />` con detección de plataforma
7. Ajustes de UI móvil (safe areas, teclado, firma)
8. Pruebas en dispositivo real iOS y Android