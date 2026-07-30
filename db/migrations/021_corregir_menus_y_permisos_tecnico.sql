-- =============================================================================
-- Migration: 021_corregir_menus_y_permisos_tecnico
-- Description: Corrige dos desviaciones de datos que dejaban al rol 'tecnico'
--              aterrizando en el panel de administracion tras iniciar sesion.
--
--   SINTOMA
--   Un usuario con rol 'tecnico' se autenticaba y el middleware lo enviaba a
--   /admin/dashboard. Escribiendo /tecnico/dashboard a mano si entraba a su
--   panel. El middleware no fallaba: aplicaba la matriz tal como esta en la
--   base.
--
--   CAUSA 1 - PERMISOS DE MAS
--   El rol 'tecnico' tenia permiso 'ver' sobre 7 modulos de /admin/*
--   (dashboard, clientes, contratos, equipos, catalogos, reportes, analisis),
--   ademas de 'exportar' en reportes y 'crear'/'editar'/'exportar' en analisis.
--   La migracion 018 solo le sembro /tecnico/%; estas concesiones se hicieron
--   despues desde /admin/seguridad/roles.
--
--   Con ellas, middleware.ts:255 lo deja pasar a /admin/* y (admin)/layout.tsx
--   renderiza el panel completo, porque su unica condicion es que el usuario
--   tenga al menos un modulo visible bajo /admin.
--
--   CAUSA 2 - MODULOS EN EL MENU EQUIVOCADO
--   Los 8 modulos /admin/* de negocio quedaron colgando del menu 'Operaciones'
--   (el del tecnico) en vez de 'Administracion', que quedo vacio. El JOIN por
--   nombre de la migracion 018 no los ubico donde debia.
--
--   El efecto no es solo cosmetico: getUrlsModulos() ordena el catalogo por
--   (menu.orden, modulo.orden) y con todo en el mismo menu las claves chocaban
--   exactamente — /admin/dashboard y /tecnico/dashboard compartian (1,1). El
--   destino post-login quedaba a merced del orden en que Postgres devolviera
--   las filas. El desempate por url se corrigio en navegacion.ts; esta
--   migracion elimina el empate de raiz.
--
--   NOTA SOBRE EL ROL 'Supervisor'
--   Se deja intacto. Tiene 'ver' sobre 4 modulos de /admin/*, que es justo su
--   proposito. Se registra aqui que el seed del paso 4 de la 018 nunca le
--   aplico —busca 'supervisor' en minuscula y el rol se llamo 'Supervisor'—,
--   asi que sus permisos actuales tambien se dieron a mano.
--
-- Prerrequisitos: 013 (menus), 018 (modulos y matriz)
-- Tablas que modifica: modulos (UPDATE menu_id), rol_permisos_modulo (DELETE)
-- =============================================================================


-- ###########################################################################
-- BLOQUE 1 - VERIFICACION PREVIA (solo lectura, no cambia nada)
-- ###########################################################################

-- 1.1 Como esta repartido hoy el catalogo entre menus.
--     Se espera ver los /admin/* de negocio bajo 'Operaciones'.
SELECT
    me.nombre  AS menu,
    me.orden   AS menu_orden,
    mo.orden   AS modulo_orden,
    mo.url
FROM public.modulos mo
JOIN public.menus me ON me.id = mo.menu_id
WHERE mo.activo
ORDER BY me.orden, mo.orden, mo.url;

-- 1.2 Empates de orden en el catalogo: filas con mas de un modulo por
--     (menu.orden, modulo.orden). Se espera 3 empates antes del cambio.
SELECT
    me.orden AS menu_orden,
    mo.orden AS modulo_orden,
    COUNT(*) AS modulos_empatados,
    string_agg(mo.url, ' | ' ORDER BY mo.url) AS urls
FROM public.modulos mo
JOIN public.menus me ON me.id = mo.menu_id
WHERE mo.activo
GROUP BY me.orden, mo.orden
HAVING COUNT(*) > 1
ORDER BY me.orden, mo.orden;

-- 1.3 Alcance real del rol 'tecnico'. Se esperan 7 modulos /admin/* de mas.
SELECT
    mo.url,
    string_agg(p.codigo, ', ' ORDER BY p.codigo) AS permisos
FROM public.rol_permisos_modulo rpm
JOIN public.roles    r  ON r.id  = rpm.rol_id
JOIN public.modulos  mo ON mo.id = rpm.modulo_id
JOIN public.permisos p  ON p.id  = rpm.permiso_id
WHERE r.nombre = 'tecnico'
  AND rpm.activo
GROUP BY mo.url
ORDER BY mo.url;

-- 1.4 Cuantas filas va a borrar el BLOQUE 2. Debe coincidir con lo que se
--     elimine despues.
SELECT COUNT(*) AS filas_a_borrar
FROM public.rol_permisos_modulo rpm
JOIN public.roles   r  ON r.id  = rpm.rol_id
JOIN public.modulos mo ON mo.id = rpm.modulo_id
WHERE r.nombre = 'tecnico'
  AND mo.url LIKE '/admin/%';


-- ###########################################################################
-- BLOQUE 2 - CORRECCION
-- ###########################################################################

BEGIN;

-- ---------------------------------------------------------------------------
-- 2.1 Devolver los modulos /admin/* de negocio al menu 'Administracion'.
--
-- Los de /admin/seguridad/% se quedan donde estan: ya cuelgan del menu
-- 'Seguridad', que es su sitio.
--
-- El menu se identifica con ILIKE 'Administraci_n', donde _ casa con un unico
-- caracter. NO usar translate(lower(nombre), 'aeiou con tilde', 'aeiou):
-- esa comparacion obliga a escribir vocales acentuadas DENTRO del SQL, y ese
-- literal no sobrevive el viaje hasta el editor donde se ejecuta — se corrompe
-- y la condicion deja de casar en silencio, afectando 0 filas sin dar error.
-- Es exactamente lo que le paso al JOIN de la migracion 018 y lo que dejo el
-- menu 'Administracion' vacio en primer lugar.
--
-- El patron es 100% ASCII y casa igual si el nombre quedo escrito con tilde
-- ('Administración') o sin ella ('Administracion').
--
-- El UPDATE falla en vez de escribir NULL si el menu no aparece: menu_id es
-- la referencia que coloca al modulo en el sidebar y dejarlo nulo lo sacaria
-- de la navegacion sin avisar.
-- ---------------------------------------------------------------------------

UPDATE public.modulos mo
SET menu_id = (
        SELECT id FROM public.menus
        WHERE nombre ILIKE 'Administraci_n'
        ORDER BY orden
        LIMIT 1
    )
WHERE mo.url LIKE '/admin/%'
  AND mo.url NOT LIKE '/admin/seguridad/%'
  AND EXISTS (
        SELECT 1 FROM public.menus WHERE nombre ILIKE 'Administraci_n'
    );

-- ---------------------------------------------------------------------------
-- 2.2 Revocar los permisos del rol 'tecnico' sobre /admin/*.
--
-- Se BORRA la fila en vez de marcarla activo = false porque asi es como lo
-- gestiona la pantalla de roles: asignarPermisosRol() hace DELETE de todo el
-- rol y reinserta lo marcado (src/app/actions/seguridad/roles.ts:396-414).
-- Dejar filas inactivas creeria un estado que la interfaz nunca produce.
--
-- Los permisos sobre /tecnico/* no se tocan.
-- ---------------------------------------------------------------------------

DELETE FROM public.rol_permisos_modulo rpm
USING public.roles r, public.modulos mo
WHERE r.id  = rpm.rol_id
  AND mo.id = rpm.modulo_id
  AND r.nombre = 'tecnico'
  AND mo.url LIKE '/admin/%';

COMMIT;


-- ###########################################################################
-- BLOQUE 3 - VERIFICACION POSTERIOR
-- ###########################################################################

-- 3.1 Reparto del catalogo. Ahora 'Operaciones' debe contener solo /tecnico/*,
--     'Administracion' los /admin/* de negocio y 'Seguridad' los suyos.
SELECT
    me.nombre  AS menu,
    me.orden   AS menu_orden,
    mo.orden   AS modulo_orden,
    mo.url
FROM public.modulos mo
JOIN public.menus me ON me.id = mo.menu_id
WHERE mo.activo
ORDER BY me.orden, mo.orden, mo.url;

-- 3.2 Empates de orden. Debe devolver 0 filas.
SELECT
    me.orden AS menu_orden,
    mo.orden AS modulo_orden,
    COUNT(*) AS modulos_empatados,
    string_agg(mo.url, ' | ' ORDER BY mo.url) AS urls
FROM public.modulos mo
JOIN public.menus me ON me.id = mo.menu_id
WHERE mo.activo
GROUP BY me.orden, mo.orden
HAVING COUNT(*) > 1
ORDER BY me.orden, mo.orden;

-- 3.3 Alcance del rol 'tecnico'. Deben quedar SOLO los 3 modulos /tecnico/*
--     con ver, crear y editar.
SELECT
    mo.url,
    string_agg(p.codigo, ', ' ORDER BY p.codigo) AS permisos
FROM public.rol_permisos_modulo rpm
JOIN public.roles    r  ON r.id  = rpm.rol_id
JOIN public.modulos  mo ON mo.id = rpm.modulo_id
JOIN public.permisos p  ON p.id  = rpm.permiso_id
WHERE r.nombre = 'tecnico'
  AND rpm.activo
GROUP BY mo.url
ORDER BY mo.url;

-- 3.4 Destino post-login de cada rol: el primer modulo del catalogo sobre el
--     que tiene 'ver', con el mismo orden que aplica getUrlsModulos().
--     'tecnico' debe dar /tecnico/dashboard.
SELECT DISTINCT ON (r.nombre)
    r.nombre AS rol,
    mo.url   AS destino_post_login
FROM public.roles r
JOIN public.rol_permisos_modulo rpm ON rpm.rol_id = r.id AND rpm.activo
JOIN public.modulos  mo ON mo.id = rpm.modulo_id AND mo.activo
JOIN public.menus    me ON me.id = mo.menu_id
JOIN public.permisos p  ON p.id  = rpm.permiso_id AND p.codigo = 'ver'
WHERE r.activo
ORDER BY r.nombre, me.orden, mo.orden, mo.url;
