import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /auth/callback
 *
 * Route Handler que intercambia tokens de Supabase Auth por una sesión con cookie.
 * Cubre los flujos que usan token_hash en la URL:
 *   - type=invite    → link de invitación a técnico nuevo
 *   - type=recovery  → link de restablecimiento de contraseña
 *   - type=email     → confirmación de cambio de email
 *
 * Flujo de invitación completo:
 *   1. Admin crea técnico → inviteUserByEmail envía email con link
 *   2. Técnico hace click → Supabase redirige a esta ruta con token_hash + type=invite
 *   3. verifyOtp intercambia el token → sesión queda en cookies (AAL1)
 *   4. Redirigir a /configurar-mfa?bienvenida=1
 *   5. Middleware detecta mfa_configurado=false → deja pasar (ya está en /configurar-mfa)
 *
 * Por qué usar token_hash y no code (PKCE):
 *   Supabase genera token_hash para los flujos de email (invite, recovery, magic link).
 *   El flujo PKCE con `code` es para OAuth providers. Para invitaciones por email
 *   siempre llega token_hash + type.
 *
 * IMPORTANTE — configuración en Supabase Dashboard:
 *   Authentication → URL Configuration → Redirect URLs
 *   Agregar: {SITE_URL}/auth/callback
 *   Sin esto los links del email serán rechazados por Supabase.
 */
export async function GET(request: NextRequest) {
    const { searchParams, origin } = request.nextUrl
    const tokenHash = searchParams.get('token_hash')
    const type      = searchParams.get('type') as 'invite' | 'recovery' | 'email' | null
    // `next` es el destino final tras autenticar — viene de redirectTo en inviteUserByEmail
    const next      = searchParams.get('next') ?? '/configurar-mfa'

    // Sin token_hash no hay nada que intercambiar
    if (!tokenHash || !type) {
        return NextResponse.redirect(
            new URL('/login?error=link-invalido', origin)
        )
    }

    const supabase = createClient()

    const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
    })

    if (error) {
        console.error('[auth/callback] verifyOtp', { type, error: error.message })
        // Link expirado (>24 h) o ya usado — informar al técnico
        return NextResponse.redirect(
            new URL('/login?error=link-expirado', origin)
        )
    }

    // Sesión establecida en cookies — redirigir al destino
    // Para invitaciones: next=/configurar-mfa?bienvenida=1
    // Para recovery/email: next viene del redirectTo configurado en cada flujo
    const destination = next.startsWith('/')
        ? new URL(next, origin)
        : new URL('/configurar-mfa', origin)   // fallback seguro: nunca redirigir a URL externa

    // Añadir ?bienvenida=1 solo para el flujo de invitación
    if (type === 'invite' && !destination.searchParams.has('bienvenida')) {
        destination.searchParams.set('bienvenida', '1')
    }

    return NextResponse.redirect(destination)
}
