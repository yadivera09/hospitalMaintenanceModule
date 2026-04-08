import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cliente Supabase para uso en Server Components, Server Actions y Route Handlers.
 * Usa cookies para manejar la sesión del usuario.
 *
 * IMPORTANTE — por qué existe el try-catch en setAll:
 *   En Next.js App Router, los Server Components son de solo lectura.
 *   cookieStore.set() lanza una excepción en ese contexto.
 *   El catch la silencia intencionalmente — el middleware (/src/middleware.ts)
 *   es responsable de refrescar la sesión, no el Server Component.
 *   Sin este try-catch, el build de Vercel falla.
 */
export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component de solo lectura: set() lanza, catch silencia.
            // El middleware refresca la sesión en cada request.
          }
        },
      },
    }
  )
}
