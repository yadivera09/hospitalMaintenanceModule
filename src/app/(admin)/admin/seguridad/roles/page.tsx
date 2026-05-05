/**
 * src/app/(admin)/admin/seguridad/roles/page.tsx
 * Server Component — Lista de roles del sistema RBAC.
 */

import { getRoles } from '@/app/actions/seguridad/roles'
import RolesPageClient from './RolesPageClient'

export const metadata = {
    title: 'Roles — Mobilhospital',
    description: 'Gestión de roles y permisos del sistema.',
}

export default async function RolesPage() {
    const { data: roles, error } = await getRoles()

    return (
        <RolesPageClient
            rolesIniciales={roles ?? []}
            errorInicial={error}
        />
    )
}
