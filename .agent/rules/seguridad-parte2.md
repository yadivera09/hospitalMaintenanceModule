---
trigger: always_on
---

Datos Iniciales (Seed)
sql-- Roles base del sistema (es_sistema = true → no eliminables)
INSERT INTO public.roles (nombre, descripcion, es_sistema) VALUES
    ('administrador', 'Acceso completo al sistema',               true),
    ('tecnico',       'Técnico de mantenimiento estándar',        true),
    ('supervisor',    'Supervisa técnicos y reportes, sin admin', false);
-- Permisos base
INSERT INTO public.permisos (codigo, nombre, descripcion) VALUES
    ('ver',      'Ver',      'Acceso de lectura al módulo'),
    ('crear',    'Crear',    'Crear nuevos registros'),
    ('editar',   'Editar',   'Modificar registros existentes'),
    ('eliminar', 'Eliminar', 'Eliminar registros'),
    ('exportar', 'Exportar', 'Exportar datos a PDF/Excel'),
    ('anular',   'Anular',   'Anular reportes o registros');
-- Menús base
INSERT INTO public.menus (nombre, icono, orden) VALUES
    ('Operaciones',    'bi bi-tools',        1),
    ('Administración', 'bi bi-gear',         2),
    ('Seguridad',      'bi bi-shield-lock',  3);
-- Migrar usuarios existentes: poblar usuario_roles desde tecnicos
INSERT INTO public.usuario_roles (usuario_id, rol_id)
SELECT
    u.id        AS usuario_id,
    r.id        AS rol_id
FROM public.tecnicos t
JOIN public.usuarios u  ON u.user_id = t.user_id
JOIN auth.users au      ON au.id = t.user_id
JOIN public.roles r     ON r.nombre = COALESCE(
    au.raw_user_meta_data->>'rol',
    'tecnico'
)
WHERE t.user_id IS NOT NULL
ON CONFLICT (usuario_id, rol_id) DO NOTHING;
Migración del Middleware
El problema: user_metadata.rol hardcodeado + tecnicos como usuario base
ts// HOY — frágil y acoplado a mantenimiento
const rol = user.user_metadata?.rol as string | undefined
La transición (sin romper producción)
ts// lib/seguridad/permisos.ts
/**
 * Obtiene los roles activos de un usuario del sistema.
 * Busca primero en la nueva tabla usuario_roles.
 * Si no hay resultados, hace fallback a user_metadata.rol (compatibilidad).
 */
export async function getRolesUsuario(userId: string): Promise<string[]> {
    const admin = createAdminClient()

    // Nueva forma: usuarios → usuario_roles → roles
    const { data } = await admin
        .from('usuario_roles')
        .select('roles(nombre), usuarios!inner(user_id)')
        .eq('usuarios.user_id', userId)
        .eq('activo', true)

    if (data && data.length > 0) {
        return data.map(r => (r.roles as any).nombre as string)
    }

    // Fallback: user_metadata.rol (mientras se migra)
    const { data: userData } = await admin.auth.admin.getUserById(userId)
    const rolLegacy = userData?.user?.user_metadata?.rol
    return rolLegacy ? [rolLegacy] : []
}
/**
 * Verifica si un usuario tiene un permiso específico sobre un módulo.
 * Usa caché en cookie firmada con TTL de 5 minutos.
 */
export async function tienePermiso(
    userId: string,
    moduloUrl: string,
    permisoCodigo: string
): Promise<boolean> {
    // 1. Intentar leer del caché (cookie firmada)
    // 2. Si no hay caché: query a la DB
    // 3. Guardar en caché con TTL 5 min
    // 4. Retornar resultado
    //
    // La query hace OR entre todos los roles del usuario:
    // Si tiene rol 'tecnico' (sin exportar) Y rol 'supervisor' (con exportar)
    // → puede exportar
}
RLS Policies
sqlALTER TABLE public.usuarios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modulos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rol_permisos_modulo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_roles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria   ENABLE ROW LEVEL SECURITY;
-- Lectura pública para usuarios autenticados (middleware necesita leer roles)
CREATE POLICY "roles_select_authenticated"    ON public.roles
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "modulos_select_authenticated"  ON public.modulos
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "menus_select_authenticated"    ON public.menus
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "permisos_select_authenticated" ON public.permisos
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "rol_permisos_select_authenticated" ON public.rol_permisos_modulo
    FOR SELECT USING (auth.role() = 'authenticated');
