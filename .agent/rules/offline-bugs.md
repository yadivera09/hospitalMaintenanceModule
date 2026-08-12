---
trigger: always_on
---

# offline-bugs.md — Mapa de fallos del modo offline
## Módulo de Mantenimiento Mobilhospital · auditoría del 2026-08-12

## CONTEXTO

Las tres capas (datos, sincronización, UI) están implementadas y el flujo completo
funciona en el camino feliz. Lo que falla es todo lo demás: el dispositivo se vacía
solo pasadas unas horas, la cola no se vacía sin intervención, y el reintento crea
reportes duplicados que además queman números de serie.

Esta auditoría sustituye a la anterior (bugs 1–5 de la ronda de julio). Al final se
indica qué quedó vivo de aquella.

**Los 19 fallos están agrupados por causa, no por síntoma.** Varios síntomas que el
técnico reporta por separado salen del mismo defecto.

## ESTADO (2026-08-12)

| | |
|---|---|
| **Corregidos** | A1, A2, A4, B1, B2, B3, B4, B5, B6, B7, B8, C1, C3, D1, D2, D3, D4 |
| **Cerrados sin cambios — no eran fallos** | A3 y C2 (leer sus apartados antes de volver a tocarlos) |

**Los 19 están resueltos.** 17 con código o migración, 2 cerrados por análisis
tras comprobar que no eran fallos.

Las tres migraciones **024 → 025 → 026** están aplicadas y verificadas en
producción (2026-08-12). La 026 dependía de la 024.

Resultado en la base tras aplicarlas: 37 seriales, del 1 al 37, **cero huecos**
(eran 18), cero repetidos, contador en 37, secuencia `seq_numero_reporte`
eliminada. Comprobado además que dos llamadas seguidas a
`cerrar_borrador_reporte` sobre un reporte cerrado devuelven el mismo serial sin
consumir números.

**Sin verificar en campo:** nada de esto se ha probado de punta a punta con un
dispositivo real sin red. Hace falta una sesión de técnico —el usuario
administrador no entra al panel— y una build de producción, porque en desarrollo
los chunks no llevan hash y el service worker se comporta distinto.

### Guion de prueba en campo

Con `npm run build && npm start` y sesión de TÉCNICO. Cortar la red desde el
sistema operativo, no desde las DevTools: hay que cerrar también el service
worker, no solo la pestaña.

1. **El dispositivo aguanta.** Abrir la app, esperar al aviso verde de "listo".
   Cortar la red y **esperar más de 12 horas** (o adelantar el reloj del
   dispositivo). Abrir el wizard sobre un equipo. Antes: *"Equipo no disponible
   offline"*. Ahora debe abrirse con todo — tipos, insumos, checklist. **[A1, A2]**

2. **La cola se vacía sola.** Sin red, crear y firmar dos o tres reportes. Cerrar
   la app del todo. Recuperar la red y volver a abrirla **sin tocar nada**: los
   pendientes deben subir sin pulsar "Sincronizar ahora", y el contador llegar a
   cero. **[B1, B2]**

3. **No se duplican.** Con la red inestable —activarla y desactivarla mientras
   sincroniza— comprobar en `/admin/reportes` que sale UN reporte por cada uno
   creado, y que los seriales siguen siendo consecutivos. **[B4, B5, C1]**

4. **Dos reportes el mismo día.** Sin red, crear dos reportes del MISMO equipo
   con el mismo técnico —un preventivo y un correctivo— y firmar los dos.
   Sincronizar. **Tienen que llegar los dos.** Antes el segundo se borraba sin
   subirse. **[B5]**

5. **Duplicar.** Con red, duplicar un reporte cerrado: antes fallaba siempre.
   Sin red, duplicar otro y abrirlo: la hora de entrada debe ser la de ahora, la
   de salida vacía, y los insumos con su nombre, no solo la cantidad.
   **[D1, D2, D4]**

6. **La hora de salida.** Firmar un reporte sin red a las 16:00 y sincronizarlo
   al día siguiente. `hora_salida` debe ser 16:00, no la hora de la
   sincronización. **[D3]**

---

# A — EL DISPOSITIVO SE VACÍA SOLO
### Síntoma reportado: "para entrar al modo offline necesito tener al menos un poco de internet"

