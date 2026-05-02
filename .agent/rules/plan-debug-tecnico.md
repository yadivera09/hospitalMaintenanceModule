---
trigger: always_on
---

# 🔍 Plan de Acción: Debug Producción — Identidad Técnico & Técnicos de Apoyo

> **Contexto:** El flujo `sra/app/tecnico/nuevo-reporte/[equipoId]/page.tsx` funciona en local pero falla en producción con:
> 1. Los técnicos de apoyo **no aparecen** en el selector
> 2. Al dar "Siguiente" aparece: _"Identidad del técnico no detectada, no se puede continuar"_
>
> Stack: Next.js 14 · Supabase · MFA (TOTP + Email OTP) · RLS · Vercel

---

## 🧠 Hipótesis principales (local vs producción)

| # | Hipótesis | Por qué aplica aquí |
|---|-----------|---------------------|
| H1 | El cliente Supabase en producción **no tiene sesión AAL2** cuando carga la página | MFA activado + cookies de sesión distintas entre entornos |
| H2 | Las **RLS policies** requieren `aal = 'aal2'` y en producción el JWT no lo lleva en ese momento | Migraciones con RLS estricto |
| H3 | El **middleware** bloquea o redirige antes de que se eleve el nivel AAL | Race condition ya vista antes en este proyecto |
| H4 | El `server client` de Supabase (`lib/supabase/server.ts`) **no lee las cookies correctamente** en Vercel (falta `await cookies()` en Next.js 14) | Diferencia de comportamiento entre dev y edge runtime |
| H5 | La acción `actions/tecnicos` hace una query que **depende del `user.id`** y en producción llega `null` o `undefined` | Sesión no hidratada cuando se dispara el fetch |

---

## FASE 1 — Técnicos de apoyo no aparecen

### 1.1 Localizar la query

Ir a `sra/app/actions/tecnicos.ts` (o similar) y encontrar la función que carga la lista de técnicos de apoyo.

**Verificar:**
- [ ] ¿Usa `supabaseServer()` o `supabaseClient()`?
- [ ] ¿Hace `.select()` sobre una tabla que tiene **RLS activado**?
- [ ] ¿El filtro depende del `user.id` o del perfil del técnico logueado?

```ts
// Buscar algo como esto:
const { data, error } = await supabase
  .from('tecnicos')          // o 'usuarios', 'perfiles', etc.
  .select('*')
  .eq('activo', true)
  .neq('id', currentUserId)  // excluye al propio técnico
```

### 1.2 Añadir logs temporales en producción

En la Server Action o en el `page.tsx`, añadir **antes** de la query:

```ts
const supabase = createServerClient()
const { data: { session }, error: sessionError } = await supabase.auth.getSession()

console.log('[DEBUG-APOYO] session:', session?.user?.id)
console.log('[DEBUG-APOYO] aal:', session?.user?.aal)  // debe ser 'aal2'
console.log('[DEBUG-APOYO] sessionError:', sessionError)
```

Revisar los logs en **Vercel → Functions → Log stream** mientras se reproduce el error.

### 1.3 Revisar la RLS de la tabla de técnicos

En `db/migrations/` buscar la policy que aplica a la tabla usada para cargar técnicos.

**Patrón peligroso que falla en producción:**
```sql
-- ❌ Esto falla si el JWT aún no tiene aal2 en el momento del fetch
CREATE POLICY "tecnicos_select" ON tecnicos
  FOR SELECT USING (
    auth.jwt() ->> 'aal' = 'aal2'
  );
```

**Verificar en Supabase Dashboard → Authentication → Policies** si la policy tiene restricción de AAL.

### 1.4 Revisar `lib/supabase/server.ts`

```ts
// ⚠️ En Next.js 14 con App Router esto DEBE ser así:
import { cookies } from 'next/headers'

export function createServerClient() {
  const cookieStore = cookies()  // ← en Next.js 14 es síncrono aquí
  // pero en algunos contextos necesita await — verificar la versión exacta
  return createServerComponentClient({ cookies: () => cookieStore })
}
```

**Acción:** Comparar el `lib/supabase/server.ts` que se usa en `page.tsx` vs el que se usa en `middleware.ts`. Si son instancias distintas pueden tener cookies distintas.

---

## FASE 2 — "Identidad del técnico no detectada"

### 2.1 Localizar el mensaje exacto

```bash
# En el IDE, buscar el string exacto:
grep -r "Identidad del técnico no detectada" sra/
```

Esto va a apuntar al archivo exacto donde se hace la validación. Normalmente está en:
- `page.tsx` (en un `useEffect` o en la carga de datos)
- Una Server Action en `actions/reportes.ts` o `actions/tecnicos.ts`
- El handler del botón "Siguiente"

### 2.2 Entender qué condición dispara el mensaje

El mensaje implica que hay un check de identidad. Buscar algo como:

