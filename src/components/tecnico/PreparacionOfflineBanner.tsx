'use client'

/**
 * src/components/tecnico/PreparacionOfflineBanner.tsx
 *
 * Muestra el avance de la preparación del modo offline.
 *
 * No es un adorno: hasta ahora el técnico no tenía forma de saber si podía
 * salir a campo. Se iba con la app "abierta" pero sin las pantallas descargadas
 * y lo descubría delante del equipo, sin red y sin poder registrar el trabajo.
 * El aviso de "listo" es la señal de que ya puede desconectarse.
 */

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, AlertTriangle } from 'lucide-react'
import type { ProgresoPreparacion } from '@/lib/offline/preparar'

/** Tiempo que permanece el aviso de éxito antes de desaparecer. */
const MS_VISIBLE_AL_TERMINAR = 4000

/** Fases en las que la preparación ya no va a avanzar más. */
const FASES_TERMINALES = ['listo', 'listo-parcial']

export default function PreparacionOfflineBanner({
    progreso,
}: {
    progreso: ProgresoPreparacion | null
}) {
    const [oculto, setOculto] = useState(false)

    // El aviso de "listo" se retira solo: ya cumplió su función y en una
    // pantalla de móvil cada franja fija le quita sitio al formulario.
    useEffect(() => {
        if (!progreso || !FASES_TERMINALES.includes(progreso.fase)) return

        setOculto(false)
        const t = setTimeout(() => setOculto(true), MS_VISIBLE_AL_TERMINAR)
        return () => clearTimeout(t)
    }, [progreso?.fase])

    if (!progreso || oculto) return null
    if (progreso.fase === 'inactivo') return null

    // Un fallo de precache no bloquea nada: con conexión la app funciona igual.
    // Se avisa para que el técnico sepa que NO debe confiar en el modo offline.
    //
    // El aviso ya no le pide reabrir la app: la preparación se reintenta sola al
    // recuperar conexión y al volver a primer plano (ver TecnicoLayoutClient).
    // Lo que sí sigue haciendo falta es que no se vaya a campo todavía, y eso es
    // lo único que se le pide.
    if (progreso.fase === 'error') {
        const sinConexion = progreso.error === 'sin-conexion'

        return (
            <div className="fixed top-14 left-0 right-0 z-30 bg-amber-50 border-b border-amber-200">
                <div className="max-w-lg mx-auto flex items-center gap-2 px-4 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <p className="text-[11px] text-amber-800 leading-tight">
                        {progreso.detalle}{' '}
                        {sinConexion
                            ? 'Se preparará sola en cuanto haya señal.'
                            : 'Se reintentará solo; no salgas a campo hasta ver el aviso de listo.'}
                    </p>
                </div>
            </div>
        )
    }

    const listo = progreso.fase === 'listo'

    // Los datos ya están; solo falta que el service worker guarde las pantallas,
    // cosa que hace solo. Se informa en azul, no en ámbar: no hay nada que el
    // técnico deba hacer al respecto.
    const parcial = progreso.fase === 'listo-parcial'
    const terminado = listo || parcial

    return (
        <div
            className={`fixed top-14 left-0 right-0 z-30 border-b ${
                listo ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
            }`}
            role="status"
            aria-live="polite"
        >
            <div className="max-w-lg mx-auto px-4 py-2">
                <div className="flex items-center gap-2">
                    {listo ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                    ) : (
                        <Loader2
                            className={`h-3.5 w-3.5 shrink-0 text-blue-600 ${parcial ? '' : 'animate-spin'}`}
                        />
                    )}
                    <p
                        className={`text-[11px] font-medium leading-tight ${
                            listo ? 'text-green-800' : 'text-blue-800'
                        }`}
                    >
                        {progreso.detalle}
                    </p>
                </div>

                {!terminado && (
                    <div className="mt-1.5 h-1 rounded-full bg-blue-100 overflow-hidden">
                        <div
                            className="h-1 rounded-full bg-blue-600 transition-all duration-300"
                            style={{ width: `${progreso.porcentaje}%` }}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