## A1 — CRÍTICO: los datos caducan y sin red no hay forma de renovarlos

`src/lib/offline/db.ts:131-132`

```
const TTL_CATALOGOS_MS = 24 * 60 * 60 * 1000   // 24 h
const TTL_EQUIPOS_MS   = 12 * 60 * 60 * 1000   // 12 h
```

`buscarEquipoEnCache` (`db.ts:316-321`) y `getAllEquiposFromCache` (`db.ts:339-344`)
descartan por TTL. A las 12 horas sin conexión el wizard responde *"Equipo no
disponible offline"* aunque el equipo esté ahí, íntegro, en IndexedDB. Los catálogos
mueren a las 24.

El TTL tiene sentido con red — evita trabajar con datos viejos. Sin red es
exactamente al revés: un dato de ayer es infinitamente mejor que ninguno, y no
existe la opción de refrescarlo. **Un caché offline no debe caducar mientras no haya
con qué reemplazarlo.**

**Fix:** el TTL pasa a ser una señal de "conviene refrescar", no de "descarta". Sin
conexión se sirve siempre lo que haya. Con conexión, un dato vencido se usa igual y
se dispara la recarga en segundo plano.

## A2 — ALTO: las lecturas de catálogo no son consistentes entre sí

`src/app/(tecnico)/tecnico/nuevo-reporte/[equipoId]/page.tsx:974-981`

```
getCatalogo<TecnicoData>('tecnico_actual'),           // caduca
getCatalogo<TipoMantenimiento[]>('tipos_mantenimiento'), // caduca
getCatalogo<Insumo[]>('insumos'),                     // caduca
getCatalogo<UbicacionConCliente[]>('ubicaciones', true), // no caduca
getCatalogo<TecnicoData[]>('tecnicos', true),         // no caduca
```

Tres pasan `ignoreExpiry` y tres no, sin ningún criterio aparente. El resultado es
que a las 24 horas el wizard offline pierde tipos de mantenimiento e insumos pero
conserva ubicaciones y técnicos: medio formulario vacío. Se arregla solo con A1.

## A3 — DESCARTADO: no es un fallo

Este apartado estaba mal. Se deja escrito para que nadie vuelva a "arreglarlo".

El diagnóstico era: el service worker deja pasar a la red las peticiones RSC
(`public/sw.js:294-297`), sin red fallan, luego navegar por enlaces no funciona
offline.

La primera mitad es cierta; la conclusión no. Next.js captura el fallo del RSC y
cae a una navegación completa del navegador —comprobado en el paquete instalado,
`next/dist/client/components/router-reducer/fetch-server-response.js` (14.2.35)—:

```js
} catch (err) {
    console.error("Failed to fetch RSC payload for " + url + ". Falling back to browser navigation.", err);
    // If fetch fails handle it like a mpa navigation
```

Y esa navegación dura SÍ la intercepta el service worker (`request.mode ===
'navigate'`), que la sirve desde el shell cacheado. O sea que navegar sin red
funciona: pasa por un intento fallido y una recarga, y sale.

**Cachear los payloads RSC sería además arriesgado**: varían según la cabecera
`Next-Router-State-Tree`, de modo que una misma URL tiene distintas respuestas
válidas. Guardarlas por URL serviría el árbol equivocado. El `return` de
`sw.js:294-297` es deliberado y correcto.

La causa real de "hace falta internet para que cargue" era **A1**, el TTL de 12
horas que vaciaba el caché de equipos.

## A4 — MEDIO: la preparación offline no se reintenta

`src/lib/offline/preparar.ts:186` corta si `navigator.onLine` es falso, y
`TecnicoLayoutClient` solo la lanzaba al montar el layout. Si el técnico abría la
app con mala cobertura —o sin ninguna— la preparación fallaba y no volvía a
intentarse hasta recargar la página. El escenario que la preparación existe para
evitar era justo el que la dejaba sin hacer.

**Corregido:** se reintenta al recuperar conexión y al volver la pestaña a primer
plano, con un guardián que impide que dos disparadores se solapen. Solo la fase
`listo` cierra el asunto; `listo-parcial` vuelve a intentarse. El aviso al técnico
ya no le pide reabrir la app, solo que no salga a campo hasta ver el "listo".

---

