import { redirect } from 'next/navigation'
import { getGrupoById } from '@/app/actions/seguridad/grupos'
import { getUsuarios } from '@/app/actions/seguridad/usuarios'
import GrupoDetalleClient from './GrupoDetalleClient'

export const metadata = {
    title: 'Detalle de Grupo — Mobilhospital',
    description: 'Gestión de miembros y detalles del grupo.',
}

export default async function GrupoDetallePage({
    params
}: {
    params: { id: string }
}) {
    const [{ data: grupo, error }, { data: usuarios }] = await Promise.all([
        getGrupoById(params.id),
        getUsuarios()
    ])

    if (error || !grupo) {
        redirect('/admin/seguridad/grupos')
    }

    return (
        <GrupoDetalleClient 
            grupo={grupo} 
            usuariosActivos={(usuarios ?? []).filter(u => u.activo)} 
        />
    )
}
