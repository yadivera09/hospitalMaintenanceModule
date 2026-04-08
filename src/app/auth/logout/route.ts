import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'
import { clearSesionMfa } from '@/app/actions/mfa'

/**
 * POST /auth/logout
 * Cierra la sesión actual y redirige a /login.
 * Se llama desde el botón "Salir" en la Navbar.
 *
 * Orden crítico:
 *   1. Leer el userId ANTES de signOut (después la sesión ya no existe).
 *   2. Resetear mfa_sesion_verificada para usuarios email.
 *   3. signOut() — invalida el JWT.
 */
export async function POST() {
    const supabase = createClient()

    // 1. Obtener userId antes de cerrar sesión
    const { data: { user } } = await supabase.auth.getUser()

    // 2. Resetear flag de sesión email (no-op para usuarios TOTP o sin MFA)
    if (user?.id) {
        await clearSesionMfa(user.id)
    }

    // 3. Cerrar sesión
    await supabase.auth.signOut()

    return NextResponse.redirect(
        new URL('/login', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')
    )
}
