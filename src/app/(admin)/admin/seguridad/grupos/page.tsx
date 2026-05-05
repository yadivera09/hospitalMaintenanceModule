import { getGrupos } from '@/app/actions/seguridad/grupos'
import { getUsuarios } from '@/app/actions/seguridad/usuarios'
import GruposPageClient from './GruposPageClient'

export const metadata = {
    title: 'Grupos — Mobilhospital',
    description: 'Gestión de grupos de trabajo.',
}

export default async function GruposPage() {
    const [{ data: grupos, error }, { data: usuarios }] = await Promise.all([
        getGrupos(),
        getUsuarios()
    ])

    return (
        <GruposPageClient 
            gruposIniciales={grupos ?? []} 
            usuariosActivos={(usuarios ?? []).filter(u => u.activo)}
            errorInicial={error} 
        />
    )
}