# B — LA COLA NUNCA TERMINA DE VACIARSE
### Síntoma reportado: "al sincronizar siempre me queda algo pendiente"

## B1 — CRÍTICO: la sincronización automática solo existe en la transición offline→online

`src/hooks/useOfflineStatus.ts:49-71`

El único disparador automático es el evento `online`. Ese evento **solo se emite al
cambiar de estado**. El caso más común en campo — el técnico llega a la oficina,
abre la app y ya hay WiFi — no dispara nada: al montar solo se cuenta la cola, no se
sincroniza. Los reportes se quedan ahí hasta que alguien pulse "Sincronizar ahora".

Esta es la causa principal de lo que reportas. **Es también la que explica por qué
"siempre" queda algo:** no es que falle un reporte concreto, es que nada arranca.

**Fix:** sincronizar al montar si hay red y cola; reintentar con espera creciente
mientras queden pendientes; y volver a intentarlo cuando la pestaña vuelve a primer
plano.

## B2 — ALTO: el contador de pendientes ignora lo que sube el service worker

`public/sw.js:530-533` avisa a las pestañas abiertas:

```js
client.postMessage({ type: 'SYNC_COMPLETED', reporteId: reporte.id })
```

**Nadie escucha ese mensaje.** No hay un solo `addEventListener('message')` en toda
la app. Cuando el background sync sube los reportes, el contador sigue mostrando los
pendientes de antes: la app dice que faltan reportes que ya están en el servidor.
Parte del "siempre queda algo pendiente" es este espejismo.

## B3 — ALTO: sin reintento, un fallo transitorio es permanente

`sync.ts:132-146` marca el reporte como `error_sync` y lo deja en la cola. No hay
reintento ni espera creciente: hasta el próximo evento `online` o hasta que el
técnico pulse el botón, ahí se queda. Un microcorte de red basta para dejar un
reporte atascado indefinidamente.

## B4 — CRÍTICO: `/api/sync` no es atómico ni idempotente

`src/app/api/sync/route.ts:117-251` — cuatro pasos sueltos: crear borrador, guardar
detalle, guardar insumos, aplicar firmas.

Si falla el paso 4, el reporte **ya existe en el servidor**, pero la respuesta es un
error y el cliente nunca llega a guardar el `reporte_server_id`. En el siguiente
intento vuelve a entrar por la rama "crear" y **produce otro reporte**. Cada
reintento, uno más.

Los pasos 2 y 3 sí revierten (`activo: false`), el 4 no.

**Fix:** devolver el `reporte_server_id` también en las respuestas de error
parcial, para que el reintento actualice en vez de crear. Idealmente, una única RPC
transaccional en Postgres.

## B5 — CRÍTICO: la detección de duplicados borra reportes buenos

`src/lib/offline/sync.ts:87-110`

```js
.eq('equipo_id', ...).eq('tecnico_principal_id', ...)
.gte('fecha_inicio', `${fechaSolo}T00:00:00.000Z`)
.lt('fecha_inicio',  `${fechaSolo}T23:59:59.999Z`)
.maybeSingle()
```

Dos defectos en el mismo bloque:

1. **Falso positivo con pérdida de datos.** Si encuentra coincidencia,
   `eliminarReporteBorrador()` y suma a `sincronizados`. Dos reportes legítimos del
   mismo equipo, mismo técnico y mismo día — un preventivo por la mañana y un
   correctivo por la tarde — y el segundo **se borra sin subirse y se cuenta como
   sincronizado**. Desaparece sin dejar rastro ni aviso.

2. **Falso negativo.** `maybeSingle()` devuelve error si hay más de una fila. El
   error se captura y se ignora (`catch` en la línea 107), `duplicado` queda null y
   se crea el duplicado de todos modos. Es decir: la protección se apaga sola justo
   cuando ya hay duplicados, que es cuando más falta hace.

Este bloque viene de la ronda anterior (el "Fix esperado" de aquel BUG 1). La
heurística equipo+técnico+fecha no distingue un reintento de un trabajo distinto, y
no puede: **la identidad del reporte es su id local**, que ya existe y no se usa.

**Fix:** mandar el id local al servidor y que sea él quien decida por clave única.
El cliente no debe borrar nada por su cuenta.

## B6 — ALTO: en el service worker, un envío muerto atasca la cola para siempre

