import DashboardClient from './DashboardClient'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
    const supabase = createClient()

    // 1. Obtener la sesión
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        return <div>No autenticado</div>
    }

    // 2. Obtener el técnico desde TU TABLA usando el user_id (más robusto que el email)
    const { data: tecnico } = await supabase
        .from('tecnicos')
        .select('id, nombre, apellido')
        .eq('user_id', session.user.id)
        .single()

    // 3. Formar el nombre completo
    const nombreTecnico = tecnico
        ? `${tecnico.nombre} ${tecnico.apellido}`
        : session.user.user_metadata?.nombre_completo || 'Técnico'

    // 4. Obtener los reportes del técnico usando el ID de la tabla tecnicos
    // Si no hay técnico encontrado, devolvemos lista vacía
    let reportes: any[] = []
    
    if (tecnico) {
        const { data } = await supabase
            .from('reportes_mantenimiento')
            .select(`
                *,
                equipo:equipos (
                    codigo_mh,
                    nombre
                )
            `)
            .eq('tecnico_principal_id', tecnico.id)
            .eq('activo', true)
            .order('fecha_inicio', { ascending: false })
        
        reportes = data || []
    }

    return (
        <DashboardClient
            reportes={reportes || []}
            nombreTecnico={nombreTecnico}
        />
    )
}