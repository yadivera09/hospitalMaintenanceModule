import { createClient } from '@/lib/supabase/server'
import { getEstadoUsuario, permisosUsuario, ROL_ADMINISTRADOR } from '@/lib/seguridad/permisos'
import {
    getNavegacionUsuario,
    getUrlsModulos,
    PATHNAME_HEADER,
} from '@/lib/seguridad/navegacion'
import { puedeVerRuta, destinoAlternativo } from '@/lib/seguridad/autorizarRuta'
import { PermisosProvider } from '@/lib/seguridad/PermisosProvider'
import AdminLayoutClient from '@/components/admin/AdminLayoutClient'
import type { UsuarioSesion } from '@/types'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * src/app/(admin)/layout.tsx
 * Layout base del panel Administrador (Server Component).
 *
 * Segunda línea de defensa: repite contra usuario_roles y la matriz de permisos
 * lo que ya decidió el middleware. Si una ruta se le escapa al matcher, el panel
 * sigue cerrado.
 *
 * Antes la única condición era tener al menos un módulo visible bajo /admin, lo
 * que convertía un solo permiso 'ver' en la llave del panel entero: quien podía
 * ver el dashboard podía abrir también clientes, contratos o seguridad. Ahora se
 * comprueba la pantalla concreta que se está pidiendo.
 */

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = createClient()

    // getUser() valida el JWT contra el servidor de Auth — no usar getSession()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const estado = await getEstadoUsuario(user.id)

    if (!estado || !estado.activo) {
        redirect('/login')
    }

    // Los permisos se calculan una sola vez y sirven para tres cosas: autorizar
    // la ruta, filtrar la navegación y bajar al cliente para mostrar u ocultar
    // acciones.
    const [permisos, urlsCatalogo] = await Promise.all([
        permisosUsuario(user.id),
        getUrlsModulos(),
    ])

    // El prefijo evita listar las pantallas del técnico en el panel de
    // administración a quien tenga ambos roles.
    const navegacion = await getNavegacionUsuario(user.id, '/admin', permisos)

    // El acceso al panel se decide por permisos, no por nombre de rol: exigir
    // 'administrador' dejaría fuera a cualquier rol nuevo que legítimamente
    // deba usar estas pantallas. Sin ningún módulo visible aquí, no hay panel
    // que mostrar.
    if (navegacion.length === 0) {
        redirect(destinoAlternativo(permisos, urlsCatalogo))
    }

    // ── Autorización de la pantalla concreta ────────────────────────────────
    //
    // El pathname lo escribe el middleware (ver PATHNAME_HEADER). Su ausencia
    // significa que la petición no pasó por él, que es exactamente el escenario
    // contra el que existe esta segunda línea: se deniega.
    //
    // Fallar cerrado aquí no puede dejar fuera a nadie por accidente — el
    // matcher cubre /admin/:path* sin excepciones, así que toda navegación real
    // al panel llega con la cabecera puesta.
    const pathname = headers().get(PATHNAME_HEADER)

    if (!pathname || !pathname.startsWith('/admin')) {
        redirect(destinoAlternativo(permisos, urlsCatalogo))
    }

    if (!puedeVerRuta(pathname, permisos, urlsCatalogo)) {
        redirect(destinoAlternativo(permisos, urlsCatalogo))
    }

    // Construye el objeto usuario para pasar al Navbar
    const usuarioSesion: UsuarioSesion = {
        id: user.id,
        email: estado.email,
        nombre: estado.nombre,
        apellido: estado.apellido,
        rol: estado.roles.includes(ROL_ADMINISTRADOR) ? 'administrador' : (estado.roles[0] ?? ''),
    }

    return (
        <PermisosProvider permisos={permisos}>
            <AdminLayoutClient usuario={usuarioSesion} navegacion={navegacion}>
                {children}
            </AdminLayoutClient>
        </PermisosProvider>
    )
}

