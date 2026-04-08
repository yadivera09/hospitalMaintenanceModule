import { createClient } from '@/lib/supabase/server'
import { getEquipoById } from '@/app/actions/equipos'
import EquiposDetalleClient from './EquiposDetalleClient'

export const metadata = { title: 'Detalle del Equipo — Mobilhospital' }
export const dynamic = 'force-dynamic'

export default async function EquipoDetallePage({ params }: { params: { id: string } }) {
    const supabase = createClient()
    const [
        { data: equipo, error },
        { data: contratos },
        { data: ubicaciones },
        { data: categorias },
        { data: tipos },
    ] = await Promise.all([
        getEquipoById(params.id),
        supabase.from('contratos').select('id, numero_contrato').eq('activo', true).order('numero_contrato'),
        supabase.from('ubicaciones').select('id, nombre').order('nombre'),
        supabase.from('categorias_equipo').select('id, nombre').eq('activa', true).order('nombre'),
        supabase.from('tipos_mantenimiento').select('id, nombre').order('nombre'),
    ])

    return (
        <EquiposDetalleClient
            equipoInicial={equipo as any}
            errorInicial={error}
            contratos={contratos ?? []}
            ubicaciones={ubicaciones ?? []}
            categorias={categorias ?? []}
            tiposMantenimiento={tipos ?? []}
        />
    )
}
