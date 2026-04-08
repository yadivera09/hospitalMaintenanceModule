'use server'

/**
 * src/app/actions/mfa.ts
 * Server Actions para el flujo MFA obligatorio de Mobilhospital.
 *
 * Todas las operaciones usan createAdminClient (service role) porque:
 *  - guardarMfaConfigurado: el usuario está en AAL1, RLS podría bloquear
 *    su propia escritura en tecnicos.
 *  - resetMfaTecnico: el admin opera sobre la cuenta de otro usuario;
 *    requiere auth.admin API y service role en DB.
 *  - clearSesionMfa: llamado desde el route handler de logout, que corre
 *    fuera del contexto de sesión del usuario saliente.
 */

import { createAdminClient } from '@/lib/supabase/admin'

type ActionResult<T = null> = { data: T | null; error: string | null }

// =============================================================================
// guardarMfaConfigurado
// Llamado desde /configurar-mfa tras verificar exitosamente el factor.
// Marca al usuario como configurado y registra el método elegido.
// Para email, también sube mfa_sesion_verificada=true (sesión activa válida).
// =============================================================================

export async function guardarMfaConfigurado(
    userId: string,
    metodo: 'totp' | 'email'
): Promise<ActionResult> {
    if (!userId) return { data: null, error: 'userId requerido.' }

    try {
        const admin = createAdminClient()
        const { error } = await admin
            .from('tecnicos')
            .update({
                mfa_configurado: true,
                mfa_metodo: metodo,
                mfa_configurado_en: new Date().toISOString(),
                // Para email: la verificación ya ocurrió en esta sesión.
                // Para totp: no se usa este campo (AAL2 del JWT es suficiente),
                // pero ponerlo en true no causa daño y simplifica el modelo.
                mfa_sesion_verificada: true,
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
// marcarSesionEmailVerificada
// Llamado desde /verificar-mfa cuando el usuario con método=email ingresa
// el OTP correctamente. Activa el flag de sesión para que el middleware
// lo deje pasar en las rutas protegidas.
// =============================================================================

export async function marcarSesionEmailVerificada(userId: string): Promise<ActionResult> {
    if (!userId) return { data: null, error: 'userId requerido.' }

    try {
        const admin = createAdminClient()
        const { error } = await admin
            .from('tecnicos')
            .update({ mfa_sesion_verificada: true })
            .eq('user_id', userId)

        if (error) throw error
        return { data: null, error: null }
    } catch (err) {
        console.error('[marcarSesionEmailVerificada]', err)
        return { data: null, error: 'No se pudo registrar la verificación de sesión.' }
    }
}

// =============================================================================
// clearSesionMfa
// Llamado desde /auth/logout (route handler) al cerrar sesión.
// Resetea el flag de sesión para usuarios email, de modo que en el próximo
// login deban volver a verificar el OTP.
// =============================================================================

export async function clearSesionMfa(userId: string): Promise<ActionResult> {
    if (!userId) return { data: null, error: null } // No-op silencioso en logout

    try {
        const admin = createAdminClient()
        const { error } = await admin
            .from('tecnicos')
            .update({ mfa_sesion_verificada: false })
            .eq('user_id', userId)
            // Solo actualiza si el método es email; totp no usa este campo,
            // pero resetear igual es inofensivo. El filtro evita un UPDATE
            // innecesario si el usuario tiene totp o aún no configuró MFA.
            .eq('mfa_metodo', 'email')

        if (error) throw error
        return { data: null, error: null }
    } catch (err) {
        console.error('[clearSesionMfa]', err)
        // No propagar error en logout — el signOut ya ocurrió.
        return { data: null, error: null }
    }
}

// =============================================================================
// resetMfaTecnico
// Llamado desde el panel /admin/tecnicos/[id] — sección Seguridad.
// Elimina todos los factores TOTP del usuario en Supabase Auth y resetea
// los campos MFA en la tabla tecnicos.
// El usuario deberá configurar MFA nuevamente en su próximo login.
// =============================================================================

export async function resetMfaTecnico(
    tecnicoId: string,
    userId: string
): Promise<ActionResult> {
    if (!tecnicoId || !userId) return { data: null, error: 'Parámetros requeridos.' }

    try {
        const admin = createAdminClient()

        // 1. Obtener los factores activos del usuario desde Supabase Auth.
        //    getUserById incluye el array `factors` con todos los factores enrollados.
        const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId)
        if (userErr) throw userErr

        const factors = userData.user?.factors ?? []

        // 2. Eliminar cada factor vía REST Admin API.
        //    El SDK JS (v2) no expone admin.mfa.deleteFactor directamente,
        //    así que usamos el endpoint REST autenticado con service role.
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
            console.error('[resetMfaTecnico] Errores al eliminar factores:', deleteErrors)
            // No abortar — si algunos factores fallaron, aún resetear la DB
            // para que el usuario pueda volver a configurar.
        }

        // 3. Resetear columnas MFA en tecnicos.
        const { error: dbError } = await admin
            .from('tecnicos')
            .update({
                mfa_configurado: false,
                mfa_metodo: null,
                mfa_configurado_en: null,
                mfa_sesion_verificada: false,
            })
            .eq('id', tecnicoId)

        if (dbError) throw dbError

        return { data: null, error: null }
    } catch (err) {
        console.error('[resetMfaTecnico]', err)
        return { data: null, error: 'No se pudo resetear el MFA del técnico.' }
    }
}
