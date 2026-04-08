import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con SERVICE_ROLE para operaciones privilegiadas en servidor.
 * Únicamente para: Storage uploads de firmas, operaciones que RLS bloquearía.
 * NUNCA exponer en cliente.
 */
export function createAdminClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}
