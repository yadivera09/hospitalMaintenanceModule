/**
 * src/app/(admin)/admin/clientes/page.tsx
 * Página de listado de clientes — Server Component.
 * BLOQUE 2 — Carga datos desde Supabase real.
 * La interactividad (buscador, modal) vive en ClientesPageClient.
 */

import { getClientes } from '@/app/actions/clientes'
import ClientesPageClient from './ClientesPageClient'

export const metadata = {
    title: 'Clientes — Mobilhospital',
    description: 'Gestión de clientes del módulo de mantenimiento.',
}

export default async function ClientesPage() {
    const { data: clientes, error } = await getClientes()

    return (
        <ClientesPageClient
            clientesIniciales={clientes ?? []}
            errorInicial={error}
        />
    )
}