`public/sw.js:502`

```js
if (reporte.estado === 'sincronizando') continue
```

`sync.ts:59` sí tiene el margen de abandono de dos minutos —y su comentario explica
justo este fallo—, pero **la copia del service worker se quedó sin él**. Un reporte
que muera a mitad de envío (pestaña cerrada, móvil bloqueado) queda marcado
`sincronizando` y el background sync lo salta en cada pasada, para siempre.

## B7 — MEDIO: `hora_salida` se pierde si no hay estado del equipo

`src/app/api/sync/route.ts:164-171` — `hora_salida` viaja dentro de
`guardarDetalleReporte`, que solo se llama `if (reporte.estado_equipo_post)`. Un
reporte sincronizado sin ese campo pierde la hora de salida en silencio.

## B8 — BAJO: la sesión se valida con `getSession()`

`src/app/api/sync/route.ts:89`. El resto del código usa `getUser()`, que verifica el
JWT contra el servidor de Auth; `getSession()` se fía de la cookie. En un endpoint
que escribe reportes debería ser `getUser()`.

---

# C — LOS NÚMEROS DE REPORTE SALTAN
### Síntoma reportado: "el último era RPT-000036 y los de offline salieron RPT-000054 y 55"

## C1 — ALTO: cada reintento quema un número de serie, y confirmado en los datos

`db/migrations/023_estado_cerrado_unico.sql:165`

```sql
v_serial := 'RPT-' || LPAD(nextval('seq_numero_reporte')::TEXT, 6, '0');
UPDATE ... WHERE estado_reporte = 'en_progreso' AND numero_reporte_fisico IS NULL;
IF NOT FOUND THEN RAISE EXCEPTION ...
```

`nextval()` se consume **antes** del UPDATE, y PostgreSQL **no revierte las
secuencias al hacer rollback** — es deliberado, así las secuencias no bloquean entre
transacciones concurrentes. Así que cada llamada que después falla se lleva un
número por delante.

Comprobado contra la base de producción:

```
reportes con serial:     37
serial mínimo / máximo:  1 / 55
números quemados:        18  →  10, 37, 38, 39 … 53
```

El bloque 37–53 son **17 números consecutivos quemados el 2026-08-07 entre las 19:29
(RPT-000036) y las 20:30 (RPT-000054)**. Coincide exactamente con lo que reportas, y
la única actividad en esa hora fue el reintento de sincronización: 17 intentos
fallidos, 17 números.

O sea que C1 no es un fallo aparte — **es el rastro que dejan B4 y B5.** Arreglados
esos, la sangría se detiene.

**Fix:** pedir el número solo cuando el cierre esté garantizado (dentro de la misma
transacción y después de comprobar que procede), o aceptar los huecos y documentarlo.
Una secuencia nunca garantiza continuidad; si el número tiene valor legal y debe ser
correlativo, no puede salir de una secuencia.

## C3 — CRÍTICO: el serial y el número del reporte en papel comparten columna

Descubierto al preparar la renumeración; no estaba en la primera pasada.

`numero_reporte_fisico` tiene dos dueños:

- **El técnico lo teclea.** `page.tsx:369`, campo con marcador `"Ej: 0007325"` —
  es el número del talonario de papel, para trazabilidad con la copia firmada.
- **El sistema escribe ahí el serial.** `cerrar_borrador_reporte` guarda
  `RPT-000001` en esa misma columna.

Y el cierre exige que esté vacía:

```sql
UPDATE ... WHERE estado_reporte = 'en_progreso' AND numero_reporte_fisico IS NULL;
IF NOT FOUND THEN RAISE EXCEPTION ...
```

O sea: **si el técnico escribe el número de su talonario, el reporte no puede
cerrarse.** `nextval()` ya se consumió, la sentencia no encuentra fila, salta la
excepción — y el número queda quemado. Cada reporte con número de papel se lleva
un serial por delante y encima falla al cerrar.

En la base hay 4 reportes con número tecleado (`00123`, `001323`, `00124`,
`001234`), todos en estado `cerrado` y **ninguno con serial**: se cerraron por el
UPDATE masivo de la migración 023, no por la RPC, que con ellos siempre falló.

