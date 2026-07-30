'use server'

/**
 * src/app/actions/mfa.ts
 * Server Actions del flujo MFA obligatorio de Mobilhospital.
 *
 * El estado vive en la tabla `usuarios` (identidad), no en `tecnicos`
 * (perfil de negocio). Antes estaba en `tecnicos` y eso dejaba fuera del
 * sistema a cualquier usuario sin perfil técnico: la escritura afectaba
 * 0 filas y el gate lo devolvía a /configurar-mfa en bucle. Ver migración
 * 015_mfa_en_usuarios.sql.
 *
 * Único método soportado: TOTP (app autenticadora). El método email se
 * descontinuó porque enviaba códigos a buzones que podían no existir,
 * dejando al usuario sin forma de entrar.
 *
 * Todas las operaciones usan createAdminClient (service role): quien configura
 * su MFA está en AAL1 y las RLS podrían bloquear su propia escritura, y el
 * reset lo ejecuta un administrador sobre la cuenta de otra persona.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, ACCESO_DENEGADO } from '@/lib/seguridad/guard'

type ActionResult<T = null> = { data: T | null; error: string | null }

// =============================================================================
// guardarMfaConfigurado
// Llamado desde /configurar-mfa tras verificar exitosamente el factor TOTP.
// =============================================================================

export async function guardarMfaConfigurado(userId: string): Promise<ActionResult> {
    if (!userId) return { data: null, error: 'userId requerido.' }

    try {
        const admin = createAdminClient()
        const { error } = await admin
            .from('usuarios')
            .update({
                mfa_configurado: true,
                mfa_metodo: 'totp',
                mfa_configurado_en: new Date().toISOString(),
            })
            .eq('user_id', userId)

        if (error) throw error
        return { data: null, error: null }
    } catch (err) {
        console.error('[guardarMfaConfigurado]', err)
        return { data: null, error: 'No se pudo guardar la configuración de MFA.' }
    }
}

// =============================================================================
// resetMfaUsuario
// Llamado desde /admin/tecnicos/[id] — sección Seguridad.
// Elimina los factores TOTP del usuario en Supabase Auth y resetea su estado.
// La persona deberá enrolar una app autenticadora en su próximo ingreso.
// =============================================================================

export async function resetMfaUsuario(userId: string): Promise<ActionResult> {
    if (!userId) return { data: null, error: 'userId requerido.' }

    const actor = await requireAdmin()
    if (!actor) return { data: null, error: ACCESO_DENEGADO }

    try {
        const admin = createAdminClient()

        // 1. Obtener los factores enrolados del usuario desde Supabase Auth.
        const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId)
        if (userErr) throw userErr

        const factors = userData.user?.factors ?? []

        // 2. Eliminar cada factor vía REST Admin API.
        //    El SDK JS (v2) no expone admin.mfa.deleteFactor, así que se usa
        //    el endpoint REST autenticado con service role.
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

        const deleteErrors: string[] = []

        await Promise.all(
            factors.map(async (factor) => {
                const res = await fetch(
                    `${supabaseUrl}/auth/v1/admin/users/${userId}/factors/${factor.id}`,
                    {
                        method: 'DELETE',
                        headers: {
                            Authorization: `Bearer ${serviceKey}`,
                            apikey: serviceKey,
                        },
                    }
                )
                if (!res.ok) {
                    const body = await res.text()
                    deleteErrors.push(`factor ${factor.id}: ${body}`)
                }
            })
        )

        if (deleteErrors.length > 0) {
            console.error('[resetMfaUsuario] Errores al eliminar factores:', deleteErrors)
            // No abortar: si algún factor falló, igual conviene resetear la DB
            // para que la persona pueda volver a configurar.
        }

        // 3. Resetear el estado en la identidad.
        const { error: dbError } = await admin
            .from('usuarios')
            .update({
                mfa_configurado: false,
                mfa_metodo: null,
                mfa_configurado_en: null,
            })
            .eq('user_id', userId)

        if (dbError) throw dbError

        return { data: null, error: null }
    } catch (err) {
        console.error('[resetMfaUsuario]', err)
        return { data: null, error: 'No se pudo resetear el MFA del usuario.' }
    }
}
