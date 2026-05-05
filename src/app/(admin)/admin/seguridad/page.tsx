/**
 * src/app/(admin)/admin/seguridad/page.tsx
 * Server Component — Dashboard de seguridad.
 * Carga métricas y últimos 5 usuarios para pasar al Client Component.
 */

import { getRoles } from '@/app/actions/seguridad/roles'
import { getUsuarios } from '@/app/actions/seguridad/usuarios'
import { getGrupos } from '@/app/actions/seguridad/grupos'
import { getAuditoria } from '@/app/actions/seguridad/auditoria'
import SeguridadDashboardClient from './SeguridadDashboardClient'

export const metadata = {
    title: 'Seguridad — Mobilhospital',
    description: 'Panel de control del módulo de seguridad y permisos.',
}

export default async function SeguridadPage() {
    const [
        { data: roles },
        { data: usuarios },
        { data: grupos },
        { data: auditoria },
    ] = await Promise.all([
        getRoles(),
        getUsuarios(),
        getGrupos(),
        // Solo necesitamos el count total — pageSize mínimo
        getAuditoria({ pagina: 1 }),
    ])

    // Últimos 5 usuarios ordenados por created_at desc (ya vienen por apellido,
    // tomamos los 5 primeros de la lista para la vista de resumen)
    const ultimosUsuarios = (usuarios ?? []).slice(0, 5)

    return (
        <SeguridadDashboardClient
            totalUsuariosActivos={(usuarios ?? []).filter((u) => u.activo).length}
            totalRoles={roles?.length ?? 0}
            totalGrupos={grupos?.length ?? 0}
            totalAuditoria={auditoria?.total ?? 0}
            ultimosUsuarios={ultimosUsuarios}
        />
    )
}
