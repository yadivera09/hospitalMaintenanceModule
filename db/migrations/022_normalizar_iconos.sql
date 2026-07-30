-- =============================================================================
-- Migration: 022_normalizar_iconos
-- Description: Unifica la columna 'icono' de menus y modulos en la convencion
--              de lucide-react, que es la que el sidebar sabe dibujar.
--
--   SINTOMA
--   Doce de los quince modulos aparecian en el sidebar con un circulo gris en
--   vez de su icono. Los tres que si se veian eran los de /tecnico/*.
--
--   CAUSA
--   La columna convivia con dos convenciones. Los modulos de /admin/* se
--   sembraron con clases de Bootstrap Icons ('bi bi-speedometer2') y los de
--   /tecnico/* con nombres de componente de lucide ('LayoutDashboard'). El
--   sidebar resuelve lo segundo, asi que lo primero caia al icono por defecto.
--
--   El seed de la migracion 018 traia ya los nombres correctos, pero su
--   ON CONFLICT (url) DO NOTHING respetaba las filas que ya existian: los
--   /admin/* venian de un alta anterior y se quedaron como estaban. Es el mismo
--   motivo por el que quedaron colgando del menu equivocado (ver 021).
--
--   ESTA MIGRACION NO ES NECESARIA PARA QUE SE VEAN LOS ICONOS
--   El sidebar ya traduce las clases 'bi bi-*' al componente equivalente, asi
--   que la vista es correcta con o sin este UPDATE. Lo que aporta es dejar una
--   sola convencion en la base: guardar clases de Bootstrap ata el esquema a
--   una libreria de iconos concreta, que es justo lo que la columna pretendia
--   evitar al guardar un nombre neutro en vez de una clase CSS.
--
-- Prerrequisitos: 013 (menus), 018 (modulos)
-- Tablas que modifica (UPDATE): menus.icono, modulos.icono
-- =============================================================================


-- ###########################################################################
-- BLOQUE 1 - VERIFICACION PREVIA (solo lectura)
-- ###########################################################################

-- 1.1 Estado actual. Se esperan 12 modulos y 3 menus con la convencion 'bi'.
SELECT 'menu' AS tipo, nombre, icono,
       CASE WHEN icono LIKE 'bi %' THEN 'bootstrap' ELSE 'lucide' END AS convencion
FROM public.menus
UNION ALL
SELECT 'modulo', url, icono,
       CASE WHEN icono LIKE 'bi %' THEN 'bootstrap' ELSE 'lucide' END
FROM public.modulos
WHERE activo
ORDER BY 4, 1, 2;

-- 1.2 Recuento por convencion. Se esperan 15 'bootstrap' y 3 'lucide'.
SELECT CASE WHEN icono LIKE 'bi %' THEN 'bootstrap' ELSE 'lucide' END AS convencion,
       COUNT(*)
FROM (
    SELECT icono FROM public.menus
    UNION ALL
    SELECT icono FROM public.modulos WHERE activo
) t
GROUP BY 1
ORDER BY 1;


-- ###########################################################################
-- BLOQUE 2 - CORRECCION
--
-- Las equivalencias son las mismas que aplica ALIAS_BOOTSTRAP en
-- src/components/admin/Sidebar.tsx. Si se cambian aqui, cambiarlas alli.
--
-- Todos los literales son ASCII a proposito: escribir vocales acentuadas
-- dentro del SQL fue lo que hizo fallar en silencio a la 018 y al primer
-- intento de la 021.
-- ###########################################################################

BEGIN;

UPDATE public.menus m
SET icono = v.lucide
FROM (VALUES
    ('bi bi-tools',       'Wrench'),
    ('bi bi-gear',        'Settings'),
    ('bi bi-shield-lock', 'ShieldCheck')
) AS v(bootstrap, lucide)
WHERE m.icono = v.bootstrap;

UPDATE public.modulos mo
SET icono = v.lucide
FROM (VALUES
    ('bi bi-speedometer2',   'LayoutDashboard'),
    ('bi bi-building',       'Building2'),
    ('bi bi-file-text',      'FileText'),
    ('bi bi-heart-pulse',    'Stethoscope'),
    ('bi bi-person-gear',    'HardHat'),
    ('bi bi-book',           'BookOpen'),
    ('bi bi-clipboard-list', 'ClipboardList'),
    ('bi bi-bar-chart',      'BarChart2'),
    ('bi bi-key',            'KeyRound'),
    ('bi bi-people',         'Users'),
    ('bi bi-diagram-3',      'Network'),
    ('bi bi-journal-text',   'ScrollText')
) AS v(bootstrap, lucide)
WHERE mo.icono = v.bootstrap;

COMMIT;


-- ###########################################################################
-- BLOQUE 3 - VERIFICACION POSTERIOR
-- ###########################################################################

-- 3.1 No debe quedar ningun icono con la convencion 'bi'. Cero filas.
SELECT 'menu' AS tipo, nombre, icono FROM public.menus  WHERE icono LIKE 'bi %'
UNION ALL
SELECT 'modulo', url, icono FROM public.modulos WHERE activo AND icono LIKE 'bi %';

-- 3.2 Estado final: los 18 iconos, todos en nombres de lucide.
SELECT 'menu' AS tipo, nombre, icono FROM public.menus
UNION ALL
SELECT 'modulo', url, icono FROM public.modulos WHERE activo
ORDER BY 1, 2;
