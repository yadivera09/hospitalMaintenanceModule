import { getUsuarios } from '@/app/actions/seguridad/usuarios'
import { getRoles } from '@/app/actions/seguridad/roles'
import UsuariosPageClient from './UsuariosPageClient'

export const metadata = {
    title: 'Usuarios — Mobilhospital',
    description: 'Gestión de usuarios del sistema.',
}

export default async function UsuariosPage() {
    const [{ data: usuarios, error }, { data: rolesCatalogo }] = await Promise.all([
        getUsuarios(),
        getRoles()
    ])

    return (
        <UsuariosPageClient 
            usuariosIniciales={usuarios ?? []} 
            rolesCatalogo={rolesCatalogo ?? []}
            errorInicial={error} 
        />
    )
}