**Resuelto (2026-08-12):** confirmado con el usuario que esa columna es del
sistema — en el reporte de papel se escribe el RPT-, no un folio aparte. El campo
del wizard se eliminó: pedía teclear un número que en el paso 1 todavía no
existe, porque el serial se asigna al firmar.

Los 4 folios ya guardados se dejan como están (quedaron para revisar aparte, con
C2). Ya no estorban: la nueva `cerrar_borrador_reporte` de la migración 026 los
sobreescribe con un serial correcto si alguno volviera a pasar por el cierre, en
vez de fallar y quemar un número.

## C2 — CERRADO: los reportes sin número son anteriores al sistema de numeración

La hipótesis inicial —secuela del UPDATE masivo de la migración 023— **era
falsa**. Investigado con datos el 2026-08-12:

| estado | activo | total | con firma técnico | rango |
|---|---|---|---|---|
| anulado | sí | 20 | 4 | 9 mar – 7 may |
| cerrado | sí | 11 | 11 | 9 mar – 16 mar |
| en_progreso | sí | 2 | 0 | 11 may – 7 ago |
| en_progreso | no | 1 | 0 | 29 abr |

De los 33, **30 no tienen nada de anómalo**:

- Los 3 `en_progreso` no han cerrado todavía, y el serial se asigna al cerrar.
- Los 20 `anulado` se anularon antes de cerrarse — 16 ni siquiera llegaron a
  tener firma del técnico. Nunca llegaron a merecer número.

Quedan los **11 cerrados**. Y la explicación es la fecha:

```
primer reporte con serial            2026-03-16
cerrados sin serial anteriores a esa fecha   10 de 11
el 11º es del propio 2026-03-16
```

Son **anteriores al sistema de numeración**. La secuencia se creó en la migración
003, aplicada por esas fechas; lo que se cerró antes no recibió número porque el
mecanismo no existía. No es un fallo: es historia.

**Decisión: se dejan como están.** Darles número hoy solo tiene dos formas y
ninguna mejora nada — asignarles del 38 al 48, cronológicamente absurdo para
reportes de marzo; o renumerarlo todo otra vez para insertarlos al principio,
moviendo los 37 seriales recién estabilizados. Y esos 11 reportes se entregaron
hace cinco meses sin número: no hay copia en papel que apunte a uno.

La interfaz ya lo resuelve bien: cuando no hay serial muestra `#<id abreviado>`
(`ReportesTable.tsx:96`, `MisReportesClient.tsx:181`), que identifica el reporte
sin inventarle un correlativo.

---

# D — DUPLICAR UN REPORTE
### Síntomas reportados: hora heredada del original; insumos sin nombre

## D1 — ALTO: la copia hereda las horas del reporte original

`src/lib/offline/duplicar.ts:75-76`

```
hora_entrada: original.hora_entrada ?? null,
hora_salida:  original.hora_salida  ?? null,
```

Un reporte nuevo se inicializa con la hora actual y la salida vacía
(`page.tsx:936-937`). El duplicado, en cambio, llega con las horas de la visita
anterior — que puede ser de hace semanas.

**Y la RPC hace lo mismo**: `db/migrations/005_duplicar_reporte_rpc.sql:26-27,42-43`
copian `hora_entrada` y `hora_salida`. El propio comentario de `duplicar.ts` avisa de
que las dos implementaciones deben coincidir, así que **hay que corregir las dos** o
el resultado dependerá de si había señal.

**Fix:** `hora_entrada` = hora actual, `hora_salida` = null, en ambas
implementaciones. La hora de salida se rellena al cerrar el reporte (ver D3).

## D2 — ALTO: al duplicar, los insumos pierden el nombre

`src/app/(tecnico)/tecnico/nuevo-reporte/[equipoId]/page.tsx:1048-1062`

```js
insumos_usados: (borrador.insumos_usados || []).map((i) => ({
    uid: crypto.randomUUID(),
    insumo_id: i.insumo_id,
    nombre: '', codigo: null, unidad: '',   // ← nunca se resuelven
    cantidad: i.cantidad,
})),
```

El borrador guarda solo `insumo_id` y cantidad. Al restaurarlo, el nombre se deja en
blanco y `InsumoSelector` pinta lo que recibe: por eso se ve la cantidad y ningún
insumo.

