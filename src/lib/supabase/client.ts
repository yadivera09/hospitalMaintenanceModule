'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Cliente Supabase para uso en Client Components.
 * Instancia única por render para evitar re-renders innecesarios.
 */
export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}
