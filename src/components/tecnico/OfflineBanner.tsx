'use client'

/**
 * src/components/tecnico/OfflineBanner.tsx
 * Detecta navigator.onLine.
 * - Offline → banner rojo fijo justo bajo el header con contador
 * - Vuelve en línea → banner verde por 3 segundos y desaparece
 */

import { useState, useEffect } from 'react'
import { WifiOff, Wifi, CloudOff } from 'lucide-react'
import { getReportesPendientes } from '@/lib/offline/db'
import { sincronizarReportesPendientes } from '@/lib/offline/sync'

export default function OfflineBanner() {
    const [estado, setEstado] = useState<'online' | 'offline' | 'reconectado'>('online')
    const [pendientes, setPendientes] = useState(0)

    useEffect(() => {
        /** Sincroniza el estado inicial */
        setEstado(navigator.onLine ? 'online' : 'offline')

        const actualizarPendientes = async () => {
            try {
                const reportes = await getReportesPendientes()
                setPendientes(reportes.length)
            } catch (e) {
                console.error("Error cargando pendientes offline", e)
            }
        }
        actualizarPendientes()

        function handleOffline() {
            setEstado('offline')
            actualizarPendientes()
        }

        function handleOnline() {
            setEstado('reconectado')
            sincronizarReportesPendientes().then(() => {
                actualizarPendientes()
                setTimeout(() => setEstado('online'), 3000)
            }).catch(e => {
                console.error("Error sincronizando pendientes offline", e)
                setTimeout(() => setEstado('online'), 3000)
            })
        }

        window.addEventListener('offline', handleOffline)
        window.addEventListener('online', handleOnline)
        return () => {
            window.removeEventListener('offline', handleOffline)
            window.removeEventListener('online', handleOnline)
        }
    }, [])

    if (estado === 'online') return null

    if (estado === 'reconectado') {
        return (
            <div
                className="fixed top-14 left-0 right-0 z-30 flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 text-sm font-medium shadow-md animate-in slide-in-from-top duration-300"
                id="banner-reconectado"
            >
                <Wifi className="h-4 w-4 shrink-0" />
                <span>De vuelta en línea. Sincronizando reportes…</span>
            </div>
        )
    }

    // estado === 'offline'
    return (
        <div
            className="fixed top-14 left-0 right-0 z-30 bg-red-600 text-white px-4 py-3 shadow-md"
            id="banner-offline"
        >
            <div className="flex items-center gap-2 max-w-lg mx-auto">
                <WifiOff className="h-4 w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold leading-none">Sin conexión — modo offline activo</p>
                    <p className="text-[10px] text-red-200 mt-0.5 leading-snug">
                        Los reportes se guardarán localmente y se sincronizarán cuando vuelvas a estar en línea.
                    </p>
                </div>
                {pendientes > 0 && (
                    <div className="flex items-center gap-1 shrink-0">
                        <CloudOff className="h-3 w-3" />
                        <span className="text-[10px] font-bold">{pendientes} pendiente{pendientes !== 1 ? 's' : ''}</span>
                    </div>
                )}
            </div>
        </div>
    )
}
