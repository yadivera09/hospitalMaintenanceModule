'use client'

/**
 * src/lib/seguridad/PermisosProvider.tsx
 *
 * Pone los permisos del usuario a disposición de los componentes de cliente,
 * para mostrar u ocultar acciones según lo que realmente puede hacer.
 *
 * IMPORTANTE — esto NO es control de acceso:
 *   Ocultar un botón mejora la claridad, no la seguridad. Cualquiera puede
 *   invocar una server action desde la consola del navegador. La protección
 *   real vive en requirePermiso() dentro de cada action y en el middleware.
 *   Si alguna vez hay que elegir, se protege la action; el botón es cosmética.
 *
 * El mapa lo calcula el layout en el servidor y baja ya resuelto, así que no
 * cuesta ninguna consulta adicional.
 */

import { createContext, useContext, useCallback } from 'react'

/** Mapa url de módulo → códigos de permiso concedidos. */
export type MapaPermisos = Record<string, string[]>

const PermisosContext = createContext<MapaPermisos>({})

export function PermisosProvider({
    permisos,
    children,
}: {
    permisos: MapaPermisos
    children: React.ReactNode
}) {
    return (
        <PermisosContext.Provider value={permisos}>
            {children}
        </PermisosContext.Provider>
    )
}

/**
 * Devuelve una función para consultar permisos.
 *
 * @example
 *   const puede = usePuede()
 *   {puede(MODULO.EQUIPOS, PERMISO.CREAR) && <Button>Nuevo equipo</Button>}
 */
export function usePuede() {
    const permisos = useContext(PermisosContext)

    return useCallback(
        (moduloUrl: string, permisoCodigo: string) =>
            permisos[moduloUrl]?.includes(permisoCodigo) ?? false,
        [permisos]
    )
}

/** Acceso al mapa completo, para casos que necesitan varias comprobaciones. */
export function usePermisos(): MapaPermisos {
    return useContext(PermisosContext)
}