```ts
// Patrón típico:
const { data: { user } } = await supabase.auth.getUser()

if (!user || !user.id) {
  return { error: 'Identidad del técnico no detectada, no se puede continuar.' }
}

// O con perfil:
const perfil = await getTecnicoPerfil(user.id)
if (!perfil) {
  return { error: 'Identidad del técnico no detectada...' }
}
```

### 2.3 Revisar `getUser()` vs `getSession()`

**Este es el error más común en producción con Supabase + Next.js:**

```ts
// ❌ getSession() puede devolver sesión cacheada/expirada en el servidor
const { data: { session } } = await supabase.auth.getSession()
const user = session?.user  // PUEDE SER NULL EN PRODUCCIÓN

// ✅ getUser() hace validación contra Supabase Auth server (más confiable)
const { data: { user }, error } = await supabase.auth.getUser()
```

**Acción:** En el lugar donde se dispara la validación de identidad, cambiar `getSession()` por `getUser()` si aplica.

### 2.4 Revisar el middleware

En `middleware.ts`, verificar si hay una redirección o modificación de headers que afecte la sesión:

```ts
// Buscar si el middleware está refrescando el token correctamente:
const { data: { session } } = await supabase.auth.getSession()

// ⚠️ El middleware DEBE hacer el refresh y pasar las cookies actualizadas:
return NextResponse.next({
  request: {
    headers: requestHeaders,  // ← ¿está pasando las cookies de respuesta?
  },
})
```

**Verificar que el middleware pasa `response.cookies` al request siguiente.** Este es el race condition clásico que ya se resolvió antes en este proyecto — confirmar que la solución sigue aplicada.

### 2.5 Verificar variables de entorno en Vercel

```bash
# Las que DEBEN existir en Vercel (Settings → Environment Variables):
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY    # ← crítica para lib/supabase/admin.ts
```

Si `SUPABASE_SERVICE_ROLE_KEY` no está en producción, cualquier operación con `supabaseAdmin` va a fallar silenciosamente y el usuario va a aparecer como "no detectado".

---

## FASE 3 — Orden de ejecución del debug

```
1. [ ] Verificar variables de entorno en Vercel
       → Settings → Environment Variables → confirmar las 3 vars

2. [ ] Añadir logs en la carga de técnicos de apoyo
       → Reproducir en producción → revisar Vercel Log Stream

3. [ ] Buscar el string "Identidad del técnico no detectada" en el codebase
       → Identificar el archivo y la condición exacta

4. [ ] En ese archivo: cambiar getSession() por getUser() si aplica
       → Deploy → probar

5. [ ] Revisar RLS de la tabla de técnicos en Supabase Dashboard
       → Confirmar si tiene restricción de AAL2

6. [ ] Revisar middleware: confirmar que pasa cookies de respuesta correctamente

7. [ ] Si sigue fallando: añadir log del JWT completo en el servidor
       → console.log(session?.user?.app_metadata)
       → Confirmar que aal = 'aal2' llega al momento del check
```

---

## 📋 Archivos a revisar (checklist)

| Archivo | Qué revisar |
|---------|-------------|
| `middleware.ts` | ¿Pasa `response.cookies` al siguiente request? ¿Redirige antes de AAL2? |
| `lib/supabase/server.ts` | ¿Usa `cookies()` correctamente para Next.js 14? |
| `lib/supabase/admin.ts` | ¿`SUPABASE_SERVICE_ROLE_KEY` está disponible en producción? |
| `sra/app/actions/tecnicos.ts` | ¿La query de técnicos de apoyo devuelve datos? ¿Usa `getUser()` o `getSession()`? |
| `sra/app/actions/reportes.ts` | ¿La acción de "Siguiente" verifica identidad? ¿Con qué método? |
| `sra/app/tecnico/nuevo-reporte/[equipoId]/page.tsx` | ¿Cómo se carga el técnico actual? ¿Cuándo se llama la validación? |
| `db/migrations/*.sql` | ¿Las RLS de `tecnicos` y tablas relacionadas tienen restricción de AAL2? |

---

## 🚨 Sospechoso #1 (apostar por este primero)

Dado el historial del proyecto (race condition MFA ya resuelta), lo más probable es:

> **En producción, cuando `page.tsx` carga, el cliente Supabase del servidor hace `getSession()` y obtiene una sesión válida, PERO sin `aal2` todavía (porque el middleware no terminó de elevar el nivel o no pasó las cookies actualizadas). La RLS bloquea la query de técnicos silenciosamente (devuelve array vacío sin error), y la validación de identidad falla porque `user` viene de esa sesión incompleta.**

**Primera acción concreta:**
1. En `page.tsx` y en la acción de "Siguiente", cambiar toda instancia de `supabase.auth.getSession()` por `supabase.auth.getUser()`
2. Deploy
3. Probar en producción

---

*Generado para Mobilhospital · Sistema de Mantenimiento*