import { notFound, redirect } from 'next/navigation'
import { getUsuarioById } from '@/app/actions/seguridad/usuarios'
import { getRoles } from '@/app/actions/seguridad/roles'
import UsuarioDetalleClient from './UsuarioDetalleClient'

export const metadata = {
    title: 'Detalle de Usuario — Mobilhospital',
    description: 'Información y roles asignados.',
}

export default async function UsuarioDetallePage({
    params
}: {
    params: { id: string }
}) {
    const [{ data: usuario, error }, { data: rolesCatalogo }] = await Promise.all([
        getUsuarioById(params.id),
        getRoles()
    ])

    if (error || !usuario) {
        redirect('/admin/seguridad/usuarios')
    }

    return (
        <UsuarioDetalleClient 
            usuario={usuario} 
            rolesCatalogo={rolesCatalogo ?? []} 
        />
    )
}
