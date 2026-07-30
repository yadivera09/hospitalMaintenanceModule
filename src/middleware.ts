import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getEstadoUsuario, permisosUsuario, ROL_ADMINISTRADOR } from '@/lib/seguridad/permisos'
import {
    resolverModulo,
    getUrlsModulos,
    primerModuloVisible,
    PATHNAME_HEADER,
} from '@/lib/seguridad/navegacion'

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

/**
 * Rutas que deben funcionar en CUALQUIER estado de sesión, incluso con el
 * segundo factor pendiente. Sin esto, el gate de MFA convierte el POST de
 * logout en un redirect 303 y la sesión nunca se cierra: el usuario queda
 * atrapado en el flujo MFA sin más salida que borrar cookies a mano.
 */
const ESCAPE_ROUTES = ['/auth/logout']

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function redirect(request: NextRequest, pathname: string) {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    return NextResponse.redirect(url, { status: 303 })
}

/**
 * Redirige borrando las cookies de sesión de Supabase.
 *
 * Necesario cuando la sesión es válida para Auth pero el sistema la rechaza
 * (cuenta desactivada o sin fila en public.usuarios): sin limpiar las cookies,
 * el siguiente request volvería a entrar aquí y quedaría en bucle.
 */
function redirectCerrandoSesion(request: NextRequest, pathname: string, motivo?: string) {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    url.search = motivo ? `?motivo=${motivo}` : ''

    const response = NextResponse.redirect(url, { status: 303 })

    for (const cookie of request.cookies.getAll()) {
        if (cookie.name.startsWith('sb-')) response.cookies.delete(cookie.name)
    }

    return response
}

/**
 * Deja pasar la petición, adjuntando el pathname para los Server Components.
 *
 * Las cabeceras se clonan en el momento de la llamada, no antes: el cliente de
 * Supabase escribe las cookies renovadas sobre `request` durante setAll, y una
 * copia tomada al inicio del middleware perdería esa renovación — la sesión se
 * caería al vencer el token.
 */
function permitir(request: NextRequest) {
    const headers = new Headers(request.headers)
    headers.set(PATHNAME_HEADER, request.nextUrl.pathname)

    return NextResponse.next({ request: { headers } })
}

function isProtectedRoute(pathname: string) {
    return (
        ADMIN_ROUTES.some((r) => pathname.startsWith(r)) ||
        TECNICO_ROUTES.some((r) => pathname.startsWith(r))
    )
}

/**
 * Distingue una navegación del navegador de una llamada en segundo plano
 * (server action, fetch, prefetch).
 *
 * Importa porque un redirect solo tiene sentido en una navegación. Redirigir
 * el POST de una server action la aborta sin ejecutarla y devuelve HTML donde
 * el cliente espera la respuesta de la action — el error genérico que aparece
 * es imposible de diagnosticar desde la interfaz.
 *
 * A las llamadas en segundo plano se les responde 403: la acción queda
 * bloqueada igual, pero de forma explícita.
 */
function esNavegacion(request: NextRequest) {
    const modo = request.headers.get('sec-fetch-mode')

    // sec-fetch-mode no existe en navegadores viejos; ante la duda se trata
    // como navegación, que es el comportamiento conservador de siempre.
    if (!modo) return request.method === 'GET'

    return modo === 'navigate'
}

