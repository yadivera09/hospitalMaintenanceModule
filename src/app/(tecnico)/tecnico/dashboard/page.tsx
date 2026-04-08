import DashboardClient from './DashboardClient'
import { getMisReportes } from '@/app/actions/reportes'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Mi Panel — Mobilhospital' }
export const dynamic = 'force-dynamic'

export default async function TecnicoDashboard() {
    const { data: misReportes } = await getMisReportes()
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let nombreTecnico = ''
    if (user) {
        const { data: tc } = await supabase.from('tecnicos').select('nombre, apellido').eq('user_id', user.id).single()
        if (tc) nombreTecnico = tc.nombre
    }

    return <DashboardClient reportes={misReportes || []} nombreTecnico={nombreTecnico} />
}
