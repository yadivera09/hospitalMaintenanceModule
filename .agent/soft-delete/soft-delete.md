# soft-delete.md — Mobilhospital Maintenance Module
> Guía para Claude Code (Antigravity) · Solo aplica al panel `/admin`  
> Stack: Next.js 14 App Router · TypeScript · Supabase JS v2 · Tailwind · shadcn/ui

---

## 1. Filosofía general

Mobilhospital **no elimina registros físicamente** (hard delete) desde el panel admin.  
La "eliminación" es siempre un **soft delete**: se cambia el campo `activo = false`.

La única excepción son registros de tablas de unión sin dependencias propias  
(ej.: `equipo_contratos` si no tiene reportes asociados), y aún así se prefiere desactivar.

### Regla de oro
```
¿El registro tiene filas hijas activas en otras tablas? → SOLO desactivar (bloquear delete).  
¿El registro no tiene hijas activas?                   → Permitir desactivar (y opcionalmente soft-delete).  
Hard delete físico                                     → NUNCA desde el panel admin.
```

---

## 2. Campo `activo` — convención en todos los modelos

Todas las tablas maestras ya tienen o deben tener:

```sql
activo BOOLEAN NOT NULL DEFAULT true
```

### Tablas confirmadas con `activo`
| Tabla | Campo activo | Tiene dependientes |
|---|---|---|
| `clientes` | ✅ | `contratos` |
| `contratos` | ✅ | `equipo_contratos` |
| `equipos` | ✅ | `equipo_contratos`, `reportes` |
| `categorias_equipo` | añadir si falta | `equipos` |
| `tipos_mantenimiento` | añadir si falta | `equipos` |
| `tecnicos` | añadir si falta | `reportes` |
| `insumos` | añadir si falta | `reporte_insumos` |
| `ubicaciones` | añadir si falta | `equipo_contratos` |

### Migración para tablas que aún no tienen `activo`
```sql
-- Ejecutar en Supabase SQL Editor para cada tabla que falte
ALTER TABLE categorias_equipo ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE tipos_mantenimiento ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE tecnicos ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE ubicaciones ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
```

---

## 3. Server Actions — patrón estándar

Todas las acciones de soft delete viven en `src/app/actions/<entidad>.ts`.  
Siguen el mismo contrato que las acciones existentes (ver `clientes.ts`).

### 3.1 Función de verificación de dependencias

Crear en `src/lib/soft-delete.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'

/**
 * Verifica si un registro tiene filas hijas activas.
 * Retorna true si TIENE dependencias (no se puede desactivar limpiamente sin avisar).
 */
export async function tieneDependenciasActivas(
  tabla: string,
  fkColumn: string,
  id: string
): Promise<{ tiene: boolean; count: number }> {
  const supabase = createClient()
  const { count } = await supabase
    .from(tabla)
    .select('*', { count: 'exact', head: true })
    .eq(fkColumn, id)
    .eq('activo', true)    // solo hijas activas importan
  
  return { tiene: (count ?? 0) > 0, count: count ?? 0 }
}
```

### 3.2 Action de soft delete — ejemplo con `clientes`

```typescript
// src/app/actions/clientes.ts  (agregar a las acciones existentes)

export async function desactivarCliente(id: string): Promise<ActionResult> {
  const supabase = createClient()

  // 1. Verificar contratos activos
  const { tiene, count } = await tieneDependenciasActivas('contratos', 'cliente_id', id)

  if (tiene) {
    return {
      data: null,
      error: `No se puede desactivar: el cliente tiene ${count} contrato(s) activo(s). Desactívalos primero.`,
    }
  }

  // 2. Soft delete
  const { error } = await supabase
    .from('clientes')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { data: null, error: error.message }
  return { data: true, error: null }
}
```

### 3.3 Patrón para cada entidad

| Entidad | FK a verificar antes de desactivar |
|---|---|
| `clientes` | `contratos.cliente_id` |
| `contratos` | `equipo_contratos.contrato_id` |
| `equipos` | `equipo_contratos.equipo_id` + `reportes.equipo_id` |
| `tecnicos` | `reportes.tecnico_id` (solo reportes activos/en curso) |
| `categorias_equipo` | `equipos.categoria_id` |
| `tipos_mantenimiento` | `equipos.tipo_mantenimiento_id` |
| `insumos` | `reporte_insumos.insumo_id` |
| `ubicaciones` | `equipo_contratos.ubicacion_id` |

---

## 4. Componente UI — `DeleteButton` reutilizable

Crear en `src/components/admin/shared/DeleteButton.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

interface DeleteButtonProps {
  /** Nombre del registro para el mensaje de confirmación */
  nombreRegistro: string
  /** Action de desactivación — debe retornar { error: string | null } */
  onDesactivar: () => Promise<{ error: string | null }>
  /** Callback después de desactivar exitosamente */
  onExito?: () => void
  /** Texto personalizado para el botón. Default: "Desactivar" */
  label?: string
  disabled?: boolean
}

export default function DeleteButton({
  nombreRegistro,
  onDesactivar,
  onExito,
  label = 'Desactivar',
  disabled = false,
}: DeleteButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    const { error } = await onDesactivar()
    setLoading(false)

    if (error) {
      // Error de dependencias u otro — mostrar toast de error explicativo
      toast.error('No se puede desactivar', { description: error })
      return
    }

    toast.success(`"${nombreRegistro}" fue desactivado correctamente.`)
    onExito?.()
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || loading}
          className="text-red-500 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">{label}</span>
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Desactivar este registro?</AlertDialogTitle>
          <AlertDialogDescription>
            Vas a desactivar <strong>{nombreRegistro}</strong>.  
            El registro no se eliminará — quedará inactivo y podrás reactivarlo después.  
            Si tiene dependencias activas, la operación será bloqueada automáticamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? 'Desactivando…' : 'Sí, desactivar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

---

## 5. Integración en tablas existentes

### Patrón de uso en `ClientesPageClient.tsx` (y equivalentes)

```typescript
// Dentro de la columna de acciones de la tabla
import DeleteButton from '@/components/admin/shared/DeleteButton'
import { desactivarCliente } from '@/app/actions/clientes'

