---
trigger: always_on
---

# 🔐 Plan de Acción: Módulo de Seguridad — Mobilhospital

> **Objetivo:** Implementar un sistema completo de roles, permisos por módulo, grupos y auditoría dentro del mismo repo Next.js/Supabase. Diseñado como **base transversal de todo el sistema** — no solo para mantenimiento, sino para todos los módulos futuros (Ventas, Contabilidad, RRHH, etc.).
>
> **Stack:** Next.js 14 · TypeScript · Supabase (Auth + PostgreSQL) · RLS · Tailwind CSS
>
> **Enfoque:** Sin prisa, bien hecho. Cada fase es independiente y deployable por separado.
>
> **Decisión arquitectónica — integrado en el mismo repo (NO microservicio):** Ya existe Supabase Auth con relaciones establecidas, equipo pequeño, mismo stack y misma DB. Un microservicio solo agregaría latencia, CORS, doble deploy y sincronización de schemas sin beneficio real.

---

## 🏛️ Principio Arquitectónico Central

El módulo de seguridad es la **base transversal** del sistema. Mantenimiento es el primer módulo, pero vendrán Ventas, Contabilidad, RRHH, etc. La misma persona puede tener roles en múltiples módulos — un contador puede tener acceso de lectura al dashboard de mantenimiento aunque su perfil de negocio sea contabilidad.

```
auth.users  (Supabase — autenticación)
     ↓
 usuarios   (tabla genérica — el "humano" del sistema — roles y permisos van aquí)
     ↓               ↓               ↓               ↓
 tecnicos        vendedores      contadores       otros...
 (perfil)        (perfil)        (perfil)         (perfiles futuros)
```

**Regla clave:**
- **Roles y permisos** → se asignan al `usuario` (genérico)
- **Operaciones de negocio** → siguen apuntando al perfil específico (`tecnicos.id`, etc.)
- Un contador puede tener rol `ver_dashboard_mantenimiento` sin ser técnico
- Un técnico nunca necesita saber que existe el módulo de contabilidad si no tiene ese rol

---

## 🗺️ Mapeo Django → Mobilhospital

| Modelo Django | Tabla PostgreSQL | Notas |
|---------------|-----------------|-------|
| `Menu` | `menus` | Grupos de navegación (Operaciones, Administración, Seguridad...) |
| `Module` | `modulos` | Pantallas específicas con URL y menú padre |
| `Group` | `roles` | Reemplaza `user_metadata.rol` hardcodeado |
| `Permission` | `permisos` | Acciones: `ver`, `crear`, `editar`, `eliminar`, `exportar`, `anular` |
| `GroupModulePermission` | `rol_permisos_modulo` | Tabla unificada con clave compuesta |
| `User.groups` | `usuario_roles` | Un usuario puede tener múltiples roles |
| `AuditUser` | `auditoria` | Apunta a `usuarios.id`, no a `tecnicos.id` |
| _(nuevo)_ | `usuarios` | **Tabla genérica nueva** — base de todo el sistema |
| _(nuevo)_ | `grupos` | Equipos de trabajo con responsable |
| _(nuevo)_ | `grupo_miembros` | Usuarios dentro de un grupo |

**Lo que NO se migra de Django:**
- `AbstractUser` / `PermissionsMixin` → Supabase Auth lo maneja
- `ThreadLocal` / `current_request` → era para el chatbot de la tesis, no aplica
- `django.contrib.auth.Permission` → se reemplaza con permisos propios

---

## 📐 Schema Completo

### Fase 0 — Tabla `usuarios` (nuevo fundamento)

> Esta es la pieza nueva más importante. Antes de crear nada de seguridad, se establece la tabla genérica de usuarios del sistema.

```sql
-- ─────────────────────────────────────────────
-- 0. USUARIOS
-- El "humano" del sistema. Agnóstico al módulo de negocio.
-- Supabase Auth maneja la autenticación; esta tabla maneja
-- el perfil del sistema (nombre, estado, metadata).
-- ─────────────────────────────────────────────
CREATE TABLE public.usuarios (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre      text NOT NULL,
    apellido    text NOT NULL,
    email       text NOT NULL UNIQUE,
    telefono    text,
    imagen_url  text,
    activo      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_usuarios_user_id ON public.usuarios(user_id);
CREATE INDEX idx_usuarios_email ON public.usuarios(email);

-- Trigger para mantener updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER usuarios_updated_at
    BEFORE UPDATE ON public.usuarios
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### Migración de `tecnicos` para apuntar a `usuarios`

> `tecnicos` pasa de apuntar directamente a `auth.users` a apuntar a `usuarios`. Las operaciones de mantenimiento no cambian — siguen usando `tecnicos.id`.

```sql
-- Agregar columna usuario_id a tecnicos
ALTER TABLE public.tecnicos
    ADD COLUMN usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- Poblar usuarios desde tecnicos existentes
INSERT INTO public.usuarios (user_id, nombre, apellido, email, telefono, activo)
SELECT
    t.user_id,
    t.nombre,
    t.apellido,
    t.email,
    t.telefono,
    t.activo
FROM public.tecnicos t
WHERE t.user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Actualizar tecnico.usuario_id con los registros recién creados
UPDATE public.tecnicos t
SET usuario_id = u.id
FROM public.usuarios u
WHERE u.user_id = t.user_id
  AND t.usuario_id IS NULL;

