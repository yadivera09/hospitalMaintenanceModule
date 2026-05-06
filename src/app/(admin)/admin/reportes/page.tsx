import { createAdminClient } from '@/lib/supabase/admin'
import { getReportesAdmin } from '@/app/actions/reportes'
import { getTecnicos } from '@/app/actions/tecnicos'
import ReportesAdminClient from './ReportesAdminClient'

export const dynamic = 'force-dynamic'

export default async function ReportesPage() {
    const [reportesRes, tiposRes, tecnicosRes] = await Promise.all([
        getReportesAdmin(),
        createAdminClient()
            .from('tipos_mantenimiento')
            .select('id, nombre')
            .eq('activo', true)
            .order('nombre'),
        getTecnicos({ role: 'tecnico' })
    ])

    const reportes = reportesRes.data ?? []
    const tipos = (tiposRes.data ?? []) as { id: string; nombre: string }[]
    const tecnicos = tecnicosRes.data ?? []

    return <ReportesAdminClient reportes={reportes} tipos={tipos} tecnicos={tecnicos} />
}
