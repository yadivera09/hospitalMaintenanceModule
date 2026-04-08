import MisReportesClient from './MisReportesClient'
import { getMisReportes } from '@/app/actions/reportes'

export const dynamic = 'force-dynamic'

export default async function MisReportesPage() {
    const { data: misReportes } = await getMisReportes()

    return (
        <div className="space-y-4">
            {/* Encabezado */}
            <div>
                <h1 className="text-lg font-bold text-[#0F172A]">Mis Reportes</h1>
                <p className="text-xs text-[#94A3B8]">{(misReportes || []).length} reportes en total</p>
            </div>

            <MisReportesClient iniciales={(misReportes || []) as any} />
        </div>
    )
}
