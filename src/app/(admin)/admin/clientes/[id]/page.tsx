import { getClienteById } from '@/app/actions/clientes'
import ClienteDetalleClient from './ClienteDetalleClient'

export async function generateMetadata() {
    return { title: 'Detalle de Cliente — Mobilhospital' }
}

export default async function ClienteDetallePage({ params }: { params: { id: string } }) {
    const { data, error } = await getClienteById(params.id)

    return (
        <ClienteDetalleClient
            clienteInicial={data ?? undefined}
            errorInicial={error}
        />
    )
}