Lo llamativo es que **el bloque de justo debajo (líneas 1067-1076) sí hace el cruce**
para el checklist, contra el catálogo cacheado, y su comentario explica por qué es
necesario. A los insumos no se les aplicó el mismo tratamiento, y el catálogo ya está
cargado en memoria (`insumosIDB`, línea 985): el dato está, solo falta cruzarlo.

## D4 — CRÍTICO: duplicar CON conexión no ha funcionado nunca

Descubierto al reparar D1; no estaba en la primera pasada.

La RPC `duplicar_reporte` inserta en una columna que no existe. Probado contra la
base con un id inexistente —que no crea nada pero sí obliga a Postgres a
planificar la sentencia—:

```
42703: column "fecha_ejecucion" of relation "reportes_mantenimiento" does not exist
```

La columna de la tabla es `fecha_inicio`. `fecha_ejecucion` no existe ni existió;
solo aparece como alias en una vista. Así que `duplicarReporteAction`, que es la
que llama el botón de duplicar cuando hay señal, **falla el 100 % de las veces**.

Pasó desapercibido porque en campo se duplica sin red, y ahí responde la otra
implementación, la de TypeScript, que sí funciona.

Además hay **dos versiones desplegadas** de la función: la de tres argumentos
(rota, la que usa la app) y otra de dos que no está en `db/migrations` y que no
llama nadie — alguien la creó a mano. En el código había también una segunda
`duplicarReporte()` que invocaba esa segunda versión y que tampoco usaba nadie.

Corregido en `db/migrations/025_duplicar_reporte_reparado.sql`: se eliminan las
dos versiones y queda una sola, con `fecha_inicio`, sin heredar horas, y con los
snapshots de marca/modelo/serie tomados del equipo NUEVO — la versión anterior
los heredaba del original, con lo que la copia describía otra máquina.

## D3 — ALTO: la hora de salida se sellaba con la hora de la sincronización

El diagnóstico inicial era que no se rellenaba nunca. Mirándolo de cerca resultó
ser otra cosa, y peor: `firmarComoTecnico` **sí** la escribía —`reportes.ts`,
`hora_salida: ahora.toTimeString()`— pero con el reloj del SERVIDOR y en el
momento de firmar.

Con conexión eso es correcto: firmar y terminar ocurren a la vez. Sin conexión
no. El reporte se sube cuando vuelve la red, a veces al día siguiente, y acababa
con la hora de la sincronización en lugar de la hora en que el técnico terminó.
Encima pisaba la hora que el técnico hubiera escrito a mano.

Corregido: `firmarComoTecnico` acepta `hora_salida` y solo sella la del servidor
si no le llega ninguna. La calcula el dispositivo al firmar, que es quien estaba
allí, y la escrita a mano tiene prioridad sobre las dos.

---

# ORDEN DE ATAQUE

1. **B5 + B4** — pérdida de datos y duplicados. Todo lo demás puede esperar; esto no.
2. **B1 + B2 + B6** — que la cola se vacíe sola, que es lo que se pidió.
3. **A1 + A2** — que el dispositivo no se vacíe a las 12 horas.
4. **D1 + D2 + D3** — duplicación (client + RPC a la vez).
5. **B3, B7, B8, A4, C2** — robustez y detalle.
6. **A3** — navegación RSC offline; es el más invasivo y el de mejor relación con
   dejarlo para el final.

C1 se resuelve solo al arreglar B4 y B5.

---

# DE LA RONDA ANTERIOR (julio)

- **BUG 1 (duplicados al sincronizar)** — la mitad del fix se aplicó: `guardarPaso`
  ya no toca `sync_queue`, y solo `finalizarReporte` encola. La otra mitad, el guard
  de equipo+técnico+fecha, **es ahora el B5** y hace más daño que el problema que
  resolvía.
- **BUG 2 (la firma no redirige)** — resuelto.
- **BUG 3 (búsqueda offline)** — resuelto.
- **BUG 4 (timeout al crear reporte sin conexión)** — resuelto; el wizard es IDB-first.
- **BUG 5 (seleccionar equipo redirige al dashboard)** — resuelto.

---

# D5 — ALTO: la ubicación se perdía en todo el camino offline

Encontrado el 2026-08-12 **probando en el navegador**, no leyendo código. El
wizard bloqueó al duplicar un reporte sin red con "Debe seleccionar la
ubicación", y al tirar del hilo apareció algo peor que la validación.

