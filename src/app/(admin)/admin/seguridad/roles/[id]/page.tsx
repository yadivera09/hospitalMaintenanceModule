/**
 * src/app/(admin)/admin/seguridad/roles/[id]/page.tsx
 * Server Component — Detalle y edición de permisos de un rol.
 */

import { redirect } from 'next/navigation'
import { getRolById, getPermisos } from '@/app/actions/seguridad/roles'
import { getMenusConModulos } from '@/app/actions/seguridad/modulos'
import RolDetalleClient from './RolDetalleClient'
import type { Metadata } from 'next'

interface PageProps {
    params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { data: rol } = await getRolById(params.id)
    return {
        title: rol ? `${rol.nombre} — Roles — Mobilhospital` : 'Rol — Mobilhospital',
    }
}

export default async function RolDetallePage({ params }: PageProps) {
    const [{ data: rol }, { data: menus }, { data: permisos }] = await Promise.all([
        getRolById(params.id),
        getMenusConModulos(),
        getPermisos(),
    ])

    // Si el rol no existe, volver al listado
    if (!rol) redirect('/admin/seguridad/roles')

    return (
        <RolDetalleClient
            rol={rol}
            menus={menus ?? []}
            permisosCatalogo={permisos ?? []}
        />
    )
}
