/**
 * src/lib/seguridad/modulos.ts
 *
 * URLs de los módulos del catálogo, como constantes.
 *
 * Son las mismas que siembra la migración 018 y con las que el middleware
 * resuelve los permisos. Se centralizan aquí porque las usan más de sesenta
 * server actions: un literal mal escrito no da error de compilación, y como
 * la evaluación es fail-closed, se traduciría en un permiso que nunca se
 * concede y en una operación que nadie puede ejecutar.
 *
 * Al añadir un módulo hay que tocar dos sitios: la tabla `modulos` y esta
 * constante. La tabla manda; esto solo evita erratas.
 */

export const MODULO = {
    // Panel de administración
    DASHBOARD: '/admin/dashboard',
    CLIENTES:  '/admin/clientes',
    CONTRATOS: '/admin/contratos',
    EQUIPOS:   '/admin/equipos',
    TECNICOS:  '/admin/tecnicos',
    CATALOGOS: '/admin/catalogos',
    REPORTES:  '/admin/reportes',
    ANALISIS:  '/admin/reportes/analisis',

    // Seguridad
    ROLES:     '/admin/seguridad/roles',
    USUARIOS:  '/admin/seguridad/usuarios',
    GRUPOS:    '/admin/seguridad/grupos',
    AUDITORIA: '/admin/seguridad/auditoria',

    // Panel del técnico
    TEC_DASHBOARD:     '/tecnico/dashboard',
    TEC_MIS_REPORTES:  '/tecnico/mis-reportes',
    TEC_NUEVO_REPORTE: '/tecnico/nuevo-reporte',
} as const

/**
 * Códigos de permiso del catálogo (migración 013).
 * 'anular' es específico de reportes; el resto es CRUD más exportación.
 */
export const PERMISO = {
    VER:      'ver',
    CREAR:    'crear',
    EDITAR:   'editar',
    ELIMINAR: 'eliminar',
    EXPORTAR: 'exportar',
    ANULAR:   'anular',
} as const