-- Una vez verificado en producción, hacer usuario_id NOT NULL y quitar user_id
-- (hacerlo en una migración posterior, no en la misma)
-- ALTER TABLE public.tecnicos ALTER COLUMN usuario_id SET NOT NULL;
-- ALTER TABLE public.tecnicos DROP COLUMN user_id;  -- fase 5
```

---

### Fase 1 — Core: Menús, Módulos, Roles, Permisos

```sql
-- ─────────────────────────────────────────────
-- 1. MENUS
-- Grupos de navegación del sistema
-- Ejemplos: "Operaciones", "Administración", "Seguridad"
-- ─────────────────────────────────────────────
CREATE TABLE public.menus (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      text NOT NULL UNIQUE,
    icono       text NOT NULL DEFAULT 'bi bi-grid',
    orden       smallint NOT NULL DEFAULT 0,
    activo      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 2. MODULOS
-- Pantallas específicas agrupadas por menú
-- Ejemplos: "Nuevo Reporte", "Dashboard Mantenimiento", "Lista Equipos"
-- ─────────────────────────────────────────────
CREATE TABLE public.modulos (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id     uuid NOT NULL REFERENCES public.menus(id) ON DELETE RESTRICT,
    nombre      text NOT NULL,
    url         text NOT NULL UNIQUE,  -- ej: '/admin/reportes', '/admin/equipos'
    descripcion text,
    icono       text NOT NULL DEFAULT 'bi bi-x-octagon',
    orden       smallint NOT NULL DEFAULT 0,
    activo      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 3. ROLES
-- Reemplaza user_metadata.rol hardcodeado
-- Ejemplos: "administrador", "tecnico", "supervisor", "contador_readonly"
-- ─────────────────────────────────────────────
CREATE TABLE public.roles (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      text NOT NULL UNIQUE,
    descripcion text,
    es_sistema  boolean NOT NULL DEFAULT false,  -- true = no se puede eliminar
    activo      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 4. PERMISOS
-- Acciones posibles sobre cualquier módulo
-- ─────────────────────────────────────────────
CREATE TABLE public.permisos (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo      text NOT NULL UNIQUE,  -- ej: 'ver', 'crear', 'editar'
    nombre      text NOT NULL,
    descripcion text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 5. ROL_PERMISOS_MODULO  (TABLA UNIFICADA)
-- Qué permisos tiene cada rol sobre cada módulo
-- Tabla única con clave compuesta — sin tablas intermedias
-- ─────────────────────────────────────────────
CREATE TABLE public.rol_permisos_modulo (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rol_id      uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    modulo_id   uuid NOT NULL REFERENCES public.modulos(id) ON DELETE CASCADE,
    permiso_id  uuid NOT NULL REFERENCES public.permisos(id) ON DELETE CASCADE,
    activo      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(rol_id, modulo_id, permiso_id)
);

CREATE INDEX idx_rol_permisos_rol     ON public.rol_permisos_modulo(rol_id)    WHERE activo = true;
CREATE INDEX idx_rol_permisos_modulo  ON public.rol_permisos_modulo(modulo_id) WHERE activo = true;

-- ─────────────────────────────────────────────
-- 6. USUARIO_ROLES  (apunta a usuarios, no a tecnicos)
-- Un usuario puede tener múltiples roles
-- Un contador puede tener rol 'ver_mantenimiento' sin ser técnico
-- ─────────────────────────────────────────────
CREATE TABLE public.usuario_roles (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    rol_id      uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    activo      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(usuario_id, rol_id)
);

CREATE INDEX idx_usuario_roles_usuario ON public.usuario_roles(usuario_id) WHERE activo = true;
```

### Fase 2 — Grupos y Jerarquías

```sql
-- ─────────────────────────────────────────────
-- 7. GRUPOS
-- Equipos de trabajo — agnósticos al módulo de negocio
-- Ejemplo: "Equipo Guayaquil", "Equipo Quito"
-- El responsable es un usuario (no necesariamente un técnico)
-- ─────────────────────────────────────────────
CREATE TABLE public.grupos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          text NOT NULL UNIQUE,
    descripcion     text,
    responsable_id  uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    activo          boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 8. GRUPO_MIEMBROS
-- Usuarios que pertenecen a un grupo
-- ─────────────────────────────────────────────
CREATE TABLE public.grupo_miembros (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id    uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
    usuario_id  uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(grupo_id, usuario_id)
);
```
### Fase 3 — Auditoría
```sql
-- 9. AUDITORIA
-- Apunta a usuarios.id (genérico), no a tecnicos.id
-- NO usa triggers de Postgres — se registra desde server actions con withAudit()
-- ─────────────────────────────────────────────
CREATE TYPE public.accion_auditoria AS ENUM ('ADICION', 'MODIFICACION', 'ELIMINACION');

CREATE TABLE public.auditoria (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    tabla       text NOT NULL,
    registro_id uuid NOT NULL,
    accion      public.accion_auditoria NOT NULL,
    detalle     jsonb,          -- snapshot del cambio (antes/después)
    ip          text,
    user_agent  text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_auditoria_usuario  ON public.auditoria(usuario_id);
CREATE INDEX idx_auditoria_tabla    ON public.auditoria(tabla);
CREATE INDEX idx_auditoria_created  ON public.auditoria(created_at DESC);
CREATE INDEX idx_auditoria_registro ON public.auditoria(tabla, registro