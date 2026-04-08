import { Suspense } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import ReporteDetalleClient from './ReporteDetalleClient'
import { getReporteById } from '@/app/actions/reportes'

export default async function ReporteDetallePage({ params }: { params: { id: string } }) {
    const res = await getReporteById(params.id)

    if (res.error || !res.data) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
                <AlertCircle className="h-10 w-10 text-red-500" />
                <h2 className="text-lg font-bold text-[#0F172A]">Error o no encontrado</h2>
                <p className="text-sm text-[#334155]">{res.error || 'Reporte no existe'}</p>
            </div>
        )
    }

    const reporte = res.data
    const id = params.id
    console.log('[getReporteById] estado_equipo_post:', reporte.estado_equipo_post, '| id:', id)

    return (
        <Suspense fallback={
            <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-[#94A3B8]">
                <Loader2 className="h-8 w-8 animate-spin text-[#1E40AF]" />
                <p className="text-sm font-medium">Cargando detalles...</p>
            </div>
        }>
            <ReporteDetalleClient reporte={res.data} />
        </Suspense>
    )
}
