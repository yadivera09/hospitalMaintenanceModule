-- =============================================================================
-- Migration: 001_add_mfa_columns
-- Description: Agrega columnas de MFA obligatorio a la tabla tecnicos.
--              Incluye método elegido, estado de configuración y flag de sesión
--              para el flujo de email OTP (que no eleva a AAL2 en Supabase Auth).
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =============================================================================

-- Indica si el usuario completó la configuración inicial de MFA.
-- false = debe pasar por /configurar-mfa en el próximo login.
ALTER TABLE tecnicos
    ADD COLUMN IF NOT EXISTS mfa_configurado BOOLEAN NOT NULL DEFAULT false;

-- Método de segundo factor elegido por el usuario.
-- 'totp' → app autenticadora (Google Authenticator, Authy, etc.) — eleva a AAL2.
-- 'email' → OTP por correo — verificado a nivel de aplicación (no AAL2 nativo).
-- NULL mientras mfa_configurado = false.
ALTER TABLE tecnicos
    ADD COLUMN IF NOT EXISTS mfa_metodo TEXT
        CHECK (mfa_metodo IN ('totp', 'email'));

-- Timestamp de cuándo el usuario configuró su MFA por primera vez (o tras un reset).
-- NULL mientras mfa_configurado = false.
ALTER TABLE tecnicos
    ADD COLUMN IF NOT EXISTS mfa_configurado_en TIMESTAMPTZ;

-- Flag de sesión para usuarios con método email.
-- El middleware lo usa para verificar que el OTP de email fue completado en la
-- sesión activa. Se resetea a false en cada signOut o cuando el middleware
-- detecta un auth_token distinto al de la última verificación.
-- Para usuarios TOTP este campo se ignora (el AAL2 del JWT es suficiente).
ALTER TABLE tecnicos
    ADD COLUMN IF NOT EXISTS mfa_sesion_verificada BOOLEAN NOT NULL DEFAULT false;

-- =============================================================================
-- Índices
-- =============================================================================

-- Búsqueda frecuente en el middleware: dado un user_id, leer el estado MFA.
CREATE INDEX IF NOT EXISTS idx_tecnicos_user_id_mfa
    ON tecnicos (user_id)
    WHERE user_id IS NOT NULL;

-- =============================================================================
-- Comentarios de columna (visibles en Supabase Table Editor)
-- =============================================================================

COMMENT ON COLUMN tecnicos.mfa_configurado IS
    'true si el usuario completó el flujo de configuración de MFA. El middleware bloquea el acceso hasta que sea true.';

COMMENT ON COLUMN tecnicos.mfa_metodo IS
    'Método de segundo factor activo: totp (AAL2 nativo) o email (verificado por la app). Mutuamente excluyentes.';

COMMENT ON COLUMN tecnicos.mfa_configurado_en IS
    'Fecha y hora en que se completó la última configuración de MFA. Se resetea al hacer unenroll desde el panel de administración.';

COMMENT ON COLUMN tecnicos.mfa_sesion_verificada IS
    'Solo relevante para mfa_metodo=email. true indica que el OTP de email fue verificado en la sesión actual. El middleware lo resetea a false al detectar una sesión nueva.';
