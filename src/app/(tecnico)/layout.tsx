import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEstadoUsuario, permisosUsuario } from '@/lib/seguridad/permisos'
import { getUrlsModulos, PATHNAME_HEADER } from '@/lib/seguridad/navegacion'
import { puedeVerRuta, destinoAlternativo } from '@/lib/seguridad/autorizarRuta'
import TecnicoLayoutClient, { type TecnicoSesion } from '@/components/tecnico/TecnicoLayoutClient'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * src/app/(tecnico)/layout.tsx
 * Layout base del panel Técnico (Server Component).
 *
 * Segunda línea de defensa, simétrica a la del panel de administración: repite
 * contra usuario_roles y la matriz de permisos lo que ya decidió el middleware.
 *
 * Hasta ahora este layout era un componente de cliente sin ninguna comprobación
 * de acceso: dependía por completo del middleware. Identificaba al usuario con
 * getSession(), que decodifica el JWT de la cookie SIN validarlo contra el
 * servidor de Auth, y si no encontraba ficha de técnico mostraba el nombre
 * guardado en user_metadata — un campo que el propio usuario puede escribir.
 *
 * SOBRE EL MODO OFFLINE
 *   Que sea un Server Component no rompe la PWA. Sin red el service worker
 *   sirve el documento ya renderizado que guardó con conexión, exactamente
 *   igual que hacía antes con el cascarón del componente de cliente. La
 *   diferencia es que ahora ese documento solo se genera para quien tiene
 *   permiso.
 */

export default async function TecnicoLayout({
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

    const [permisos, urlsCatalogo] = await Promise.all([
        permisosUsuario(user.id),
        getUrlsModulos(),
    ])

    // El pathname lo escribe el middleware (ver PATHNAME_HEADER). Su ausencia
    // significa que la petición no pasó por él, que es justo el escenario
    // contra el que existe esta segunda línea: se deniega.
    const pathname = headers().get(PATHNAME_HEADER)

    if (!pathname || !pathname.startsWith('/tecnico')) {
        redirect(destinoAlternativo(permisos, urlsCatalogo))
    }

    if (!puedeVerRuta(pathname, permisos, urlsCatalogo)) {
        redirect(destinoAlternativo(permisos, urlsCatalogo))
    }

    // ── Ficha de técnico ─────────────────────────────────────────────────────
    //
    // Se busca por user_id, que es el vínculo real con la identidad. El email
    // de 'tecnicos' es una copia sincronizada desde 'usuarios': si se edita
    // allí y la ficha no se resincroniza, buscar por email no encuentra nada.
    //
    // Con el cliente de servicio, no con la sesión: las políticas de RLS sobre
    // 'tecnicos' no tienen por qué dejar al técnico leer su propia ficha, y
    // aquí solo se consulta la del usuario ya autenticado.
    const admin = createAdminClient()

    const { data: ficha } = await admin
        .from('tecnicos')
        .select('id')
        .eq('user_id', user.id)
        .eq('activo', true)
        .maybeSingle()

    // Nombre y apellido salen de 'usuarios', que es la fuente desde la
    // migración 016 — las columnas de 'tecnicos' son copias suyas.
    const tecnico: TecnicoSesion = {
        id: ficha?.id ?? '',
        nombre: estado.nombre,
        apellido: estado.apellido,
    }

    return (
        <TecnicoLayoutClient tecnico={tecnico}>
            {children}
        </TecnicoLayoutClient>
    )
}
