import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminLayoutClient from '@/components/admin/AdminLayoutClient'
import type { UsuarioSesion } from '@/types'
import { redirect } from 'next/navigation'

/**
 * src/app/(admin)/layout.tsx
 * Layout base del panel Administrador (Server Component).
 * Lee la sesión real de Supabase y los datos del perfil del usuario.
 */

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        redirect('/login')
    }

    const user = session.user

    // Buscar el nombre y apellido desde la tabla usuarios
    const admin = createAdminClient()
    const { data: usuarioData } = await admin
        .from('usuarios')
        .select('nombre, apellido, email')
        .eq('user_id', user.id)
        .maybeSingle()

    // Construye el objeto usuario para pasar al Navbar
    const usuarioSesion: UsuarioSesion = {
        id: user.id,
        email: user.email ?? '',
        nombre: usuarioData?.nombre ?? user.user_metadata?.nombre ?? 'Admin',
        apellido: usuarioData?.apellido ?? user.user_metadata?.apellido ?? '',
        rol: 'administrador', // Por ahora hardcodeado como admin para este layout específico
    }

    return (
        <AdminLayoutClient usuario={usuarioSesion}>
            {children}
        </AdminLayoutClient>
    )
}
