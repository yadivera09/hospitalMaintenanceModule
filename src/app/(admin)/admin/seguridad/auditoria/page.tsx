import { getAuditoria } from '@/app/actions/seguridad/auditoria'
import { getUsuarios } from '@/app/actions/seguridad/usuarios'
import AuditoriaPageClient from './AuditoriaPageClient'

export const metadata = {
    title: 'Auditoría — Mobilhospital',
    description: 'Registro de acciones del sistema.',
}

export default async function AuditoriaPage() {
    const [{ data: auditoria, error }, { data: usuarios }] = await Promise.all([
        getAuditoria({ pagina: 1 }),
        getUsuarios()
    ])

    return (
        <AuditoriaPageClient 
            datosIniciales={auditoria ?? { registros: [], total: 0, pagina: 1, totalPaginas: 1 }}
            usuarios={(usuarios ?? [])}
            errorInicial={error}
        />
    )
}
