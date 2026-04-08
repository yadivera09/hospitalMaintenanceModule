import { createAdminClient } from '@/lib/supabase/admin'
import { getReportesAdmin } from '@/app/actions/reportes'
import ReportesAdminClient from './ReportesAdminClient'

export const dynamic = 'force-dynamic'

export default async function ReportesPage() {
    const [reportesRes, tiposRes] = await Promise.all([
        getReportesAdmin(),
        createAdminClient()
            .from('tipos_mantenimiento')
            .select('id, nombre')
            .eq('activo', true)
            .order('nombre'),
    ])

    const reportes = reportesRes.data ?? []
    const tipos = (tiposRes.data ?? []) as { id: string; nombre: string }[]

    return <ReportesAdminClient reportes={reportes} tipos={tipos} />
}
