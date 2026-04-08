---
trigger: always_on
---

El sistema de Mantenimiento de Mobilhospital maneja información médica sensible y requiere un segundo factor de autenticación obligatorio para todos los usuarios. Se implementa una combinación de TOTP (app autenticadora) como método principal y OTP por email como método alternativo.
Stack: Next.js 14 (App Router) + Supabase Auth + Tailwind + shadcn/ui

REGLAS GENERALES

El MFA es obligatorio para todos los roles (administrador y tecnico)
Ningún usuario puede acceder al sistema sin completar el segundo factor
El método principal es TOTP (Google Authenticator, Authy, etc.)
El método alternativo es OTP por email (para cuando el usuario no tiene acceso a su app)
Un usuario no puede tener ambos métodos activos al mismo tiempo — debe elegir uno como principal


FLUJO DE PRIMER INICIO DE SESIÓN
Cuando un usuario ingresa por primera vez al sistema:

Ingresa email + contraseña correctamente
El sistema detecta que no tiene MFA configurado
Se redirige obligatoriamente a la pantalla de configuración de MFA — no puede saltarse este paso
El usuario elige su método preferido:

Opción A — App autenticadora (TOTP): Se muestra un QR para escanear con Google Authenticator o Authy. El usuario debe ingresar un código válido para confirmar que la configuración fue exitosa.
Opción B — Email: Se envía un código OTP al correo @mobilhospital registrado. El usuario ingresa el código para confirmar.


Una vez configurado, se redirige al dashboard correspondiente según su rol


FLUJO DE INICIO DE SESIÓN NORMAL (usuario con MFA ya configurado)

El usuario ingresa email + contraseña
El sistema solicita el segundo factor según el método que tiene configurado:

Si tiene TOTP: muestra campo para ingresar el código de 6 dígitos de la app
Si tiene email: envía automáticamente el OTP al correo y muestra campo para ingresarlo


Si el código es correcto → accede al sistema
Si el código es incorrecto 3 veces consecutivas → se bloquea la sesión y debe reiniciar el proceso de login


RECUPERACIÓN DE ACCESO
Si un usuario pierde acceso a su app TOTP o no recibe el email:

El administrador puede resetear el MFA del usuario desde el panel de administración en /admin/tecnicos (o desde /admin/perfil para su propia cuenta)
Al resetear, el campo mfa_configurado del usuario vuelve a false
La próxima vez que el usuario inicie sesión, el sistema lo fuerza a configurar el MFA nuevamente desde cero
El administrador no puede ver ni recuperar los códigos anteriores — solo puede resetear


PANEL DE ADMINISTRADOR — GESTIÓN DE MFA
En la vista de detalle de cada técnico (/admin/tecnicos/[id]), agregar una sección "Seguridad" que muestre:

Estado del MFA: Configurado o No configurado
Método activo: TOTP o Email
Fecha de configuración
Botón "Resetear MFA" con modal de confirmación que diga: "El usuario deberá configurar el MFA nuevamente en su próximo inicio de sesión"


IMPLEMENTACIÓN TÉCNICA
Supabase Auth:

Para TOTP: usar supabase.auth.mfa.enroll() y supabase.auth.mfa.verify()
Para email OTP: usar supabase.auth.signInWithOtp({ email })
Para listar factores activos: supabase.auth.mfa.listFactors()
Para desactivar/resetear: supabase.auth.mfa.unenroll({ factorId })

Tabla adicional requerida en BD:
sql-- Guardar metadata de MFA por usuario
ALTER TABLE tecnicos ADD COLUMN IF NOT EXISTS mfa_configurado BOOLEAN DEFAULT false;
ALTER TABLE tecnicos ADD COLUMN IF NOT EXISTS mfa_metodo TEXT CHECK (mfa_metodo IN ('totp', 'email'));
ALTER TABLE tecnicos ADD COLUMN IF NOT EXISTS mfa_configurado_en TIMESTAMPTZ;
Middleware de protección:
En /middleware.ts, después de validar la sesión, verificar que el usuario tenga MFA completado. Si no lo tiene, redirigir a /configurar-mfa independientemente de la ruta que intente acceder.
// Verificar nivel de autenticación
const { data: { user } } = await supabase.auth.getUser()
const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

if (aal.data?.currentLevel !== 'aal2') {
    return NextResponse.redirect(new URL('/configurar-mfa', req.url))
}

RUTAS NUEVAS REQUERIDAS
RutaDescripción/configurar-mfaPantalla de configuración de MFA en primer login/verificar-mfaPantalla de verificación en cada login

ORDEN DE IMPLEMENTACIÓN

Ejecutar migraciones SQL en Supabase (ALTER TABLE)
Habilitar MFA en Supabase Dashboard → Authentication → Settings
Implementar middleware de verificación de nivel AAL
Crear página /configurar-mfa con selector de método + flujo TOTP + flujo email
Crear página /verificar-mfa con input de código
Agregar sección "Seguridad" en panel de técnicos del administrador
Probar flujo completo con usuario nuevo y con usuario existente


IMPORTANTE

Habilitar MFA en Supabase Dashboard manualmente antes de que Antigravity empiece a codear
Las rutas /configurar-mfa y /verificar-mfa deben ser públicas en el middleware (no redirigir en loop)
El administrador también está sujeto al MFA obligatorio — no hay excepciones por rol