`ubicacion_id` es obligatoria en el paso 1 (`page.tsx`, `Ubicación *`), pero no
existía en ninguno de los tres puntos del camino sin conexión:

| | |
|---|---|
| `ReporteBorrador` (IndexedDB) | no tenía el campo |
| payload de `finalizarReporte` | no la incluía |
| `SyncReporteSchema` (`/api/sync`) | no la aceptaba |

O sea: el técnico la elegía porque el formulario se lo exigía, pasaba la
validación, y el dato moría ahí. **El mismo reporte hecho con conexión sí la
guardaba.** En la base hay 43 de 74 reportes activos sin ubicación.

**Corregido** en los tres puntos, más `guardarPaso` (si no, un borrador
recuperado tras un cierre accidental volvía con el paso 1 inválido). La
duplicación NO la hereda, igual que la RPC: la copia es para otro equipo, que
puede estar en otra sala.

Verificado en el navegador con build de producción y sesión de técnico: el
borrador offline guarda `ubicacion_id` tras elegirla en el paso 1.

---

# D6 — CRÍTICO: un reporte duplicado sin red NUNCA se sincronizaba

Encontrado el 2026-08-12 ejecutando la prueba 4 del guion. Es, con diferencia,
el hallazgo más importante de toda la ronda.

`reporteId` en el wizard sale del parámetro `?reporteId=` de la URL. En un
reporte duplicado sin conexión ese valor es el id LOCAL — `local_<uuid>`, que
solo existe en IndexedDB. Y el wizard lo pasaba tal cual al payload:

```js
reporte_server_id: reporteId,   // 'local_8396f62b-…'
```

`SyncReporteSchema` lo valida con `z.string().uuid()`, así que `/api/sync`
devolvía **400 Invalid UUID** y rechazaba el reporte entero antes de mirar nada
más. El dispositivo lo marcaba `error_sync` y lo reintentaba. Para siempre.

Es decir: **todo reporte duplicado sin red y firmado se quedaba atrapado en la
cola del dispositivo y no llegaba nunca al servidor.** Y como duplicar es
justamente lo que se hace en campo —el mismo mantenimiento sobre varios equipos
iguales de una sala—, esta es la explicación de fondo del "siempre me queda algo
pendiente de sincronizar".

Corregido en dos capas:

1. **El origen.** `esIdDeServidor()` distingue el UUID del servidor del
   `local_<uuid>` del dispositivo; solo el primero viaja como
   `reporte_server_id`.
2. **La red de seguridad.** El schema de `/api/sync` ya no valida ese campo:
   lo normaliza, y cualquier cosa que no sea un UUID se trata como "no hay id".
   Un endpoint de sincronización no puede rechazar el reporte entero por un
   campo auxiliar mal formado, porque el dispositivo reintenta indefinidamente y
   el trabajo del técnico queda atrapado.

La segunda capa importa además para recuperar lo ya atascado: los reportes que
estén hoy en dispositivos con este fallo suben solos al primer reintento contra
el servidor corregido. Se comprobó en la prueba — los dos reportes atrapados
subieron sin tocar nada.

---

# VERIFICACIÓN EJECUTADA (2026-08-12)

Con build de producción, sesión de técnico real y el service worker activo.

| prueba | resultado |
|---|---|
| Assets precacheados | 25 de 25, ningún hueco |
| Shells cacheados | 7, todos de producción, incluidos los `_shell` canónicos |
| **1** — datos sin red | equipos, catálogos y reportes desde IndexedDB; el desplegable de ubicación filtra por cliente |
| **2** — la cola se vacía sola | 2 pendientes → 0 sin pulsar ningún botón |
| **4** — dos reportes del mismo equipo el mismo día | llegaron **los dos**: RPT-000038 y RPT-000039 |
| **5** — duplicar | hora de entrada = la del dispositivo, salida vacía, insumos con nombre («Aceite lubricante · A-002 · Litro») |
| **6** — hora de salida | 13:01 y 13:05, las del dispositivo al firmar, no la de la sincronización |
| Numeración | 37 → 39, **cero huecos** pese a los intentos fallidos |
| Duplicados | 0 — un solo reporte por `id_local` |

Los dos reportes de prueba quedaron anulados con su motivo.
