-- =============================================================================
-- Migration: 015_mfa_en_usuarios
-- Description: Fase 2 del hardening de seguridad.
--              Mueve el estado de MFA de 'tecnicos' a 'usuarios'.
--
--   PROBLEMA
--   El gate de MFA del middleware leia la tabla 'tecnicos'. Un usuario sin
--   perfil tecnico (por ejemplo un administrador puro) no podia completar el
--   segundo factor: guardarMfaConfigurado actualizaba 0 filas, el middleware
--   volvia a leer 'needs-setup' y el usuario quedaba en bucle en /configurar-mfa.
--   Contradice la arquitectura de la migracion 008: usuarios = identidad,
--   tecnicos = perfil de negocio. El MFA es de la identidad.
--
--   METODO EMAIL
--   Se descontinua. Estaba deshabilitado en /configurar-mfa pero /verificar-mfa
--   lo usaba como fallback y enviaba un OTP a un buzon que podia no existir,
--   dejando al usuario encerrado. A partir de aqui el unico metodo es TOTP.
--   Los usuarios que tenian metodo email quedan como no configurados y deberan
--   enrolar una app autenticadora en su proximo ingreso.
--
--   mfa_sesion_verificada no se migra: existia solo para el metodo email.
--   Con TOTP el nivel AAL2 del JWT es la fuente de verdad, y ademas es por
--   sesion de verdad (el flag de la tabla era global y nunca se reseteaba).
--
-- Prerrequisitos: 008, 014
-- Tablas que modifica: usuarios (agrega 3 columnas)
-- Columnas que quedan obsoletas: tecnicos.mfa_* (se conservan por si hay que
--   revertir; ya no las lee nadie)
-- =============================================================================


-- ---------------------------------------------------------------------------
-- PASO 0 - VERIFICACION PREVIA (ejecutar solo esto primero)
--
-- Lista quien tiene MFA configurado hoy y con que metodo. Los que aparezcan
-- con metodo 'email' tendran que volver a configurar con app autenticadora.
-- ---------------------------------------------------------------------------

SELECT
    t.email,
    t.mfa_configurado,
    t.mfa_metodo,
    CASE
        WHEN t.mfa_metodo = 'email' THEN 'debera reconfigurar con app autenticadora'
        WHEN t.mfa_configurado      THEN 'conserva su configuracion TOTP'
        ELSE                             'sin MFA, configurara en su proximo ingreso'
    END AS efecto
FROM public.tecnicos t
ORDER BY t.mfa_metodo NULLS LAST, t.email;


-- ---------------------------------------------------------------------------
-- PASO 1 - COLUMNAS DE MFA EN LA IDENTIDAD
--
-- El CHECK solo admite 'totp': deja constancia en el esquema de que email
-- ya no es un metodo valido.
-- ---------------------------------------------------------------------------

ALTER TABLE public.usuarios
    ADD COLUMN IF NOT EXISTS mfa_configurado BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.usuarios
    ADD COLUMN IF NOT EXISTS mfa_metodo TEXT
        CHECK (mfa_metodo IN ('totp'));

ALTER TABLE public.usuarios
    ADD COLUMN IF NOT EXISTS mfa_configurado_en TIMESTAMPTZ;


-- ---------------------------------------------------------------------------
-- PASO 2 - BACKFILL DESDE TECNICOS
--
-- Solo se conserva la configuracion TOTP. Quien tenia email queda en false
-- para que el flujo lo mande a /configurar-mfa y enrole una app.
-- ---------------------------------------------------------------------------

UPDATE public.usuarios u
SET mfa_configurado    = (t.mfa_configurado AND t.mfa_metodo = 'totp'),
    mfa_metodo         = CASE WHEN t.mfa_metodo = 'totp' THEN 'totp' ELSE NULL END,
    mfa_configurado_en = CASE WHEN t.mfa_metodo = 'totp' THEN t.mfa_configurado_en ELSE NULL END
FROM public.tecnicos t
WHERE (u.id = t.usuario_id OR u.user_id = t.user_id);


-- ---------------------------------------------------------------------------
-- PASO 3 - REPORTE FINAL
--
-- Contrasta el estado de MFA con los factores realmente enrolados en Auth.
-- 'incoherente' significa que la tabla y Auth no coinciden: el usuario sera
-- enviado a /configurar-mfa, que limpia los factores sueltos y vuelve a enrolar.
-- ---------------------------------------------------------------------------

SELECT
    u.email,
    u.mfa_configurado,
    u.mfa_metodo,
    COUNT(f.id) FILTER (WHERE f.status = 'verified') AS factores_verificados,
    CASE
        WHEN u.mfa_configurado AND COUNT(f.id) FILTER (WHERE f.status = 'verified') > 0
            THEN 'ok'
        WHEN NOT u.mfa_configurado AND COUNT(f.id) FILTER (WHERE f.status = 'verified') = 0
            THEN 'configurara en su proximo ingreso'
        ELSE 'incoherente: reconfigurara en su proximo ingreso'
    END AS estado
FROM public.usuarios u
LEFT JOIN auth.mfa_factors f ON f.user_id = u.user_id
GROUP BY u.email, u.mfa_configurado, u.mfa_metodo
ORDER BY u.email;