/** Corta el paso a una petición que no completó el segundo factor. */
function bloqueoMfa(request: NextRequest, destino: string) {
    if (esNavegacion(request)) return redirect(request, destino)

    return NextResponse.json(
        { error: 'Verificación en dos pasos pendiente.', destino },
        { status: 403 }
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
    let supabaseResponse = permitir(request)

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
                    supabaseResponse = permitir(request)
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
    const esRutaMfa = MFA_ROUTES.some((r) => pathname.startsWith(r))

    // ─── 0. Rutas de escape: siempre pasan ───────────────────────────────────
    // Cerrar sesión debe funcionar aunque el usuario esté a medias en el MFA.
    if (ESCAPE_ROUTES.some((r) => pathname.startsWith(r))) return supabaseResponse

    // ─── 1. Sin sesión: proteger rutas privadas y el flujo MFA ───────────────
    if (!user) {
        if (esRutaMfa || isProtectedRoute(pathname)) return redirect(request, '/login')
        return supabaseResponse
    }

    // ─── 2. Estado del usuario: identidad, cuenta activa y roles ─────────────
    //
    // Una sola query resuelve las tres cosas. Se hace ANTES del gate de MFA
    // para que una cuenta sin acceso no entre siquiera al flujo de segundo factor.
    //
    // Se cierra la sesión (no solo se redirige) en los tres casos, porque con la
    // sesión viva el usuario rebotaría indefinidamente entre /login y el
    // dashboard: /login lo reenvía al panel y el panel lo devuelve a /login.
    //
    //   sin fila en usuarios → no existe para el sistema, aunque exista en auth
    //   activo = false       → cuenta desactivada desde /admin/seguridad/usuarios
    //   sin roles            → no hay nada que autorizar (fail-closed)
    const estado = await getEstadoUsuario(user.id)

    if (!estado || !estado.activo || estado.roles.length === 0) {
        return redirectCerrandoSesion(request, '/login', 'sin-acceso')
    }

    // ─── 3. Rutas MFA: accesibles con sesión válida (AAL1 es suficiente) ─────
    // Deben ir ANTES del MFA gate para evitar loops de redirección.
    if (esRutaMfa) return supabaseResponse

    // ─── 4. Verificar MFA antes de la lógica de rol ──────────────────────────
    //
    // Se resuelve solo con el AAL del JWT, sin tocar la base: con TOTP como
    // único método, el nivel de la sesión ES el estado del segundo factor.
    // Antes esto consultaba la tabla 'tecnicos', lo que dejaba fuera del
    // sistema a cualquier usuario sin perfil técnico.
    //
    // Aplica tanto a rutas protegidas como a /login, para saber a dónde
    // mandar al usuario ya autenticado.

    const mfaState = await resolveMfaState(supabase)

    // Sin factor enrolado → configurarlo antes de continuar
    if (mfaState === 'needs-setup') {
        return bloqueoMfa(request, '/configurar-mfa')
    }

    // Factor enrolado pero no verificado en esta sesión → pedir el código
    if (mfaState === 'needs-verify') {
        return bloqueoMfa(request, '/verificar-mfa')
    }

    // ─── 5. MFA OK — continuar con lógica de rol ─────────────────────────────

    // Roles ya resueltos en el paso 2, desde usuario_roles. Nunca desde
    // user_metadata: es escribible por el propio usuario (ver permisos.ts).
    const roles = estado.roles

    const esAdmin = roles.includes(ROL_ADMINISTRADOR)

    // ── Administrador: acceso total, sin consultar la matriz ─────────────────
    // Es deliberado que no se evalúe: un módulo sin sembrar no debe poder
    // dejarlo fuera, ni siquiera de la pantalla donde se arreglan los permisos.
    if (esAdmin) {
        // El panel del técnico depende de una ficha en 'tecnicos' que el
        // administrador no tiene; entrar ahí solo produce errores.
        if (TECNICO_ROUTES.some((r) => pathname.startsWith(r))) {
            return redirect(request, '/admin/dashboard')
        }

        if (AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
            return redirect(request, '/admin/dashboard')
        }

        return supabaseResponse
    }

    // ─── 6. Permiso 'ver' sobre el módulo de la ruta ─────────────────────────
    //
    // Aplica la matriz rol → módulo → permiso, que hasta la migración 018 no
    // gobernaba nada porque la tabla 'modulos' estaba vacía.
    //
    // Sustituye al filtro por nombre de rol: decidir con 'administrador' y
    // 'tecnico' funcionaba solo con esos dos, y mandaba a cualquier rol nuevo
    // al panel del técnico, donde no tiene ficha y todo falla.
    const [permisos, urlsCatalogo] = await Promise.all([
        permisosUsuario(user.id),
        getUrlsModulos(),
    ])

    const destinoPropio = primerModuloVisible(permisos, urlsCatalogo)

    // Usuario autenticado (MFA completo) en /login → su primera pantalla
    if (AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
        return redirect(request, destinoPropio ?? '/login')
    }

    if (isProtectedRoute(pathname)) {
        // La ruta se resuelve contra el CATÁLOGO COMPLETO, no contra los
        // módulos concedidos: resolverla contra estos últimos haría que una
        // ruta sin permiso no coincidiera con ninguno, se tomara por no
        // modelada y se dejara pasar — la comprobación no bloquearía nunca.
        const moduloUrl = resolverModulo(pathname, urlsCatalogo)

        // Una ruta fuera del catálogo se deja pasar: bloquear por defecto
        // dejaría inaccesibles partes de la aplicación ante un catálogo
        // incompleto. Las rutas reales del sistema sí están sembradas.
        if (moduloUrl && !permisos[moduloUrl]?.includes('ver')) {
            // Sin ninguna pantalla visible no hay a dónde mandarlo: se cierra
            // la sesión en vez de rebotarlo indefinidamente.
            if (!destinoPropio) return redirectCerrandoSesion(request, '/login', 'sin-acceso')

            return redirect(request, destinoPropio)
        }
    }

    return supabaseResponse
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveMfaState
//
// Determina el estado del segundo factor. Retorna:
//   'ok'           — verificado en esta sesión, puede acceder
//   'needs-setup'  — no hay factor enrolado, debe ir a /configurar-mfa
//   'needs-verify' — hay factor enrolado pero falta el código de esta sesión
//
// Con TOTP como único método, el AAL del JWT contiene toda la información:
//   currentLevel aal2 → ya presentó el segundo factor en esta sesión
//   nextLevel    aal2 → tiene un factor verificado disponible, falta usarlo
//   ninguno           → no hay factor utilizable
//
// Se resuelve sin consultar la base. La columna usuarios.mfa_configurado es
// informativa para el panel de administración; la autoridad es Auth, porque
// es donde vive el factor y no puede desincronizarse de sí mismo.
// ─────────────────────────────────────────────────────────────────────────────

async function resolveMfaState(
    supabase: any
): Promise<'ok' | 'needs-setup' | 'needs-verify'> {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    const currentLevel: string = aalData?.currentLevel ?? 'aal1'
    const nextLevel: string = aalData?.nextLevel ?? 'aal1'

    if (currentLevel === 'aal2') return 'ok'
    if (nextLevel === 'aal2') return 'needs-verify'

    return 'needs-setup'
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

        /*
         * Los dos paneles se declaran aparte para que la exclusión por
         * extensión de arriba NO les aplique.
         *
         * Sin estas dos líneas, cualquier ruta protegida terminada en una
         * extensión de imagen se salta el middleware entero. No es hipotético:
         * los segmentos dinámicos casan con lo que sea, así que
         * /admin/equipos/x.png entra por /admin/equipos/[id] sin pasar por
         * ningún control de rol — y sin el middleware tampoco se escribe la
         * cabecera de pathname, que es de lo que depende el layout para
         * autorizar la pantalla concreta.
         *
         * Que una ruta case con los dos patrones es inocuo: el middleware se
         * ejecuta una sola vez por petición.
         */
        '/admin/:path*',
        '/tecnico/:path*',
    ],
}
