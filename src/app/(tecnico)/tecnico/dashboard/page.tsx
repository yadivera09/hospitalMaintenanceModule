import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
    const supabase = createClient()

    // 1. Obtener la sesión
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        return <div>No autenticado</div>
    }

    // 2. Obtener el técnico desde TU TABLA usando el email
    const { data: tecnico } = await supabase
        .from('tecnicos')
        .select('nombre, apellido')
        .eq('email', session.user.email)  // Buscar por email
        .single()

    // 3. Formar el nombre completo desde tu tabla
    const nombreTecnico = tecnico
        ? `${tecnico.nombre} ${tecnico.apellido}`
        : session.user.user_metadata?.nombre_completo || 'Técnico'

    // 4. Obtener los reportes del técnico usando el ID de tu tabla
    const { data: reportes } = await supabase
        .from('reportes')
        .select(`
            *,
            equipo:equipos (
                codigo_mh,
                nombre
            )
        `)
        .eq('tecnico_id', session.user.id)
        .order('fecha_inicio', { ascending: false })

    return (
        <DashboardClient
            reportes={reportes || []}
            nombreTecnico={nombreTecnico}
        />
    )
}