--Un usuario solo ve sus propios roles
CREATE POLICY "usuario_roles_select_propio" ON public.usuario_roles
    FOR SELECT USING (
        usuario_id IN (
            SELECT id FROM public.usuarios WHERE user_id = auth.uid()
        )
    );
--Un usuario solo ve sus propios registros de auditoría
CREATE POLICY "auditoria_select_propia" ON public.auditoria
    FOR SELECT USING (
        usuario_id IN (
            SELECT id FROM public.usuarios WHERE user_id = auth.uid()
        )
    );
--Un usuario ve su propio perfil
CREATE POLICY "usuarios_select_propio" ON public.usuarios
    FOR SELECT USING (user_id = auth.uid());
--Escritura solo via service role (createAdminClient en server actions)
--No se crean policies de INSERT/UPDATE/DELETE → solo admin client puede escribir
Helpers de la lógica de seguridad
lib/seguridad/auditoria.ts — patrón withAudit()
tstype AccionAuditoria = 'ADICION' | 'MODIFICACION' | 'ELIMINACION'
interface AuditConfig {
    tabla: string
    accion: AccionAuditoria
    obtenerRegistroId: (resultado: any) => string
    obtenerDetalle?: (resultado: any, args: any) => Record<string, any>
}
/**
 * Envuelve una server action para que registre auditoría automáticamente.
 * Si la action lanza error, NO se registra auditoría.
 * Si la auditoría falla, NO rompe la action (solo loggea).
 * Uso:
 *   export const crearReporte = withAudit(
 *       { tabla: 'reportes_mantenimiento', accion: 'ADICION', ... },
 *       async (datos) => { ... lógica ... }
 *   )
 */
export function withAudit<TArgs extends any[], TResult>(
    config: AuditConfig,
    action: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
    return async (...args: TArgs) => {
        const resultado = await action(...args)
        try {
            await registrarAuditoria({
                tabla: config.tabla,
                registro_id: config.obtenerRegistroId(resultado),
                accion: config.accion,
                detalle: config.obtenerDetalle?.(resultado, args),
            })
        } catch (e) {
            console.error('[Auditoría] Error al registrar:', e)
            // NO relanzamos: la auditoría no debe romper la operación principal
        }
        return resultado
    }
}
Estructura de Archivos a Crear
sra/
├── app/
│   ├── actions/
│   │   └── seguridad/
│   │       ├── roles.ts--CRUD roles
│   │       ├── modulos.ts--CRUD módulos y menús
│   │       ├── permisos.ts--Asignación de permisos a roles
│   │       ├── usuarios.ts--CRUD usuarios del sistema
│   │       ├── grupos.ts--CRUD grupos
│   │       └── auditoria.ts--Queries de auditoría
│   └── admin/
│       └── seguridad/
│           ├── page.tsx--Dashboard seguridad
│           ├── roles/
│           │   ├── page.tsx--Lista de roles
│           │   └── [id]/page.tsx-- Editar rol + matriz de permisos
│           ├── usuarios/
│           │   ├── page.tsx--Lista usuarios (todos los módulos)
│           │   └── [id]/page.tsx--Editar usuario + roles + estado MFA
│           ├── grupos/
│           │   ├── page.tsx
│           │   └── [id]/page.tsx
│           └── auditoria/
│               └── page.tsx--Tabla con filtros
├── lib/
│   └── seguridad/
│       ├── permisos.ts--getRolesUsuario(), tienePermiso(), permisosUsuario()
│       └── auditoria.ts--withAudit(), registrarAuditoria()
db/
└── migrations/
    ├── 009_usuarios_base.sql--Tabla usuarios + migrar tecnicos.user_id → usuario_id
    ├── 010_seguridad_core.sql--menus, modulos, roles, permisos, rol_permisos_modulo, usuario_roles
    ├── 011_seguridad_grupos.sql--grupos, grupo_miembros
    ├── 012_seguridad_auditoria.sql-- tabla auditoria + tipo enum
    ├── 013_seguridad_rls.sql--RLS policies
    └── 014_seguridad_seed.sql--datos iniciales + migración usuario_roles
