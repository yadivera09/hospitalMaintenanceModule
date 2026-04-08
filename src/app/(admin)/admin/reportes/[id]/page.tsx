import { Suspense } from 'react'
import { Loader2, ClipboardList } from 'lucide-react'
import ReporteDetalleAdminClient from './ReporteDetalleAdminClient'
import { getReporteById } from '@/app/actions/reportes'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function ReporteDetalleAdminPage({ params }: { params: { id: string } }) {
    const res = await getReporteById(params.id)

    if (res.error || !res.data) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
                <ClipboardList className="h-12 w-12 text-[#E2E8F0]" />
                <h2 className="text-lg font-bold text-[#0F172A]">Reporte no encontrado</h2>
                <Button variant="outline" asChild>
                    <Link href="/admin/reportes">Volver a reportes</Link>
                </Button>
            </div>
        )
    }

    return (
        <Suspense fallback={
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#1E40AF]" />
            </div>
        }>
            <ReporteDetalleAdminClient reporteRaw={res.data} />
        </Suspense>
    )
}
