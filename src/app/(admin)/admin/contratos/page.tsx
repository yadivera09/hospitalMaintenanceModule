/**
 * src/app/(admin)/admin/contratos/page.tsx
 * Server Component — carga contratos y clientes desde Supabase.
 */
import { getContratos } from '@/app/actions/contratos'
import { getClientes } from '@/app/actions/clientes'
import ContratosPageClient from './ContratosPageClient'

export const metadata = {
    title: 'Contratos — Mobilhospital',
}

export default async function ContratosPage() {
    const [{ data: contratos, error }, { data: clientes }] = await Promise.all([
        getContratos(),
        getClientes(),
    ])

    return (
        <ContratosPageClient
            contratosIniciales={contratos ?? []}
            clientesList={clientes ?? []}
            errorInicial={error}
        />
    )
}
