-- =============================================================================
-- Migration: 018_modulos_y_permisos
-- Description: Fase 4. Pone en funcionamiento la matriz de permisos.
--
--   POR QUE
--   La migracion 013 sembro roles, permisos y menus, pero NUNCA sembro
--   'modulos'. Con esa tabla vacia, tienePermiso() y permisosUsuario()
--   devolvian siempre false y {}: el RBAC fino existia en el esquema pero no
--   gobernaba nada. El control real era el nombre del rol en el middleware.
--
--   Tampoco existe pantalla para dar de alta modulos, asi que el catalogo se
--   siembra aqui a partir de las rutas reales del App Router.
--
--   REGLA DE ORO
--   El rol 'administrador' no se filtra por esta matriz: el codigo le concede
--   todo por definicion. Se le siembran igualmente los permisos para que la
--   pantalla de roles muestre su alcance real, pero un fallo del seed no puede
--   dejar a un administrador fuera del sistema.
--
-- Prerrequisitos: 009 (tablas), 013 (roles, permisos, menus)
-- Tablas que modifica (INSERT): modulos, rol_permisos_modulo
-- =============================================================================


-- ---------------------------------------------------------------------------
-- PASO 1 - CATALOGO DE MODULOS
--
-- La columna url debe coincidir EXACTAMENTE con la ruta del App Router: es la
-- clave con la que el middleware y el sidebar resuelven los permisos.
-- Las subrutas (/admin/reportes/123) heredan del prefijo mas largo que coincida.
-- ---------------------------------------------------------------------------

INSERT INTO public.modulos (menu_id, nombre, url, descripcion, icono, orden)
SELECT m.id, v.nombre, v.url, v.descripcion, v.icono, v.orden
FROM (VALUES
    -- Operaciones (panel del tecnico)
    ('Operaciones',    'Mi panel',      '/tecnico/dashboard',       'Panel de trabajo del tecnico',        'LayoutDashboard', 1),
    ('Operaciones',    'Mis reportes',  '/tecnico/mis-reportes',    'Reportes asignados al tecnico',       'ClipboardList',   2),
    ('Operaciones',    'Nuevo reporte', '/tecnico/nuevo-reporte',   'Registro de un mantenimiento',        'FilePlus',        3),

    -- Administracion (operacion del negocio)
    ('Administracion', 'Dashboard',     '/admin/dashboard',         'Indicadores generales',               'LayoutDashboard', 1),
    ('Administracion', 'Clientes',      '/admin/clientes',          'Empresas e instituciones',            'Building2',       2),
    ('Administracion', 'Contratos',     '/admin/contratos',         'Contratos de mantenimiento',          'FileText',        3),
    ('Administracion', 'Equipos',       '/admin/equipos',           'Inventario de equipos medicos',       'Stethoscope',     4),
    ('Administracion', 'Tecnicos',      '/admin/tecnicos',          'Personal tecnico',                    'HardHat',         5),
    ('Administracion', 'Catalogos',     '/admin/catalogos',         'Tipos, categorias e insumos',         'BookOpen',        6),
    ('Administracion', 'Reportes',      '/admin/reportes',          'Reportes de mantenimiento',           'ClipboardList',   7),
    ('Administracion', 'Analisis',      '/admin/reportes/analisis', 'Analisis y estadisticas',             'BarChart2',       8),

    -- Seguridad
    ('Seguridad',      'Roles',         '/admin/seguridad/roles',     'Roles y matriz de permisos',        'KeyRound',        1),
    ('Seguridad',      'Usuarios',      '/admin/seguridad/usuarios',  'Usuarios y asignacion de roles',    'Users',           2),
    ('Seguridad',      'Grupos',        '/admin/seguridad/grupos',    'Equipos de trabajo',                'UsersRound',      3),
    ('Seguridad',      'Auditoria',     '/admin/seguridad/auditoria', 'Registro de operaciones',           'ScrollText',      4)
) AS v(menu, nombre, url, descripcion, icono, orden)
JOIN public.menus m
  -- El seed de 013 creo el menu como 'Administración' (con tilde). Se compara
  -- sin acentos para no depender de como quedo escrito.
  ON translate(lower(m.nombre), 'áéíóú', 'aeiou') = translate(lower(v.menu), 'áéíóú', 'aeiou')
ON CONFLICT (url) DO NOTHING;


-- ---------------------------------------------------------------------------
-- PASO 2 - PERMISOS DEL ROL ADMINISTRADOR
--
-- Todo sobre todo. Redundante con el atajo del codigo, pero deja la pantalla
-- de roles mostrando el alcance real en vez de una matriz vacia.
-- ---------------------------------------------------------------------------

INSERT INTO public.rol_permisos_modulo (rol_id, modulo_id, permiso_id, activo)
SELECT r.id, mo.id, p.id, true
FROM public.roles r
CROSS JOIN public.modulos mo
CROSS JOIN public.permisos p
WHERE r.nombre = 'administrador'
ON CONFLICT (rol_id, modulo_id, permiso_id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- PASO 3 - PERMISOS DEL ROL TECNICO
--
-- Solo su propio panel. Ver, crear y editar reportes; sin eliminar ni anular,
-- que son operaciones de administracion.
-- ---------------------------------------------------------------------------

INSERT INTO public.rol_permisos_modulo (rol_id, modulo_id, permiso_id, activo)
SELECT r.id, mo.id, p.id, true
FROM public.roles r
CROSS JOIN public.modulos mo
CROSS JOIN public.permisos p
WHERE r.nombre = 'tecnico'
  AND mo.url LIKE '/tecnico/%'
  AND p.codigo IN ('ver', 'crear', 'editar')
ON CONFLICT (rol_id, modulo_id, permiso_id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- PASO 4 - PERMISOS DEL ROL SUPERVISOR
--
-- Lectura y exportacion de la operacion, sin tocar Seguridad. Es el ejemplo
-- de para que sirve la matriz: un rol que ve el panel de administracion pero
-- no puede modificar nada.
-- ---------------------------------------------------------------------------

INSERT INTO public.rol_permisos_modulo (rol_id, modulo_id, permiso_id, activo)
SELECT r.id, mo.id, p.id, true
FROM public.roles r
CROSS JOIN public.modulos mo
CROSS JOIN public.permisos p
WHERE r.nombre = 'supervisor'
  AND mo.url LIKE '/admin/%'
  AND mo.url NOT LIKE '/admin/seguridad/%'
  AND p.codigo IN ('ver', 'exportar')
ON CONFLICT (rol_id, modulo_id, permiso_id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- PASO 5 - REPORTE FINAL
--
-- Resumen de lo sembrado. 'modulos_sin_menu' debe ser 0: si algun modulo no
-- encontro su menu, no aparecera en el sidebar.
-- ---------------------------------------------------------------------------

SELECT
    r.nombre                                   AS rol,
    COUNT(DISTINCT rpm.modulo_id)              AS modulos_con_permiso,
    COUNT(*)                                   AS permisos_totales
FROM public.roles r
LEFT JOIN public.rol_permisos_modulo rpm ON rpm.rol_id = r.id AND rpm.activo
GROUP BY r.nombre
ORDER BY r.nombre;
