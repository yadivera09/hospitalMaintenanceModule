'use server'

/**
 * src/app/actions/seguridad/sesion.ts
 * Server Actions de sesión — resuelven datos que el cliente no puede calcular
 * sin exponer la service key.
 */

import { getActor } from '@/lib/seguridad/guard'
import { ROL_ADMINISTRADOR, permisosUsuario } from '@/lib/seguridad/permisos'
import { getUrlsModulos } from '@/lib/seguridad/navegacion'

/** Resultado del cálculo de destino tras un login exitoso. */
export interface DestinoPostLogin {
    /** Ruta a la que redirigir, o null si el usuario no puede entrar. */
    destino: string | null
    /** Motivo del rechazo, listo para mostrar al usuario. */
    error: string | null
}

/**
 * Decide a qué pantalla enviar al usuario recién autenticado.
 *
 * Se resuelve por PERMISOS, no por nombre de rol. Decidir por rol solo
 * funcionaba con 'administrador' y 'tecnico': cualquier rol nuevo caía en el
 * panel del técnico, donde no tiene ficha y todo falla. Ahora se manda a la
 * primera pantalla que la persona puede ver realmente.
 *
 * Se resuelve en el servidor contra usuario_roles; el cliente no puede leerlo
 * y user_metadata.rol no es confiable — lo escribe el propio usuario.
 */
export async function getDestinoPostLogin(): Promise<DestinoPostLogin> {
    const actor = await getActor()

    if (!actor) {
        return {
            destino: null,
            error: 'Tu cuenta está desactivada o no está registrada en el sistema. Contacta al administrador.',
        }
    }

    if (actor.roles.length === 0) {
        return {
            destino: null,
            error: 'Tu usuario no tiene un rol asignado. Contacta al administrador.',
        }
    }

    // El administrador tiene acceso total; su panel es siempre el destino.
    if (actor.roles.includes(ROL_ADMINISTRADOR)) {
        return { destino: '/admin/dashboard', error: null }
    }

    const [permisos, urlsCatalogo] = await Promise.all([
        permisosUsuario(actor.userId),
        getUrlsModulos(),
    ])

    // Se recorre el catálogo, no las claves de permisos, para respetar el
    // orden en que están definidos los módulos.
    const destino = urlsCatalogo.find((url) => permisos[url]?.includes('ver'))

    if (destino) return { destino, error: null }

    return {
        destino: null,
        error: 'Tu rol no tiene ninguna pantalla asignada. Contacta al administrador.',
    }
}