// En la fila de la tabla:
<DeleteButton
  nombreRegistro={cliente.razon_social}
  onDesactivar={() => desactivarCliente(cliente.id)}
  onExito={() => {
    // Refrescar lista — usar el mismo patrón que el form de edición
    setClientes(prev => prev.filter(c => c.id !== cliente.id))
    // O router.refresh() si la lista viene del Server Component
  }}
/>
```

### Dónde colocar el botón en la tabla
El botón de desactivar va como **última columna** de acciones, junto al botón de editar:

```
| Razón social | RUC | Email | Estado | Acciones        |
|--------------|-----|-------|--------|-----------------|
| Clínica S.A  | ... | ...   | Activo | [✏️ Editar] [🗑️] |
```

---

## 6. Queries — filtrar por `activo` en los listados

### Regla: los listados del panel admin siempre filtran por defecto

```typescript
// CORRECTO — mostrar solo activos por defecto
const { data } = await supabase
  .from('clientes')
  .select('*')
  .eq('activo', true)
  .order('razon_social')

// Para ver inactivos — solo con filtro explícito en la UI
const { data } = await supabase
  .from('clientes')
  .select('*')
  .eq('activo', false)
  .order('updated_at', { ascending: false })
```

### Filtro de estado en la UI (opcional pero recomendado)

Añadir al buscador existente un select de estado:

```typescript
// En ClientesPageClient o equivalente
const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'inactivos'>('activos')

// Al construir el query en la action:
export async function getClientes(filtro: 'todos' | 'activos' | 'inactivos' = 'activos') {
  let query = supabase.from('clientes').select('*').order('razon_social')
  if (filtro === 'activos') query = query.eq('activo', true)
  if (filtro === 'inactivos') query = query.eq('activo', false)
  return query
}
```

---

## 7. Reactivar un registro

El mismo `ClienteForm` (y equivalentes) ya tiene el campo `activo` como Select.  
**Reactivar = abrir el modal de edición y cambiar `activo` a `true`.**  
No se necesita un botón separado de "reactivar".

---

## 8. Árbol de archivos a crear/modificar

```
src/
├── lib/
│   └── soft-delete.ts                          ← NUEVO — helper de verificación
│
├── app/
│   └── actions/
│       ├── clientes.ts                         ← MODIFICAR — añadir desactivarCliente()
│       ├── contratos.ts                        ← MODIFICAR — añadir desactivarContrato()
│       ├── equipos.ts                          ← MODIFICAR — añadir desactivarEquipo()
│       ├── tecnicos.ts                         ← MODIFICAR — añadir desactivarTecnico()
│       └── catalogos.ts                        ← MODIFICAR — desactivar cat/tipos/insumos
│
└── components/
    └── admin/
        └── shared/
            └── DeleteButton.tsx                ← NUEVO — botón reutilizable
```

### Archivos de página a modificar (solo añadir el botón en la tabla)
```
src/app/(admin)/admin/
├── clientes/ClientesPageClient.tsx             ← añadir DeleteButton en columna acciones
├── contratos/ContratosPageClient.tsx           ← ídem
├── equipos/EquiposPageClient.tsx               ← ídem
├── tecnicos/TecnicosPageClient.tsx             ← ídem
└── catalogos/CatalogosPageClient.tsx           ← ídem (categorías, tipos, insumos)
```

---

## 9. RLS en Supabase

Asegurarse de que las policies existentes de UPDATE permitan el cambio de `activo`:

```sql
-- Si ya existe una policy de UPDATE para el rol admin, no hay que tocarla.
-- Si no existe, crear una como esta (ejemplo para clientes):
CREATE POLICY "Admin puede actualizar clientes"
  ON clientes FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');
```

El soft delete es un `UPDATE`, no un `DELETE`, así que **no se necesita policy de DELETE**.

---

## 10. Checklist de implementación por sección

Para cada sección del panel admin, seguir este orden:

- [ ] Verificar que la tabla SQL tiene columna `activo BOOLEAN NOT NULL DEFAULT true`
- [ ] Añadir `desactivar<Entidad>()` en `src/app/actions/<entidad>.ts`
- [ ] Importar y usar `DeleteButton` en el `PageClient` correspondiente
- [ ] Probar caso feliz: desactivar sin dependencias → toast verde
- [ ] Probar caso bloqueado: desactivar con hijas activas → toast rojo con mensaje
- [ ] Probar reactivación: editar registro → cambiar `activo` a `true`
- [ ] Verificar que el listado filtra por `activo = true` por defecto