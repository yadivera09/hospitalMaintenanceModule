import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Rutas agrupadas por tipo de acceso.
 *
 * MFA_ROUTES   — páginas del flujo MFA: deben ser accesibles con sesión AAL1.
 *                Si se añaden aquí también se excluyen del MFA gate para evitar
 *                loops de redirección.
 * AUTH_ROUTES  — páginas públicas de autenticación (sin sesión requerida).
 * ADMIN_ROUTES / TECNICO_ROUTES — rutas protegidas por rol.
 */
const MFA_ROUTES = ['/configurar-mfa', '/verificar-mfa']
const AUTH_ROUTES = ['/login']
const ADMIN_ROUTES = ['/admin']
const TECNICO_ROUTES = ['/tecnico']

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function redirect(request: NextRequest, pathname: string) {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    return NextResponse.redirect(url)
}

function isProtectedRoute(pathname: string) {
    return (
        ADMIN_ROUTES.some((r) => pathname.startsWith(r)) ||
        TECNICO_ROUTES.some((r) => pathname.startsWith(r))
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Refrescar sesión — NUNCA eliminar esta línea
    const {
        data: { user },
    } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname

    // ─── 1. Rutas MFA: accesibles solo con sesión (AAL1 es suficiente) ────────
    // Estas rutas deben estar ANTES del MFA gate para evitar loops.
    // Si no hay sesión, redirigir a login (el usuario puede haber expirado).
    if (MFA_ROUTES.some((r) => pathname.startsWith(r))) {
        if (!user) return redirect(request, '/login')
        return supabaseResponse
    }

    // ─── 2. Sin sesión: proteger rutas privadas ───────────────────────────────
    if (!user) {
        if (isProtectedRoute(pathname)) return redirect(request, '/login')
        return supabaseResponse
    }

    // ─── 3. Con sesión: verificar MFA antes de cualquier otra lógica ─────────
    //
    // Orden de verificación para minimizar llamadas a la DB:
    //  a) Verificar AAL del JWT — suficiente para usuarios TOTP.
    //  b) Solo si el JWT no indica AAL2 (usuarios email o sin configurar),
    //     consultar la tabla tecnicos para leer el estado MFA.
    //
    // Esto aplica tanto a rutas protegidas como a /login (para saber a dónde
    // redirigir al usuario ya autenticado).

    const mfaState = await resolveMfaState(supabase, user.id)

    // MFA no configurado → forzar setup antes de continuar
    if (mfaState === 'needs-setup') {
        return redirect(request, '/configurar-mfa')
    }

    // MFA configurado pero no verificado en esta sesión → forzar verificación
    if (mfaState === 'needs-verify') {
        return redirect(request, '/verificar-mfa')
    }

    // ─── 4. MFA OK — continuar con lógica de rol ─────────────────────────────

    const rol = user.user_metadata?.rol as string | undefined

    // Sin rol asignado en rutas protegidas → login
    if (!rol && isProtectedRoute(pathname)) {
        return redirect(request, '/login')
    }

    // Técnico intentando acceder a rutas de admin
    if (rol === 'tecnico' && ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
        return redirect(request, '/tecnico/dashboard')
    }

    // Administrador intentando acceder a rutas de técnico
    if (rol === 'administrador' && TECNICO_ROUTES.some((r) => pathname.startsWith(r))) {
        return redirect(request, '/admin/dashboard')
    }

    // Usuario autenticado (MFA completo) en página de login → dashboard
    if (AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
        const dest = rol === 'administrador' ? '/admin/dashboard' : '/tecnico/dashboard'
        return redirect(request, dest)
    }

    return supabaseResponse
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveMfaState
//
// Determina el estado MFA del usuario actual para decidir si puede continuar.
// Retorna:
//   'ok'           — segundo factor completado, puede acceder
//   'needs-setup'  — nunca configuró MFA, debe ir a /configurar-mfa
//   'needs-verify' — tiene MFA pero aún no lo verificó en esta sesión
//
// Estrategia:
//   1. Verificar AAL del JWT (sin DB) → cubre a todos los usuarios TOTP.
//   2. Solo si AAL no es aal2 → consultar tecnicos (cubre usuarios email).
// ─────────────────────────────────────────────────────────────────────────────

async function resolveMfaState(
    supabase: any,
    userId: string
): Promise<'ok' | 'needs-setup' | 'needs-verify'> {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    const currentLevel: string = aalData?.currentLevel ?? 'aal1'
    const nextLevel: string = aalData?.nextLevel ?? 'aal1'

    // ✅ Log temporal para confirmar qué lee el middleware (quitar en producción)
    console.log('[middleware] AAL →', { currentLevel, nextLevel, userId })

    if (currentLevel === 'aal2') return 'ok'
    if (nextLevel === 'aal2') return 'needs-verify'

    // Solo consultar DB si no hay factor TOTP
    // Usar admin client para bypass de RLS — el middleware no tiene contexto auth del usuario
    const admin = createAdminClient()

    // LOG NUEVO
    console.log('[middleware] SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30))
    console.log('[middleware] SERVICE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
    console.log('[middleware] SERVICE_KEY prefix:', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 15))

    const { data: tecnico, error: tecError } = await admin
        .from('tecnicos')
        .select('mfa_configurado, mfa_metodo, mfa_sesion_verificada')
        .eq('user_id', userId)
        .single()

    // LOG NUEVO
    console.log('[middleware] tecnico query result:', { tecnico, tecError })

    if (!tecnico) return 'needs-setup'
    if (!tecnico.mfa_configurado) return 'needs-setup'

    if (tecnico.mfa_metodo === 'email' && !tecnico.mfa_sesion_verificada) {
        return 'needs-verify'
    }

    return 'ok'
}

// ─────────────────────────────────────────────────────────────────────────────

export const config = {
    matcher: [
        /*
         * Aplicar middleware a todas las rutas excepto:
         * - _next/static (archivos estáticos)
         * - _next/image (optimización de imágenes)
         * - favicon.ico
         * - archivos con extensión (ej: .png, .jpg)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
