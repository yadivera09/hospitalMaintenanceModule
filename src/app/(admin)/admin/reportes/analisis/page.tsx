/**
 * src/app/(admin)/admin/reportes/analisis/page.tsx
 * Server Component — fetcha datos reales y pasa al client component.
 */
import { getEquiposProblematicos, getDuracionIntervenciones } from '@/app/actions/analisis'
import AnalisisClient from './AnalisisClient'

export const metadata = {
    title: 'Análisis de reportes — Mobilhospital',
}

export default async function AnalisisReportesPage() {
    const [correctivosRes, duracionRes] = await Promise.all([
        getEquiposProblematicos(),
        getDuracionIntervenciones(),
    ])

    return (
        <AnalisisClient
            correctivos={correctivosRes.data}
            duracion={duracionRes.data}
        />
    )
}
