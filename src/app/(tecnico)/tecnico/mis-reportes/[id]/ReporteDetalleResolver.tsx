'use client'

/**
 * src/app/(tecnico)/tecnico/mis-reportes/[id]/ReporteDetalleResolver.tsx
 *
 * Decide qué reporte se muestra: el que trae el servidor o el de IndexedDB.
 *
 * POR QUÉ HACE FALTA
 *   Sin red, el service worker no tiene el documento de cada id — solo guarda
 *   una copia canónica del cascarón, la de la última ruta de detalle que se
 *   visitó con conexión. Servir ese HTML tal cual mostraría SIEMPRE el mismo
 *   reporte, con independencia del id de la barra de direcciones: no es que
 *   falten datos, es que se enseñan los de otro reporte.
 *
 *   Por eso lo primero que se compara es el id: si lo que llegó del servidor no
 *   corresponde a la URL actual, se descarta y se resuelve contra IndexedDB,
 *   donde la preparación offline dejó los reportes del técnico indexados por id.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, AlertCircle, WifiOff } from 'lucide-react'
import ReporteDetalleClient from './ReporteDetalleClient'
import { getReporteDeCache } from '@/lib/offline/db'

export default function ReporteDetalleResolver({
    inicial,
    errorServidor,
}: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inicial: any | null
    errorServidor: string | null
}) {
    const { id } = useParams<{ id: string }>()

    // Solo se acepta el reporte del servidor si es el que pide la URL.
    const servidorSirve = !!inicial && inicial.id === id

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [reporte, setReporte] = useState<any | null>(servidorSirve ? inicial : null)
    const [buscando, setBuscando] = useState(!servidorSirve)
    const [noEncontrado, setNoEncontrado] = useState(false)

    useEffect(() => {
        if (servidorSirve) return

        let vigente = true

        getReporteDeCache(id)
            .then((entrada) => {
                if (!vigente) return
                if (entrada) setReporte(entrada.datos)
                else setNoEncontrado(true)
            })
            .catch(() => { if (vigente) setNoEncontrado(true) })
            .finally(() => { if (vigente) setBuscando(false) })

        return () => { vigente = false }
    }, [id, servidorSirve])

    if (buscando) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-[#94A3B8]">
                <Loader2 className="h-8 w-8 animate-spin text-[#1E40AF]" />
                <p className="text-sm font-medium">Cargando detalles…</p>
            </div>
        )
    }

    if (reporte) {
        return <ReporteDetalleClient reporte={reporte} />
    }

    // Ni servidor ni caché. Se distingue el caso sin conexión porque la acción
    // que corresponde es distinta: no es un reporte inexistente, es uno que no
    // se alcanzó a descargar.
    const sinConexion = typeof navigator !== 'undefined' && !navigator.onLine

    return (
        <div className="flex h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
            {sinConexion ? (
                <WifiOff className="h-10 w-10 text-amber-500" />
            ) : (
                <AlertCircle className="h-10 w-10 text-red-500" />
            )}
            <h2 className="text-lg font-bold text-[#0F172A]">
                {sinConexion ? 'Reporte no disponible sin conexión' : 'Reporte no encontrado'}
            </h2>
            <p className="text-sm text-[#334155]">
                {sinConexion
                    ? 'Este reporte no se descargó al dispositivo. Ábrelo de nuevo cuando tengas señal.'
                    : errorServidor || (noEncontrado ? 'El reporte no existe.' : 'No se pudo cargar el reporte.')}
            </p>
        </div>
    )
}