Orden de Ejecución
FASE 0—Tabla usuarios (fundamento del sistema)
 Crear migración 009_usuarios_base.sql
 Crear tabla usuarios genérica
 Poblar usuarios desde tecnicos existentes
 Agregar columna usuarios.id → tecnicos.usuario_id
 Verificar en producción que todos los técnicos tienen su fila en usuarios
FASE 1—Schema de seguridad (sin tocar UI)
 Crear migración 010_seguridad_core.sql
 Crear migración 011_seguridad_grupos.sql
 Crear migración 012_seguridad_auditoria.sql
 Crear migración 013_seguridad_rls.sql
 Crear migración 014_seguridad_seed.sql (roles + migración a usuario_roles)
 Ejecutar migraciones en producción
 Verificar que todos los usuarios tienen su fila en usuario_roles
FASE 2—Helpers + Middleware (transición sin romper)
 Crear lib/seguridad/permisos.ts con getRolesUsuario() y tienePermiso()
 Crear lib/seguridad/auditoria.ts con withAudit() y registrarAuditoria()
 Actualizar middleware.ts para usar getRolesUsuario() (con fallback a user_metadata.rol)
 Implementar caché en cookie firmada (TTL 5 min)
 Deploy y verificar que login sigue funcionando
FASE 3—Server Actions de seguridad
 app/actions/seguridad/roles.ts
 app/actions/seguridad/modulos.ts
 app/actions/seguridad/usuarios.ts
 app/actions/seguridad/grupos.ts
 app/actions/seguridad/auditoria.ts
 Aplicar withAudit() a todas las actions de escritura existentes (reportes, equipos, etc.)
FASE 4—UI del módulo de seguridad
 /admin/seguridad — dashboard con métricas
 /admin/seguridad/roles — lista + CRUD (validar es_sistema en frontend Y en server action)
 /admin/seguridad/roles/[id] — editar permisos por módulo (matriz interactiva)
 /admin/seguridad/usuarios — lista de todos los usuarios del sistema + sus roles
 /admin/seguridad/usuarios/[id] — editar roles + ver estado MFA
 /admin/seguridad/grupos — CRUD grupos y miembros
 /admin/seguridad/auditoria — tabla con filtros por usuario/fecha/acción/tabla
FASE 5—Limpiar deuda técnica
 Quitar fallback a user_metadata.rol del middleware
 Hacer tecnicos.usuario_id NOT NULL (ya verificado que todos tienen valor)
 Eliminar tecnicos.user_id (ya no es necesario — se accede via tecnicos.usuario_id → usuarios.user_id)
 Actualizar script de creación de usuarios para usar la nueva arquitectura
 Documentar el nuevo flujo en CLAUDE.md del proyecto
Consideraciones importantes
Sobre la tabla usuarios como base transversal: Cuando llegue el módulo de Ventas, se crea la tabla vendedores con usuario_id apuntando a usuarios.id. Los permisos se asignan al usuario, no al perfil. El middleware nunca pregunta "¿eres técnico?" — pregunta "¿qué roles tienes?".Sobre es_sistema (defensa en profundidad): Validar en el frontend Y en el server action de DELETE. Nunca confiar solo en el cliente.
Sobre múltiples roles y permisos OR: Si un usuario tiene rol tecnico (sin exportar) y rol supervisor (con exportar), puede exportar. El cálculo de permisos hace OR entre todos los roles activos del usuario.Sobre caché de permisos: Cookie firmada con TTL de 5 minutos. Si un admin cambia permisos, el usuario los verá actualizados en máximo 5 min sin re-login.Sobre auditoría: No usar triggers de PostgreSQL — difíciles de debuggear en Supabase. El patrón withAudit() envuelve cada server action de escritura. Si la action falla, no se audita. Si la auditoría falla, no rompe la action.Sobre MFA: tecnicos.mfa_configurado, mfa_metodo, mfa_sesion_verificada no se tocan. Se muestran en la pantalla /admin/seguridad/usuarios/[id] para visibilidad del admin.Sobre tecnicos.user_id: Se elimina en Fase 5, no antes. Primero verificar que tecnicos.usuario_id tiene valor para todos los registros. Eliminar una columna que tiene datos sin verificar es riesgo innecesario.