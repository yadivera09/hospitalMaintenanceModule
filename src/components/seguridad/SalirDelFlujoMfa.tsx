'use client'

/**
 * src/components/seguridad/SalirDelFlujoMfa.tsx
 *
 * Salida de emergencia de las pantallas de MFA.
 *
 * El gate del middleware redirige cualquier URL a /configurar-mfa o
 * /verificar-mfa mientras el segundo factor esté pendiente — incluido /login.
 * Sin este botón, quien no pueda completar el flujo (perdió el dispositivo,
 * entró con la cuenta equivocada) no tiene forma de salir salvo borrar las
 * cookies del navegador a mano.
 *
 * Usa un form POST nativo contra /auth/logout, que está en ESCAPE_ROUTES del
 * middleware. No es una server action: esas también las bloquea el gate.
 */

import { LogOut } from 'lucide-react'

export default function SalirDelFlujoMfa() {
    return (
        <form action="/auth/logout" method="POST" className="mt-4 text-center">
            <button
                type="submit"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
                <LogOut className="h-3.5 w-3.5" />
                Cerrar sesión y volver al inicio
            </button>
        </form>
    )
}
