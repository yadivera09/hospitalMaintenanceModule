import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /auth/logout
 * Cierra la sesión actual y redirige a /login.
 * Se llama desde el botón "Salir" de la Navbar y desde las pantallas de MFA.
 *
 * Esta ruta está en ESCAPE_ROUTES del middleware: debe funcionar en cualquier
 * estado de sesión, incluido el segundo factor a medias. De lo contrario el
 * gate de MFA la intercepta y la sesión nunca llega a cerrarse.
 *
 * Ya no resetea flags de MFA en la base: con TOTP el estado por sesión vive
 * en el AAL del JWT, que muere junto con la sesión.
 */
export async function POST(request: Request) {
    const supabase = createClient()
    const { origin } = new URL(request.url)

    await supabase.auth.signOut()

    return NextResponse.redirect(`${origin}/login`, { status: 303 })
}
